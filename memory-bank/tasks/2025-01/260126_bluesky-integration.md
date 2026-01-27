# 260126_bluesky-integration

## Objective
Add optional Bluesky OAuth integration for LIVE status posting when streaming.

## Outcome
- ✅ Bluesky OAuth with DPoP (AT Protocol compliant)
- ✅ "I'm live!" post to Bluesky when going live
- ✅ Optional archive link post when ending stream
- ✅ Session-only credentials (ephemeral, not persisted)
- ✅ User opt-in checkbox in Go Live modal

## Files Modified

### server.js (+18 lines)
- Added `/client-metadata.json` endpoint for OAuth client registration
- Returns dynamic client metadata with proper redirect URIs
- Scope: `atproto transition:generic`

### index.html (+1188 lines)

**Bootstrap Module Extensions:**
- `parseHashParams()` - Extended to parse OAuth callback params
- `clearOAuthParams()` - Clean URL after OAuth redirect
- `buildShareUrl(relay, id, dest)` - Generate deep link URLs

**New Bluesky Module (IIFE):**
- DPoP key generation using WebCrypto (ECDSA P-256)
- PKCE flow (code_verifier, code_challenge)
- Handle resolution via bsky.social API
- PDS discovery from DID documents
- Protected Resource Metadata for auth server discovery
- Token exchange with DPoP proofs
- `authorize(handle)` - Initiate OAuth flow
- `handleCallback(code, state, iss)` - Process OAuth return
- `setLiveStatus(streamUrl, title)` - Post "I'm live!" to Bluesky
- `clearLiveStatus()` - Remove live status (placeholder)
- `postArchiveLink(archiveUrl, title)` - Post archive after stream
- `disconnect()` - Clear session credentials
- `updateConnectionUI()` - Sync UI state

**Settings Modal:**
- Bluesky section with connect/disconnect UI
- Handle input field
- Archive posting preference (ask/always/never)
- Connected state shows handle with disconnect button

**Go Live Modal:**
- Checkbox: "Post 'I'm live!' to Bluesky" (shown when connected)
- Styled with butterfly icon

**Header:**
- Bluesky indicator when connected: "🦋 @handle"

## Technical Details

### OAuth Flow
1. User enters Bluesky handle
2. Resolve handle → DID via bsky.social
3. Fetch DID document from plc.directory
4. Extract PDS URL from services
5. Get protected resource metadata → auth server
6. Generate PKCE (code_verifier + challenge)
7. Generate DPoP keypair (WebCrypto)
8. Store state in localStorage (survives redirect)
9. Redirect to Bluesky authorization
10. On callback: exchange code for tokens with DPoP proof
11. Restore relay URL from stored state
12. Update UI to show connected state

### DPoP Implementation
- ECDSA P-256 keys via `crypto.subtle.generateKey()`
- JWT header includes `jwk` with public key
- JWT payload: `htu` (URL), `htm` (method), `iat`, `jti`
- Nonce handling for server-required nonces

### URL Format for Deep Links
```
https://serenity.ngrok.app/#relay=wss://serenity.ngrok.app&id={streamId}&dest=stream
https://serenity.ngrok.app/#relay=wss://serenity.ngrok.app&id={archiveId}&dest=archive
```

## Integration Points

### goLive() (~line 7053)
```javascript
const shouldPostToBluesky = document.getElementById('setupBlueskyPost')?.checked;
if (Bluesky.isConnected() && shouldPostToBluesky) {
  const streamTitle = Amplify.getStreamTitle();
  Bluesky.setLiveStatus(shareableUrl, streamTitle);
}
```

### App Init
- Checks for OAuth callback params in URL
- Calls `Bluesky.handleCallback()` if present
- Opens Settings modal on successful connection

## Issues Resolved
- **404 on auth server metadata**: Check protected resource metadata first, fallback to bsky.social
- **Relay lost in redirect**: Store relay URL in localStorage with PKCE state
- **OAuth callback detection**: Use `window.location.search` not hash
- **invalid_scope**: Added `transition:generic` to client metadata and auth request
- **403 on createRecord**: Re-auth after updating client metadata scope

## Patterns Applied
- Followed existing IIFE module pattern (Settings, MapView, etc.)
- Session-only state (no persistent Bluesky credentials)
- Non-blocking API calls (streaming continues if Bluesky fails)
- UI state sync via `updateConnectionUI()`

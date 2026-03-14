# 130326_claudes-causes

## Objective
Add chat, archive management, block/mute, embeddable player, and CORS fixes to make oneye usable for real-world streaming.

## Outcome
- All 5 phases implemented in a single release
- Deployed and tested on production relay (oe-relay.zerologic.com)

## Files Modified
- `server.js` — CORS preflight, POST delete endpoint, chat relay, embed route, broken archive cleanup, track metadata, CSP media-src fix
- `index.html` — Chat module, BlockList module, archive delete/download/embed buttons, auto-play, embed share helper, viewer chat toggle
- `docs/index.html` — synced copy for GitHub Pages

## Features Added

### CORS Preflight (Phase 1A)
- OPTIONS early-return with 204 before route matching
- Note: Cloudflare intercepts OPTIONS and returns its own response — DELETE method blocked by CF's allowed methods

### Archive Auto-play (Phase 1B)
- `video.play()` with muted fallback, gated behind `Settings.shouldAutoPlay()`

### Archive Management (Phase 2)
- `POST /archives/:id/delete` — validates hex-only ID, removes dir + index entry (used POST instead of DELETE due to Cloudflare CORS interception)
- Track metadata (`tracks.video`, `tracks.audio`) in recording metadata
- Broken recordings < 1KB skipped and cleaned up in `finalizeRecording()`
- Delete button (own archives only), download button (`<a download>`), embed button in archive topbar

### Chat (Phase 3)
- Server: `handleChat()` validates stream/text/pubkey, relays to all subscribed clients. `MAX_CHAT_MESSAGE_LENGTH = 500`
- Client: Chat IIFE module with message display, send, auto-scroll, DOM cap at 100 messages
- Chat panel: 300px right side (desktop), bottom 50vh (mobile), glass morphism
- Toggle button in viewer controls, wired via `Discovery.onChat` callback

### Block/Mute (Phase 4)
- BlockList IIFE module: localStorage-backed (`oneye:blocklist`), `block/unblock/isBlocked/getBlocked`
- Guards on `Discovery.onStreamAvailable` and `Chat.addMessage` — skips blocked pubkeys
- Click-to-block on chat author names

### Embeddable Player (Phase 5)
- Server: `/embed` route serves self-contained HTML, omits `X-Frame-Options`
- Supports live WebRTC streams and archive playback via hash params (`id`, `relay`, `dest`)
- Client: `copyEmbedCode()` generates iframe snippets, buttons in viewer controls and archive player

## Patterns Applied
- IIFE module pattern for Chat and BlockList (same as all other modules)
- localStorage persistence for BlockList (same pattern as Settings)
- Discovery callback pattern (`onChat`) matches existing `onStreamAvailable`/`onSignal`
- Archive topbar action buttons match existing close button styling

## Architectural Decisions
- **POST instead of DELETE for archive removal**: Cloudflare intercepts OPTIONS preflight and strips DELETE from `Access-Control-Allow-Methods`. Using `POST /archives/:id/delete` bypasses this.
- **CSP `media-src https:`**: Cross-origin video from relay blocked without it when served from GitHub Pages/localhost.
- **Chat relayed to all subscribed clients**: Simpler than filtering by streamId on server — client-side filtering handles it.

## Deployment Notes
- `scp server.js index.html michael@umacbookpro:~/Sites/oneye/`
- `ssh michael@umacbookpro "systemctl --user restart oneye"`
- Cloudflare cache may need hard refresh

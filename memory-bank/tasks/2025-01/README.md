# January 2025 Tasks

## 2025-01-26: Bluesky LIVE Badge Integration

Added optional Bluesky OAuth integration for posting "I'm live!" when streaming.

### Changes
- Bluesky OAuth with DPoP (AT Protocol compliant)
- Session-only credentials (ephemeral, not persisted)
- "I'm live!" post with stream link when going live
- Optional archive link post when ending stream
- User opt-in checkbox in Go Live modal
- Deep link URL format: `#relay=...&id=...&dest=stream|archive`

### Files Modified
- `server.js` - `/client-metadata.json` OAuth endpoint
- `index.html` - Bluesky module, Settings UI, Go Live integration

### Pattern
OAuth state stored in localStorage (survives redirect), credentials kept in memory only. DPoP keys generated via WebCrypto. Non-blocking API calls - streaming continues if Bluesky fails.

See: [260126_bluesky-integration.md](./260126_bluesky-integration.md)

---

## 2025-01-26: Relay Stats Display

Added live connected user count with activity breakdown to footer.

### Changes
- Footer shows total connected users (bottom-left, mirrors connection indicator)
- Detailed breakdown: "👥 243 · 12 live · 200 watching"
- Server broadcasts `relay_stats` on connect/disconnect
- Real-time updates as users join/leave or change roles

### Files Modified
- `server.js` - `broadcastRelayStats()`, `getRelayStats()`, welcome message
- `index.html` - HTML element, CSS, message handler, `updateRelayStats()`

### Pattern
Server counts clients by role (`broadcaster`, `viewer`, or idle). Broadcasts stats on any client connect/disconnect. Stats included in welcome message for immediate display.

See: [260126_relay-stats-footer.md](./260126_relay-stats-footer.md)

---

## 2025-01-26: Viewer Controls & Z-Index Fixes

Modernized viewer controls and fixed modal stacking above Leaflet map.

### Changes
- Viewer controls redesign with SVG icons and glass morphism styling
- QR code sharing button for viewers
- Fixed z-index stacking: modals now appear above Leaflet map layers
- Settings modal: 1000, Amplify modal: 1000, Broadcast setup: 950, Mobile nav: 900

### Files Modified
- `index.html` - CSS and HTML updates

### Pattern
Leaflet default z-indexes go up to ~700. All modals now use z-index 900-1000 to ensure proper stacking.

See: [260126_viewer-controls-zindex.md](./260126_viewer-controls-zindex.md)

---

## 2025-01-26: Settings System & Mobile UI

Implemented comprehensive Settings system with theme support and mobile-first navigation.

### Changes
- Settings module with localStorage persistence (theme, autoplay, location, notifications)
- Full light theme CSS with system preference detection
- Settings modal UI (appearance, playback, privacy, defaults)
- Mobile navigation: hamburger menu, tab bar, categories grid
- Map view integrated into content area with theme-aware tiles
- Simplified footer with glowing Go Live button and connection indicator
- Sidebar grouped sections with auto-expand/collapse behavior

### Files Modified
- `index.html` - all changes (single-page app)
- `README.md` - updated features documentation
- `ARCHITECTURE.md` - added client architecture section

### Pattern
Settings persist via `oneye:settings` localStorage key. Theme applied via `data-theme` attribute on `<html>`. Map tiles swap between CartoDB dark/light based on theme.

See: [260126_settings-ui-mobile.md](./260126_settings-ui-mobile.md)

---

## 2025-01-25: Distributed Discovery & Navigation

Implemented full tag/category discovery system with sidebar navigation.

### Changes
- Added 7 new JS modules: TagIndex, Location, MapView, Search, Sidebar, TagsInput, BroadcastSetup
- Enhanced presence packet (version 2) with tags array and optional location
- Collapsible sidebar with categories, tag cloud, map view
- Content area with search, view switching (live/archives/filtered)
- Enhanced archive cards with collapsible tag disclosure
- Go Live modal with category chips, custom tags, location toggle

### Files Modified
- `index.html` - all changes (single-page app)

### Pattern
Client-side tag aggregation - no server changes needed. Tags flow through existing gossip protocol.

---

## 2025-01-25: Viewer Reconnection Fixes

Fixed critical viewer reconnection bug and stabilized SFU track forwarding.

### Changes
- **CRITICAL**: PLI (Picture Loss Indication) keyframe requests for instant viewer reconnection
- SFU track forwarding with `addTransceiver()` instead of `addTrack()`
- Client `stop_viewing` message for proper cleanup
- WebSocket reconnection guards
- Race condition fixes between announce/signal_forward
- Consumer PC cleanup with proper track release

### Files Modified
- `server.js` - PLI requests, stop_viewing handler, consumer cleanup
- `index.html` - stop_viewing message, reconnection guards

### Pattern
New consumers need keyframes to decode video. Send PLI RTCP packets to producer on consumer join. Multiple PLI requests (0ms, 100ms, 500ms, 1000ms) ensure delivery.

See: [250125_viewer-reconnection-fixes.md](./250125_viewer-reconnection-fixes.md)

---

## 2025-01-24: Amplify, Thumbnails & UX

Built distributed amplification system and modernized UX.

### Changes
- Amplify mode (`?amplify=<streamId>`) for OBS capture
- Live thumbnails on stream cards (5-second interval)
- Viewer count tracking and display
- Sci-fi glass-morphism UX overhaul
- Connection status overlay with technical readout
- Hidden controls with hover/tap reveal

### Files Modified
- `server.js` - thumbnail storage, viewer count broadcasts
- `index.html` - Amplify module, Thumbnail module, CSS overhaul

### Pattern
Broadcaster captures canvas frame from video every 5 seconds. Server stores and broadcasts thumbnails. Amplify mode uses URL param for clean OBS-capturable window.

See: [250124_amplify-thumbnails-ux.md](./250124_amplify-thumbnails-ux.md)

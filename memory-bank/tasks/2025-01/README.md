# January 2025 Tasks

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

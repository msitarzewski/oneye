# oneye Quick Start

## What is oneye?
Decentralized P2P live streaming with distributed amplification. Single-page app with WebRTC streaming via relay servers connected through DHT (Hyperswarm).

## Tech Stack
- **Client**: Pure HTML5/JS, WebRTC, single `index.html` (~7200 lines)
- **Server**: Node.js, werift (WebRTC), Hyperswarm (DHT), ws (WebSocket)
- **No frameworks** - everything is vanilla JS with IIFE modules
- **Deployment**: `docs/index.html` = GitHub Pages copy of `index.html` (must stay in sync)
- **Production relay**: `oe-relay.zerologic.com` (Cloudflare in front), systemd user service on umacbookpro

## Key Patterns

### Module Pattern
```javascript
const ModuleName = (() => {
  let privateState = null;
  function privateFunc() {}
  return { publicMethod: () => {} };
})();
```

### CSS Variables
```css
--bg: #05050a;
--accent: #00d4ff;
--live: #ff3366;
--glass: rgba(13, 13, 20, 0.8);
```

### Stream Events
```javascript
Discovery.onStreamAvailable = (presence) => {
  UI.addStream(presence);
  TagIndex.addStream(presence);
  Sidebar.updateCounts();
};
```

### Relay URL Pattern
Client connects via WebSocket (`wss://`). For HTTP resources (archives, thumbnails, video), derive HTTP base URL:
```javascript
// Archives.getRelayHttpBase()
const wsUrl = Discovery.getCurrentRelay(); // wss://oe-relay.zerologic.com
return wsUrl.replace(/^ws(s?):\/\//, 'http$1://'); // https://oe-relay.zerologic.com
```
All archive resource URLs must be absolute (not relative) so the app works from any origin (GitHub Pages, localhost, relay itself).

### Recording Pipeline
werift MediaRecorder → raw WebM (broken headers) → ffmpeg remux (`-c copy`) → seekable WebM
- `disableNtp: true, disableLipSync: true` required — NTP timing waits for RTCP SRs that may never arrive on short streams
- Remux happens in `finalizeRecording()` after recorder stops

## Recent Changes (Jan 2025)

### Discovery Navigation System
- Collapsible sidebar with categories, tags, map
- Sidebar toggle moved to content area (left of search)
- Content views: live, archives, filtered
- Enhanced Go Live modal with tags/location
- Archive cards with collapsible tag disclosure

### UI Layout
```
[header: logo ... identity]
[sidebar] [toggle][search]
          [title] [count]
          [content grid]
[footer: status, title input, record toggle, go live]
```

## Common Tasks

### Add a new category
Edit `SUGGESTED_CATEGORIES` array in index.html

### Change sidebar behavior
Edit `Sidebar` module - `switchView()`, `updateCounts()`

### Modify stream cards
Edit `UI.createStreamCard()` or `Archives.createArchiveCard()`

### Change presence packet
Edit `goLive()` function in UI module where `presenceData` is created

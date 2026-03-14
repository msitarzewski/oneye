# Active Context - oneye

## Current State (2026-03-13)

### Recently Completed: README Makeover, Splash Screen, UX Polish

#### README Rewrite
- Complete rewrite with cyberpunk/mission-driven tone
- New header: dramatic tagline, badge row (Node.js, MIT, Single HTML File, PRs Welcome), live demo + repo + sponsor links
- Mission statement: protest streams, citizen journalism, censorship resistance framing
- All new features documented: Chat, Archives, Embeddable Player, Block/Mute
- Updated API section with `chat` WS message, `/archives`, `/archives/:id/delete`, `/embed` endpoints
- "Nothing is recorded" → "Ephemeral by default. Recording is opt-in."

#### Splash Screen
- CSS: `.splash-overlay` (fixed, z-index 1200, blur backdrop), `.splash-content` (520px box with accent glow), gradient title, accent lines, styled checkbox/buttons
- HTML: "// SIGNAL INTERCEPT" subtitle, manifesto text, checkbox + Enter/Disconnect buttons
- JS: `Splash` IIFE module, `localStorage` gate (`oneye:splash_accepted`), Enter key shortcut, Cancel → `about:blank`
- `await Splash.show()` gates `init()` — app stays inert until accepted

#### UX Polish
- Chat auto-opens when clicking a stream card (`Chat.open(streamId)` called on viewer open)
- Go Live button hidden while viewer overlay is active (`goLiveBtn.style.display = 'none'`)
- Both changes also apply to deep-link viewing

#### GitHub Sponsor
- `.github/FUNDING.yml` — enables Sponsor button on repo page
- README header: Sponsor link next to Live Demo and GitHub
- App footer: heart icon with tooltip, positioned next to GitHub icon, turns `var(--live)` on hover

---

### Previously: claudes-causes Release

Major feature release adding chat, archive management, block/mute, embeddable player, and CORS fixes.

#### New Modules
- **Chat** — IIFE module, server relay (`handleChat`), client panel (300px right side / mobile bottom 50vh), glass morphism, 100 message cap, auto-scroll
- **BlockList** — IIFE module, `localStorage` backed (`oneye:blocklist`), guards `onStreamAvailable` and `Chat.addMessage`
- **Embed** — `/embed` route serves self-contained HTML (live WebRTC + archive playback), `copyEmbedCode()` helper for iframe snippets

#### Archive Management
- Delete: `POST /archives/:id/delete` (POST not DELETE — Cloudflare intercepts OPTIONS and strips DELETE from allowed methods)
- Download: native `<a download>` button
- Embed: copy iframe snippet button
- Auto-play: gated behind `Settings.shouldAutoPlay()`
- Broken recordings < 1KB auto-cleaned in `finalizeRecording()`
- Track metadata (`tracks.video`, `tracks.audio`) added to recording metadata

#### CORS / CSP Fixes
- OPTIONS preflight handler with 204 early-return (works for non-Cloudflare, CF intercepts its own)
- CSP `media-src` now includes `https:` for cross-origin video loading from relay

#### Deployment
- oneye relay running as systemd user service on umacbookpro (`~/.config/systemd/user/oneye.service`)
- Linger enabled for boot persistence without login
- Cloudflare in front of oe-relay.zerologic.com — intercepts OPTIONS preflight (reason DELETE was changed to POST)
- GitHub Pages serves from `docs/index.html` — must be kept in sync with root `index.html`

---

### Previously: Recording Playback Fixes & Archive UI

---

### Previously: Location Reverse Geocoding

Implemented reverse geocoding so location displays human-readable names instead of coordinates.

#### Features
- Uses Nominatim (OpenStreetMap) API - no API key or CDN required
- Labels adapt to precision level (neighborhood → city → region → country)
- Address data cached for reformatting when precision changes
- Non-blocking: geocoding happens in background after position acquired

#### Implementation
- `reverseGeocode(lat, lng)` - calls Nominatim API
- `formatLabel(addrData)` - formats based on precision
- `currentLocation.addressData` caches full address components
- `currentLocation.label` updated after geocoding or precision change

---

### Previously: Server-Side Stream Recording

Restored server-side recording using werift's built-in WebM recording (no ffmpeg).

#### Features
- Records both audio (Opus) and video (VP8) to WebM container
- Saves thumbnail from last preview frame
- HTTP endpoints for archive index and file serving
- Archive playback in client with thumbnail display
- No external dependencies (all werift built-in)

---

### Previously: Relay Stats Display

Added live user count with activity breakdown in footer (bottom-left).

#### Features
- Shows total connected users to current relay
- Detailed breakdown: `👥 243 · 12 live · 200 watching`
- Real-time updates on connect/disconnect and role changes
- Styled to match connection indicator (right side)

#### Implementation
- Server tracks `broadcasters` (role=broadcaster) and `viewers` (role=viewer)
- New `relay_stats` message type broadcast on client connect/disconnect
- Stats included in welcome message for immediate display
- CSS: `.relay-stats`, `.relay-stats-detail`

---

### Previously: Viewer Controls & Z-Index Fixes

Modernized viewer controls UI and fixed modal z-index stacking issues with Leaflet map.

#### Viewer Controls
- SVG icons for PiP, Fullscreen, Pop Out buttons
- QR code sharing button for viewers
- Grouped controls with subtle dividers
- Glass morphism styling with 40px touch targets
- Accent glow on Amplify button

#### Z-Index Hierarchy (Fixed)
Leaflet map layers have high default z-indexes (tiles: 200, markers: 600+). Updated modal z-indexes:

| Element | Z-Index |
|---------|---------|
| `.settings-modal` | 1000 |
| `.modal` (amplify) | 1000 |
| `.broadcast-setup` | 950 |
| `.mobile-nav` | 900 |
| Leaflet popups | ~700 |
| `.viewer-overlay` | 100 |

---

### Previously: Settings System & Mobile UI

Implemented comprehensive Settings system with theme support, mobile-first navigation, and UI polish.

#### Key Files Modified
- `index.html` - Single-page app with all CSS/JS inline (~7200 lines)
- `README.md` - Updated features documentation
- `ARCHITECTURE.md` - Added client architecture section

#### New/Updated Modules (JavaScript IIFEs)

| Module | Purpose | Key Functions |
|--------|---------|---------------|
| `Settings` | User preferences with localStorage | `init()`, `get()`, `set()`, `applyTheme()`, `migrate()` |
| `MobileNav` | Mobile navigation overlay | `init()`, `open()`, `close()`, `setActiveView()` |
| `MapView` | Enhanced with theme support | `updateTiles()`, `getTheme()` |
| `Sidebar` | Grouped sections, auto-collapse | `toggleExpanded()`, `switchView()` |

#### Settings System

**Storage:** `oneye:settings` in localStorage

**Defaults:**
```javascript
{
  theme: 'system',           // 'system' | 'dark' | 'light'
  autoPlay: true,            // Auto-play streams on click
  locationAccess: false,     // Remember location permission
  locationPrecision: 'city', // 'exact' | 'neighborhood' | 'city' | 'region'
  notifications: false,      // Browser notifications
  defaultView: 'live',       // 'live' | 'archives' | 'map'
  sidebarExpanded: false     // Sidebar state (migrated from old key)
}
```

**Theme Application:**
- `data-theme="light"` or `data-theme="dark"` on `<html>`
- Remove attribute for system preference
- Triggers `MapView.updateTiles()` for theme-aware map

#### UI Structure (Updated)

```
[header: logo ... hamburger(mobile) ... identity]
─────────────────────────────────────────────────────────
[sidebar]          │  [toggle(desktop)] [search box]
 Navigation        │  Live Streams  0
  • Live           │  ─────────────────────────────────
  • Archives       │  [stream grid / archive grid / map / filter]
  • Map            │
 ─────────────     │
 Browse            │
  • Categories     │
  • Tags           │
 ─────────────     │
 Settings          │
─────────────────────────────────────────────────────────
[footer]         [Go Live]                          (i)
```

**Mobile Navigation (hamburger menu):**
- Tab bar: Live | Archives | Map
- Categories in 2-column grid
- Tags cloud
- Footer: Session ID, relay info, settings gear

**Settings Modal:**
- Appearance: Theme selector (System/Dark/Light)
- Playback: Auto-play toggle
- Privacy: Location access, precision, notifications
- Defaults: Default view selector

**Connection Indicator:**
- Info icon in footer (bottom-right, absolute positioned)
- Gray at 50% opacity when disconnected
- Green with glow when connected
- Custom tooltip on hover (desktop) or tap (mobile)

#### CSS Classes Added

- `[data-theme="light"]` - Light theme variables
- `.settings-modal`, `.settings-modal-backdrop` - Modal overlay
- `.settings-group`, `.settings-row` - Settings layout
- `.settings-toggle`, `.settings-select` - Form controls
- `.mobile-nav`, `.mobile-nav-tabs`, `.mobile-nav-tab` - Mobile navigation
- `.mobile-nav-categories`, `.mobile-nav-category` - 2-column grid
- `.mobile-menu-btn` - Hamburger in header
- `.connection-indicator`, `.connection-tooltip` - Footer status
- `.sidebar-group`, `.sidebar-divider` - Grouped sections
- `@keyframes btn-live-glow` - Go Live button animation

#### Data Flow (Settings)

```
User changes setting in modal
  → Settings.set(key, value)
  → localStorage.setItem('oneye:settings', JSON.stringify(settings))
  → Settings.applyTheme() if theme changed
  → document.documentElement.dataset.theme = 'light' | 'dark' | (removed)
  → MapView.updateTiles() swaps CartoDB dark/light
```

#### Integration Points

- `Settings.init()` called first in app initialization
- `Settings.shouldAutoPlay()` checked in RTC.ontrack
- `Settings.getDefaultView()` used in Sidebar.init()
- `Settings.isSidebarExpanded()` used for initial sidebar state
- `MobileNav.setActiveView()` synced with Sidebar.switchView()

### Architecture Notes

- **Sidebar toggle hidden on mobile** - Uses hamburger menu instead
- **Map integrated in content area** - Not a fixed overlay
- **Theme-aware map tiles** - CartoDB dark/light based on theme
- **Footer simplified** - Broadcast setup moved to modal
- **Tooltip toggle on mobile** - Click-to-toggle vs hover

### Known Issues / TODOs

1. ~~Archive cards don't have thumbnails~~ - Fixed: thumbnails saved on stream end
2. ~~Search only filters by title, not tags~~ - Fixed: now filters by title and tags
3. ~~Location reverse geocoding not implemented~~ - Fixed: uses Nominatim (OpenStreetMap) API
4. ~~Notifications permission request needs testing~~ - Works

### File Locations

- Main app: `/index.html` (everything inline)
- Server: `/server.js` (no changes needed)
- This doc: `/memory-bank/activeContext.md`
- Task doc: `/memory-bank/tasks/2025-01/260126_settings-ui-mobile.md`

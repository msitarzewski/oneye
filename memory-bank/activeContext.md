# Active Context - oneye

## Current State (2026-03-13)

### Recently Completed: Recording Playback Fixes & Archive UI

Fixed server-side stream recording and improved archive player UI.

#### Recording Fixes
- werift MediaRecorder writes WebM with unknown segment size and no Cues — browsers can't seek or determine duration
- Added ffmpeg remux step in `finalizeRecording()` to rewrite proper headers after recording stops (`server.js:~880`)
- Disabled NTP timing (`disableNtp: true, disableLipSync: true`) in MediaRecorder — NtpTimeCallback waits for RTCP Sender Reports which may never arrive on short streams, causing zero video frames
- Falls back gracefully if ffmpeg unavailable

#### Archive UI Fixes
- Switched `.archive-grid` from CSS `columns` to CSS `grid` — fixes shadow clipping and uneven card spacing
- Removed duplicate `.archive-card` CSS block (old version at ~line 1748, kept "Enhanced" version at ~line 2970)
- Consolidated archive player controls into centered top bar above video (`archive-topbar`) — title, meta, and close button in one row, max-width matched to video (900px)

#### Deployment
- oneye relay running as systemd user service on umacbookpro (`~/.config/systemd/user/oneye.service`)
- Linger enabled for boot persistence without login
- Cloudflare caching in front of oe-relay.zerologic.com — may need cache purge after recording remux changes file size

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

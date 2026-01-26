# Active Context - oneye

## Current State (2025-01-26)

### Recently Completed: Viewer Controls & Z-Index Fixes

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

1. Archive cards don't have thumbnails (server doesn't generate them yet)
2. Search only filters by title, not tags
3. Location reverse geocoding not implemented (shows coords)
4. Notifications permission request needs testing

### File Locations

- Main app: `/index.html` (everything inline)
- Server: `/server.js` (no changes needed)
- This doc: `/memory-bank/activeContext.md`
- Task doc: `/memory-bank/tasks/2025-01/260126_settings-ui-mobile.md`

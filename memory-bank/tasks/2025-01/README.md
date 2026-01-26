# January 2025 Tasks

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

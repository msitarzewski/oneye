# 260126_settings-ui-mobile

## Objective
Implement a comprehensive Settings system with localStorage persistence, light/dark theme support, mobile navigation, and UI improvements.

## Outcome
- Settings persist across sessions via localStorage
- Full light theme with system preference detection
- Mobile-first navigation with hamburger menu
- Map view integrated into content area
- Simplified, polished footer with connection indicator

## Files Modified
- `index.html` - All changes (single-page app)
- `README.md` - Updated features documentation
- `ARCHITECTURE.md` - Added client architecture section

## Features Implemented

### Settings System
- Storage key: `oneye:settings`
- Theme: system/dark/light with CSS custom properties
- Auto-play: Control stream autoplay behavior
- Location: Remember permission and default precision
- Notifications: Browser notification toggle
- Default view: Start with live/archives/map
- Sidebar state: Persist expanded/collapsed

### Light Theme CSS
- Full light theme via `[data-theme="light"]` selector
- System preference support via `prefers-color-scheme`
- Theme-aware map tiles (CartoDB dark/light)

### Settings Modal
- Appearance section: Theme selector
- Playback section: Auto-play toggle
- Privacy section: Location, precision, notifications
- Defaults section: Default view selector
- Accessible via sidebar and mobile nav

### Mobile Navigation
- Hamburger menu in header (mobile only)
- Tab bar: Live | Archives | Map
- Categories in 2-column grid
- Tags section
- Footer with session ID, relay info, settings gear

### Sidebar Improvements
- Grouped sections with dividers
- Navigation group: Live, Archives, Map
- Browse group: Categories, Tags
- Settings trigger at bottom
- Auto-expand on category/tag click when collapsed
- Auto-collapse after selection

### Map View Integration
- Moved from overlay to content area
- Always shows map (no empty state)
- Theme-aware CartoDB tiles
- Responsive height calculation

### Footer Simplification
- Removed title input, record checkbox, flip button
- Centered Go Live button with glow animation
- Connection indicator (info icon, bottom-right)
- Green glow when connected, gray when disconnected
- Custom tooltip on hover/tap

### Broadcast Setup Modal
- Title, categories, tags moved from footer
- Location toggle with precision selector
- Recording option
- Clean Go Live flow

## Integration Points
- `Settings.init()` called at app startup
- `Settings.applyTheme()` updates CSS and map tiles
- `Sidebar.switchView()` handles all view transitions
- `MobileNav` syncs with sidebar state
- `MapView.updateTiles()` responds to theme changes

## Patterns Applied
- IIFE module pattern for all new modules
- localStorage with JSON serialization
- CSS custom properties for theming
- Event delegation for dynamic elements
- Optional chaining for safe DOM access

## Testing Notes
1. Theme: Toggle dark/light/system, verify persistence
2. Mobile nav: Test hamburger, tabs, category grid
3. Map: Verify theme-aware tiles, responsive sizing
4. Settings: Verify all toggles persist
5. Connection indicator: Verify tooltip on tap/hover

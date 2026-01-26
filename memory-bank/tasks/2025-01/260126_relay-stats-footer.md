# 260126_relay-stats-footer

## Objective
Add live connected user count with activity breakdown to footer, and make footer fixed with glass morphism styling.

## Outcome
- ✅ Footer shows real-time relay stats: total users, broadcasters, viewers
- ✅ Footer fixed at bottom with translucent glass effect
- ✅ Content area scrolls behind fixed footer
- ✅ Light/dark theme support

## Files Modified

### server.js
- `broadcastRelayStats()` - broadcasts client count with role breakdown
- `getRelayStats()` - counts clients by role (broadcaster/viewer/idle)
- Added broadcast calls on: connect, disconnect, announce, unannounce, view, stop_viewing
- Welcome message includes initial stats

### index.html
- **HTML**: Added `.relay-stats` element with people icon and count spans
- **CSS**:
  - `.relay-stats`, `.relay-stats-detail` - positioned bottom-left
  - `footer` - fixed positioning, enhanced glass morphism (gradient, blur, shadow)
  - `[data-theme="light"] footer` - light theme variant
  - `main` - `overflow: auto`, `padding-bottom: 70px` for scroll space
- **JS**:
  - `updateRelayStats(clients, broadcasters, viewers)` in Discovery module
  - Handlers for `welcome` and `relay_stats` messages

## Display Format
- Idle: `👥 5`
- Active: `👥 243 · 12 live · 200 watching`
- Partial: `👥 50 · 3 live` (when viewers = 0)

## Patterns Applied
- Mirrors `connection-indicator` positioning pattern (right → left for stats)
- Uses existing `broadcast()` infrastructure
- Follows `viewer_count` message handling pattern
- Glass morphism consistent with header styling

## Integration Points
- `server.js:broadcastRelayStats()` called from 7 locations
- `Discovery.handleMessage()` processes `relay_stats` and `welcome` messages
- DOM elements: `#relayUsersCount`, `#relayStatsDetail`

## Footer Glass Effect
```css
background: linear-gradient(
  to bottom,
  rgba(13, 13, 20, 0.7),
  rgba(13, 13, 20, 0.85)
);
backdrop-filter: blur(24px) saturate(180%);
box-shadow: 0 -4px 30px rgba(0, 0, 0, 0.15);
```

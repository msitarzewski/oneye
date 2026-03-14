# 130326_readme-splash-ux

## Objective
README makeover with cyberpunk/mission-driven tone, splash screen for first-visit experience, UX polish (chat visibility, Go Live button), and GitHub Sponsor integration.

## Outcome
- README completely rewritten with mission framing, all features documented
- Splash screen gates app init until user accepts
- Chat auto-opens when viewing a stream
- Go Live button hidden during stream viewing
- Sponsor link in three places (FUNDING.yml, README, app footer)

## Files Modified
- `README.md` — complete rewrite
- `index.html` — splash CSS/HTML/JS, chat auto-open, Go Live hide, sponsor link in footer
- `docs/index.html` — synced copy
- `.github/FUNDING.yml` — created (enables GitHub Sponsor button)

## Key Implementation Details

### Splash Screen
- CSS: `.splash-overlay` at z-index 1200, `.splash-content` max-width 520px with accent glow shadow
- HTML: inserted after `<body>`, before `<header>`
- JS: `Splash` IIFE module with `show()` returning Promise, localStorage key `oneye:splash_accepted`
- `await Splash.show()` is first line of `init()` — app stays inert behind splash

### Chat Auto-Open
- `Chat.open(presence.stream.id)` added to stream card click handler and deep-link viewer
- `Chat.close()` already called in `hideViewer()`

### Go Live Button
- `goLiveBtn.style.display = 'none'` on viewer open
- `goLiveBtn.style.display = ''` on viewer close (hideViewer)

### Sponsor Link
- Footer: heart SVG icon, `.sponsor-link` class at `right: 84px`, `.sponsor-tooltip` on hover
- Turns `var(--live)` pink on hover

## Patterns Applied
- IIFE module pattern (Splash follows BlockList/Chat pattern)
- localStorage for persistence (`oneye:splash_accepted`)
- CSS variables for theme compatibility

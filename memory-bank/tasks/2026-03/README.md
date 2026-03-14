# March 2026 Tasks

## 2026-03-13: README Makeover, Splash Screen, UX Polish

- README rewritten with cyberpunk/mission-driven tone, all features documented
- Splash screen with localStorage gate, manifesto UI, Enter/Disconnect flow
- Chat auto-opens on stream view, Go Live button hidden during viewing
- GitHub Sponsor: `.github/FUNDING.yml`, README link, app footer heart icon
- Files: `README.md`, `index.html`, `docs/index.html`, `.github/FUNDING.yml`
- See: [130326_readme-splash-ux.md](./130326_readme-splash-ux.md)

## 2026-03-13: claudes-causes Release

Added chat, archive management (delete/download), block/mute, embeddable player, and CORS fixes.

### Changes
- CORS preflight handler (OPTIONS 204)
- Archive delete via `POST /archives/:id/delete` (Cloudflare blocks DELETE in preflight)
- Archive auto-play, download button, embed button
- Chat module — server relay + client panel with glass morphism UI
- BlockList module — localStorage-backed, guards streams and chat
- Embeddable player at `/embed` route — supports live + archive via hash params
- CSP `media-src https:` fix for cross-origin video loading
- Broken recordings (< 1KB) auto-cleaned

### Files Modified
- `server.js` — routes, chat handler, embed HTML generator, CSP, recording cleanup
- `index.html` — Chat, BlockList, embed share, archive UI buttons, CSS
- `docs/index.html` — synced copy

See: [130326_claudes-causes.md](./130326_claudes-causes.md)

# 260126_viewer-controls-zindex

## Objective
Modernize viewer controls UI and fix z-index stacking issues with Leaflet map.

## Outcome
- Viewer controls match modern glass morphism aesthetic
- QR code sharing added for viewers
- All modals properly stack above Leaflet map layers

## Files Modified
- `index.html` - CSS and HTML updates

## Changes

### Viewer Controls Modernization
- Added SVG icons for PiP (picture-in-picture), Fullscreen, Pop Out buttons
- Added star icon to "Amplify" link
- Grouped controls with `.viewer-control-group` and subtle dividers
- Larger touch-friendly buttons (40px on desktop, 36px on mobile)
- Modern glass morphism styling with rounded corners (16px container, 10px buttons)
- Hover effects with scale transforms
- Accent glow on Amplify button with border

### QR Code Sharing for Viewers
- Added QR button to viewer controls (same icon as broadcaster)
- Added `.viewer-qr-overlay` with container and hint text
- JavaScript generates QR with current URL on button click
- Tap overlay to dismiss

### Z-Index Fixes
Leaflet map layers have high default z-indexes (tiles: 200, markers: 600+), causing modals to appear behind the map.

**Updated z-indexes:**
| Element | Old | New |
|---------|-----|-----|
| `.settings-modal` | 100 | 1000 |
| `.modal` (amplify help) | 200 | 1000 |
| `.broadcast-setup` | 90 | 950 |
| `.mobile-nav` | 90 | 900 |

## CSS Classes Added/Modified
- `.viewer-control-group` - Flexbox group with divider
- `.viewer-controls button` - 40px touch targets, 10px radius
- `.viewer-controls select` - Styled dropdown with custom arrow
- `.viewer-controls .amplify-link` - Accent glow button style
- `.viewer-qr-overlay` - Centered white QR display

## Integration Points
- `Amplify.init()` sets up viewerQrBtn click handler
- QR uses existing `window.QRCode` library
- Overlay toggled via `.visible` class

## Testing Notes
1. Viewer controls appear on stream hover
2. QR button generates code with current URL
3. Settings modal appears above map
4. Mobile nav appears above map
5. Broadcast setup appears above map

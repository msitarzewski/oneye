# 250124_amplify-thumbnails-ux

## Objective
Build distributed amplification system and modernize UX for live streaming platform.

## Outcome
- ✅ Amplify mode for OBS capture and restreaming
- ✅ Live thumbnails on stream cards
- ✅ Viewer count tracking
- ✅ Sci-fi glass-morphism UX overhaul
- ✅ Connection status overlay
- ✅ Hidden controls with hover/tap reveal

## Features Built

### 1. Distributed Amplification (Core Feature)
- **Amplify Mode** (`?amplify=<streamId>` URL param) - Clean borderless window for OBS capture
- **Pop Out button** - Opens amplify window
- **PiP / Fullscreen** - Native browser APIs
- **Quality selector** - 720p/360p/180p layer requests
- **Stream title** - Broadcaster sets title, viewers see it
- **Help modal** - Instructions for amplifiers

### 2. Viewer Count
- Server tracks `stream.consumers.size`
- Broadcasts `viewer_count` messages on join/leave
- Shows in broadcaster preview ("X watching")
- Shows on stream cards

### 3. Thumbnails
- Broadcaster captures frame every 5 seconds from video
- **Detects orientation** - Portrait vs landscape preserved
- Server stores and broadcasts to all clients
- Stream cards show live preview image

### 4. Sci-Fi UX Overhaul
- New color palette: cyan `#00d4ff`, purple accents
- Glass-morphism (blur + transparency)
- Masonry grid for stream cards (adapts to portrait/landscape)
- Glowing hover effects, smooth animations
- Monospace fonts for technical info

### 5. Connection Status Overlay
- Shows while connecting to stream
- Technical readout: RELAY, SIGNAL, ICE, TRACKS
- Progress bar advances through connection stages
- 10-second timeout shows "CONNECTION FAILED"

### 6. Hidden Controls
- Viewer controls hidden until hover (desktop) or tap (mobile)
- Auto-hide after 3 seconds on mobile
- Close button also hidden until interaction

## Key Code Locations

### Client (index.html)
- `Thumbnail` module: ~line 1096
- `Amplify` module: ~line 1150
- Connection overlay HTML: ~line 680
- Sci-fi CSS variables: ~line 10

## Patterns Applied
- URL param `?amplify=<id>` for dedicated capture mode
- Server-side thumbnail storage and broadcast
- Consumer tracking via `stream.consumers` Map
- CSS custom properties for theming

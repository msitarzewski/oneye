# Server-Side Stream Recording

**Date**: 2025-01-26
**Status**: Complete

## Objective

Restore server-side recording using werift's built-in WebM recording (no ffmpeg dependency).

## Implementation

### Architecture

```
RTP Packets → MediaRecorder → WebmFactory → recording.webm
     ↓              ↓             ↓
track.onReceiveRtp  (subscribes)  saveToFileSystem
```

Uses `werift/nonstandard` module's MediaRecorder which internally handles:
- RtpSourceCallback / RtcpSourceCallback for RTP streams
- DepacketizeCallback for codec frame extraction
- LipsyncCallback for audio/video synchronization
- WebmCallback for container writing

### Server Changes (`server.js`)

**Imports Added**:
```javascript
import { mkdir, writeFile, readFile as fsReadFile, stat } from 'fs/promises';
import { createReadStream } from 'fs';
import path from 'path';
```

**New Import**:
```javascript
let weriftNonstandard;
weriftNonstandard = await import('werift/nonstandard');
```

**HTTP Endpoints**:
- `GET /archives` - Returns index.json with archive list
- `GET /archives/:id/*` - Serves recording files (webm, json, jpg/png)

**Recording State** (in stream entry when `presence.stream.recording === true`):
```javascript
recording: {
  startedAt: Date.now(),
  dir: path.join(ARCHIVES_DIR, streamId),
  recorder: null,        // MediaRecorder instance
  pendingTracks: [],     // Tracks awaiting recorder init
  peakViewers: 0,
  thumbnailExt: null     // Set when thumbnail saved
}
```

**Key Functions**:
- `startTrackRecording(stream, track)` - Called in pc.ontrack, initializes MediaRecorder when both audio+video tracks received
- `stopRecording(streamId, stream)` - Stops recorder, saves thumbnail, calls finalizeRecording
- `finalizeRecording(streamId, stream)` - Creates metadata.json, updates index.json
- `updateArchiveIndex(entry)` - Maintains archives/index.json

### Client Changes (`index.html`)

**Archive Playback URL Fixed**:
```javascript
// Was: /archive/${archive.id}/video
// Now: /${archive.storage.path}
```

**Thumbnail Display**:
```javascript
const thumbnailUrl = archive.thumbnail ? `/${archive.thumbnail}` : null;
// Renders <img> in archive card preview
```

### File Structure

```
archives/
├── index.json                    # Archive index
└── {streamId}/
    ├── recording.webm            # Video+audio recording
    ├── metadata.json             # Stream metadata
    └── thumbnail.jpg             # Last preview frame
```

### Metadata Schema

```json
{
  "id": "streamId",
  "version": 1,
  "broadcaster": { "pubkey": "...", "signature": "..." },
  "title": "Stream Title",
  "tags": [],
  "recording": {
    "startedAt": 1706300000000,
    "endedAt": 1706300060000,
    "duration": 60,
    "format": "webm",
    "size": 1234567
  },
  "storage": { "type": "local", "path": "archives/{id}/recording.webm" },
  "thumbnail": "archives/{id}/thumbnail.jpg",
  "stats": { "peakViewers": 5 },
  "visibility": "public",
  "hlsReady": false
}
```

## Integration Points

| Location | Action |
|----------|--------|
| `server.js` imports | fs/promises, path, createReadStream |
| `server.js:15` | Import werift/nonstandard |
| `server.js:103` | /archives endpoints |
| `server.js:337` | Stream entry with recording state |
| `server.js:800` | startTrackRecording() in pc.ontrack |
| `server.js:280,1111` | stopRecording() in unannounce/disconnect |
| `server.js:420` | Peak viewer tracking |

## Verification

1. Start server with recording-enabled stream
2. Check console for `[Recording] Started: ...` and track logs
3. End stream, verify `[Recording] Finalized: ...`
4. Check archives/ for webm, metadata.json, thumbnail
5. Play recording in Archives view
6. Verify both audio and video streams (use ffprobe)

## No External Dependencies

Uses only werift's built-in recording - no ffmpeg required. All processing happens in-process using werift's RTP/WebM pipeline.

## Content Types

Server serves archives with proper MIME types:
- `.webm` → `video/webm`
- `.json` → `application/json`
- `.jpg/.jpeg` → `image/jpeg`
- `.png` → `image/png`
- `.webp` → `image/webp`

# 000000_backlog

## Purpose
Tracks pending features and known issues. Update status as items are completed.

---

## PRIORITY: Server-Side Recording

**Status**: 🔴 Lost in revert - needs reimplementation

**Context**: Implementation was working but never committed to git. Lost during a revert. Archives from Jan 25 exist but code is gone.

**What it did**:
- Saved RTP files separately (audio + video) when `recording: true` in presence
- Muxed RTP files into usable format (WebM) using ffmpeg
- Stored in `archives/` folder with `index.json` manifest
- `/archives` GET endpoint to list recordings

**What exists**:
- `archives/` folder with old recordings from Jan 25
- `archives/index.json` with metadata structure
- Client UI for "Record this stream" checkbox
- Client calls `/archives` endpoint (currently 404s)

**Implementation steps**:
1. Add `/archives` GET endpoint in server.js - serve index.json
2. Add `/archives/:id/*` for serving recording files
3. Capture RTP packets from werift producer tracks when recording enabled
4. Save raw RTP to temp files during stream
5. On stream end, mux with ffmpeg: `ffmpeg -i audio.rtp -i video.rtp -c copy output.webm`
6. Update index.json with new archive entry
7. Clean up temp RTP files

**Dependencies**: ffmpeg (should be installed)

---

## QR Code for In-Person Sharing

**Status**: 🟡 Partially implemented - QR codes don't scan

**Goal**: Display scannable QR code in bottom-right corner of broadcaster preview for easy in-person sharing.

**What was tried**:
1. Custom minimal QR implementation - bugs in masking/format info placement
2. Minified qrcode-generator (Kazuhiko Arase) - still produces unscannable codes

**Next steps**:
- [ ] Use original unminified qrcode-generator source and verify it works standalone
- [ ] Try Project Nayuki's QR Code generator (public domain, well-tested)
- [ ] Test with short static string first (e.g., "https://example.com") to isolate issue
- [ ] Check if URL encoding is causing issues (special chars, length)
- [ ] Consider generating QR server-side and sending as data URL

**Files involved**:
- `index.html`: QR module (currently stubbed), canvas element, CSS for positioning
- HTML: `<canvas class="qr-code" id="qrCode">` in `.local-preview`
- CSS: `.local-preview .qr-code` styles (positioned bottom-right)
- JS: `QR.toCanvas(canvas, url, cellSize)` called in `goLive()`

**Constraints**:
- Must be CDN-free (no external API calls)
- Must work offline
- Inline JS only (single-file deployment)

---

## Future Ideas

| Feature | Status | Notes |
|---------|--------|-------|
| Stream titles | ✅ Done | Implemented in 250124 |
| Viewer count display | ✅ Done | Implemented in 250124 |
| Picture-in-picture | ✅ Done | Implemented in 250124 |
| Chat/reactions | 🔵 Idea | Ephemeral, no persistence |
| Screen sharing | 🔵 Idea | Alternative to camera |

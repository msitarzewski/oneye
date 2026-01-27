# 250125_viewer-reconnection-fixes

## Objective
Fix critical viewer reconnection issues and stabilize SFU track forwarding.

## Outcome
- ✅ Viewers can reconnect to streams instantly (was ~80 second delay)
- ✅ Clean consumer PC lifecycle management
- ✅ WebSocket reconnection guards prevent race conditions
- ✅ Race condition between announce/signal_forward resolved

## Critical Fix: Keyframe Request (PLI)

**Problem**: When a viewer disconnected and reconnected to the same stream, video wouldn't play for ~80 seconds.

**Root Cause**: New consumers need a **keyframe** to start decoding H.264/VP8 video. Without it, they wait until the next natural keyframe (which could be 60-90 seconds in some encoders).

**Solution**: Send **PLI (Picture Loss Indication)** RTCP requests to the producer when a new consumer joins. This forces the encoder to emit a keyframe immediately.

```javascript
// In createConsumerOffer, after sending offer:
const requestKeyframe = () => {
  const producerTransceivers = stream.producerPC.getTransceivers?.() || [];
  for (const t of producerTransceivers) {
    if (t.receiver?.track?.kind === 'video' && t.receiver.sendRtcpPLI) {
      t.receiver.sendRtcpPLI(ssrc);
    }
  }
};
// Send multiple times to ensure delivery
requestKeyframe();
setTimeout(requestKeyframe, 100);
setTimeout(requestKeyframe, 500);
setTimeout(requestKeyframe, 1000);
```

**Reference**: https://github.com/shinyoshiaki/werift-webrtc/issues/247

## Other Fixes

### SFU Track Forwarding
**Problem**: Using `addTrack()` vs `addTransceiver()` for forwarding tracks.
**Solution**: Use `addTransceiver(track, { direction: 'sendonly' })` for proper SFU forwarding in werift.

### Client `stop_viewing` Message
**Problem**: Server didn't know when viewer stopped watching (only when WebSocket closed).
**Solution**: Client sends `stop_viewing` message when stopping, server cleans up consumer PC and updates viewer count immediately.

```javascript
// Client - in stopViewing():
if (currentStreamId) {
  Discovery.send({ type: 'stop_viewing', streamId: currentStreamId });
}
```

### WebSocket Reconnection Guards
**Problem**: Multiple simultaneous connection attempts causing failures.
**Solution**: Added guards in `connect()`:
- `isConnecting` flag
- `lastConnectAttempt` timestamp (min 1s between attempts)
- Check for existing OPEN/CONNECTING/CLOSING states
- Clear old ws reference before reconnecting

### Duplicate `can_forward` Messages
**Problem**: `maybeEnable()` called twice (once per track in `ontrack`).
**Solution**: Check if already enabled for this stream before sending:
```javascript
if (enabled && currentStreamId === streamId) return;
```

### Race Condition: `announce` vs `signal_forward`
**Problem**: `signal_forward` could arrive before `announce` completed (async verification), causing `tracks=0`.
**Solution**:
- `signal_forward` now sets role/streamId if not set
- `handleBroadcasterOffer` creates stream if missing
- `handleAnnounce` preserves existing stream data instead of overwriting

### Consumer PC Cleanup
**Problem**: Old consumer PCs not releasing tracks properly for reuse.
**Solution**: Stop transceivers and replace tracks with null before closing:
```javascript
const transceivers = state.consumerPC.getTransceivers?.() || [];
for (const t of transceivers) {
  if (t.sender?.track) t.sender.replaceTrack(null);
  t.stop?.();
}
state.consumerPC.close();
```

### Fresh Track References
**Problem**: Stored track objects might have stale internal state.
**Solution**: Get fresh track references from producer PC transceivers each time:
```javascript
const transceivers = stream.producerPC.getTransceivers?.() || [];
validTracks = transceivers.filter(t => t.receiver?.track).map(t => t.receiver.track);
```

## Key Code Locations

### Client (index.html)
- `Forwarder.maybeEnable`: ~line 1978
- `RTC` module: ~line 2190
- `startViewing`: ~line 2232
- `stopViewing`: ~line 2429
- `Discovery.connect`: ~line 1328

### Server (server.js)
- `handleView`: ~line 285
- `handleStopViewing`: ~line 338
- `handleSignalForward`: ~line 560
- `handleBroadcasterOffer`: ~line 608
- `createConsumerOffer`: ~line 726
- `requestKeyframe` (PLI): ~line 800
- `handleDisconnect`: ~line 850
- `broadcastViewerCount`: ~line 1080

## Lessons Learned

1. **Keyframes are critical for SFU**: New consumers can't decode video without a keyframe. Always send PLI when new consumer joins.

2. **werift track reuse**: Tracks can be reused but need proper cleanup and keyframe requests.

3. **Race conditions in async handlers**: When messages can arrive in any order, each handler must be defensive about missing state.

4. **WebSocket reconnection**: Need multiple guards to prevent simultaneous connection attempts.

5. **Console noise**: Filter out frequent messages (`thumbnail`, `candidate`, `bandwidth_report`, `ping`) from logs.

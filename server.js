import { createServer } from 'http';
import { readFile } from 'fs/promises';
import { WebSocketServer } from 'ws';
import Hyperswarm from 'hyperswarm';
import crypto from 'crypto';
import { WebSocket } from 'ws';
import os from 'os';

// werift imported dynamically to handle missing native deps gracefully
let werift;
try {
  werift = await import('werift');
  console.log('[SFU] werift loaded successfully');
} catch (e) {
  console.warn('[SFU] werift unavailable, WebRTC disabled:', e.message);
}

const PORT = parseInt(process.env.PORT || '3000', 10);
const PUBLIC_URL = process.env.PUBLIC_URL || null; // e.g., wss://relay.example.com
const TOPIC = crypto.createHash('sha256').update('oneye:live-streams:v1').digest();
const PRESENCE_TTL = 30_000; // 30s expiry for stale streams
const PING_INTERVAL = 30_000;
const RELAY_ANNOUNCE_INTERVAL = 30_000;

// Generate relay keypair for signing relay announcements
const relayKeyPair = crypto.generateKeyPairSync('ed25519');
const relayPubkeyHex = relayKeyPair.publicKey.export({ type: 'spki', format: 'der' }).subarray(12).toString('hex');

// --- State ---
const streams = new Map();       // streamId -> { presence, producers: Map<trackId, MediaStreamTrack>, consumers: Set<ws>, remote?, originRelay? }
const clients = new Map();       // ws -> { pubkey, subscribed, peerConnection, role }
const knownRelays = new Map();   // url -> { url, pubkey, lastSeen, latency }
const forwarders = new Map();    // streamId -> Set<{ ws, peerId, slots }>
const originConnections = new Map(); // streamId -> WebSocket (for cross-relay forwarding)

// --- Get public relay URL ---
function getPublicUrl() {
  if (PUBLIC_URL) return PUBLIC_URL;
  // Try to construct from hostname
  const hostname = os.hostname();
  const proto = PORT === 443 ? 'wss' : 'ws';
  return `${proto}://${hostname}:${PORT}`;
}

// --- HTTP Server ---
const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  // Serve index.html for root or /index.html (supports subpath deployment)
  if (pathname === '/' || pathname.endsWith('/index.html') || pathname.endsWith('/')) {
    try {
      const html = await readFile(new URL('./index.html', import.meta.url));
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    } catch {
      res.writeHead(500);
      res.end('index.html not found');
    }
  } else if (pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      ok: true,
      streams: streams.size,
      clients: clients.size,
      relays: knownRelays.size,
      forwarders: forwarders.size
    }));
  } else if (pathname === '/.well-known/oneye.json') {
    // Well-known endpoint for relay discovery (Phase 5.1)
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      relays: [
        { url: getPublicUrl(), pubkey: relayPubkeyHex },
        ...Array.from(knownRelays.values()).map(r => ({ url: r.url, pubkey: r.pubkey }))
      ]
    }));
  } else if (pathname === '/relays') {
    // Relay list endpoint
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      self: { url: getPublicUrl(), pubkey: relayPubkeyHex },
      peers: Array.from(knownRelays.values())
    }));
  } else if (pathname === '/client-metadata.json') {
    // OAuth client metadata for Bluesky AT Protocol OAuth
    const proto = req.headers['x-forwarded-proto'] || (PORT === 443 ? 'https' : 'http');
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const baseUrl = `${proto}://${host}`;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      client_id: `${baseUrl}/client-metadata.json`,
      client_name: 'oneye Live Streaming',
      client_uri: baseUrl,
      redirect_uris: [`${baseUrl}/`],
      scope: 'atproto transition:generic',
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
      application_type: 'web',
      dpop_bound_access_tokens: true
    }));
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

// --- WebSocket Server ---
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  const clientState = { pubkey: null, subscribed: false, peerConnection: null, role: null, streamId: null };
  clients.set(ws, clientState);

  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  ws.on('message', (data) => {
    let msg;
    try {
      msg = JSON.parse(data);
    } catch {
      return send(ws, { type: 'error', message: 'Invalid JSON' });
    }
    // Reduce noise from frequent messages
    if (!['candidate', 'bandwidth_report', 'ping', 'thumbnail'].includes(msg.type)) {
      console.log(`[WS] Received: ${msg.type}`);
    }
    handleMessage(ws, msg);
  });

  ws.on('close', () => {
    handleDisconnect(ws);
    clients.delete(ws);
    broadcastRelayStats();
  });

  ws.on('error', () => {
    handleDisconnect(ws);
    clients.delete(ws);
    broadcastRelayStats();
  });

  // Include relay list in welcome (Phase 1.3)
  const streamList = getStreamList();
  console.log(`[Welcome] New client, sending ${streamList.length} streams`);
  const stats = getRelayStats();
  send(ws, {
    type: 'welcome',
    streams: streamList,
    relays: getRelayList(),
    ...stats
  });

  // Broadcast updated client count to all
  broadcastRelayStats();
});

// Ping interval
const pingTimer = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (!ws.isAlive) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, PING_INTERVAL);

wss.on('close', () => clearInterval(pingTimer));

// --- Message Handlers ---
function handleMessage(ws, msg) {
  switch (msg.type) {
    case 'subscribe':
      return handleSubscribe(ws, msg);
    case 'announce':
      return handleAnnounce(ws, msg);
    case 'unannounce':
      return handleUnannounce(ws, msg);
    case 'view':
      return handleView(ws, msg);
    case 'stop_viewing':
      return handleStopViewing(ws, msg);
    case 'signal_forward':
      return handleSignalForward(ws, msg);
    case 'answer':
      return handleAnswer(ws, msg);
    case 'candidate':
      return handleCandidate(ws, msg);
    // Phase 3.3: Bandwidth reporting for layer selection
    case 'bandwidth_report':
      return handleBandwidthReport(ws, msg);
    // Phase 4: Mesh forwarding
    case 'can_forward':
      return handleCanForward(ws, msg);
    case 'forward_stopped':
      return handleForwardStopped(ws, msg);
    case 'forward_slots':
      return handleForwardSlots(ws, msg);
    case 'forward_candidate':
      return handleForwardCandidate(ws, msg);
    case 'thumbnail':
      return handleThumbnail(ws, msg);
    case 'ping':
      return send(ws, { type: 'pong' });
    default:
      return send(ws, { type: 'error', message: `Unknown type: ${msg.type}` });
  }
}

function handleSubscribe(ws, msg) {
  const state = clients.get(ws);
  if (msg.pubkey) state.pubkey = msg.pubkey;
  state.subscribed = true;
  // Include relay list (Phase 1.3)
  send(ws, {
    type: 'subscribed',
    streams: getStreamList(),
    relays: getRelayList()
  });
}

function handleUnannounce(ws, msg) {
  const { streamId } = msg;
  const state = clients.get(ws);

  console.log(`[Unannounce] Stream ${streamId?.slice(0,8)} ending`);

  // Verify this client owns the stream
  if (state.streamId !== streamId) {
    return send(ws, { type: 'error', message: 'Not your stream' });
  }

  const stream = streams.get(streamId);
  if (stream) {
    // Close producer PC
    if (stream.producerPC) {
      try { stream.producerPC.close(); } catch {}
    }
    // Notify consumers
    stream.consumers.forEach((viewer) => {
      send(viewer, { type: 'stream_gone', streamId });
      const viewerState = clients.get(viewer);
      if (viewerState?.consumerPC) {
        try { viewerState.consumerPC.close(); } catch {}
        viewerState.consumerPC = null;
      }
    });
    // Clean up
    forwarders.delete(streamId);
    streams.delete(streamId);
    broadcast({ type: 'stream_gone', streamId }, ws);
    console.log(`[Unannounce] Stream removed, total: ${streams.size}`);
  }

  // Reset client state
  state.role = null;
  state.streamId = null;

  send(ws, { type: 'unannounced', streamId });
  broadcastRelayStats();
}

async function handleAnnounce(ws, msg) {
  console.log('[Announce] Processing announce request');
  const { presence } = msg;
  if (!presence || !presence.pubkey || !presence.signature || !presence.stream) {
    console.log('[Announce] Invalid presence packet:', { presence: !!presence, pubkey: !!presence?.pubkey, sig: !!presence?.signature, stream: !!presence?.stream });
    return send(ws, { type: 'error', message: 'Invalid presence packet' });
  }

  // Verify Ed25519 signature
  const valid = await verifyPresence(presence);
  if (!valid) {
    console.log('[Announce] Signature verification failed');
    return send(ws, { type: 'error', message: 'Invalid signature' });
  }

  const streamId = presence.stream.id;
  const state = clients.get(ws);
  state.pubkey = presence.pubkey;
  state.role = 'broadcaster';
  state.streamId = streamId;

  // Check if stream already exists (created by signal_forward race condition)
  const existing = streams.get(streamId);
  if (existing) {
    // Update presence but keep existing tracks and PC
    existing.presence = presence;
    existing.lastSeen = Date.now();
  } else {
    streams.set(streamId, {
      presence,
      producerPC: null,
      producerTracks: [],
      consumers: new Set(),
      lastSeen: Date.now()
    });
  }

  // Notify all subscribers
  broadcast({ type: 'stream_available', presence }, ws);

  // Announce to DHT
  announceToSwarm(presence);

  send(ws, { type: 'announced', streamId });
  broadcastRelayStats();
  console.log(`[Announce] Stream ${streamId.slice(0, 8)} from ${presence.pubkey.slice(0, 8)}, total streams: ${streams.size}, broadcasting to ${clients.size - 1} clients`);
}

async function handleView(ws, msg) {
  const { streamId, viaForwarder } = msg;
  console.log(`[View] Viewer requesting stream ${streamId?.slice(0,8)}`);
  const stream = streams.get(streamId);
  if (!stream) {
    console.log('[View] Stream not found');
    return send(ws, { type: 'error', message: 'Stream not found' });
  }
  console.log(`[View] Stream found, remote=${stream.remote}, tracks=${stream.producerTracks?.length}`);


  const state = clients.get(ws);

  // Clean up existing consumer PC if re-viewing - release tracks first
  if (state.consumerPC) {
    console.log('[View] Closing existing consumer PC before creating new one');
    try {
      // Stop all senders to release tracks before closing
      const transceivers = state.consumerPC.getTransceivers?.() || [];
      for (const t of transceivers) {
        try {
          if (t.sender?.track) {
            t.sender.replaceTrack(null);
          }
          t.stop?.();
        } catch {}
      }
      state.consumerPC.close();
    } catch (e) {
      console.log('[View] Error closing old PC:', e.message);
    }
    state.consumerPC = null;
  }

  // Also remove from consumers if already there (prevents duplicate)
  stream.consumers.delete(ws);

  state.role = 'viewer';
  state.streamId = streamId;
  stream.consumers.add(ws);

  // Broadcast updated viewer count
  broadcastViewerCount(streamId);
  broadcastRelayStats();

  // Phase 4: Check if we should route through a mesh forwarder
  if (viaForwarder) {
    const forwarder = getForwarderForStream(streamId, viaForwarder);
    if (forwarder) {
      return routeThroughForwarder(ws, forwarder, streamId);
    }
  }

  // Check if stream is remote and we need to connect to origin relay (Phase 2.1)
  if (stream.remote && stream.presence?.relay) {
    // Check if viewer wants mesh routing
    if (!viaForwarder && shouldUseMesh(streamId)) {
      const forwarder = selectBestForwarder(streamId);
      if (forwarder) {
        return routeThroughForwarder(ws, forwarder, streamId);
      }
    }
    return connectToOriginRelay(ws, stream);
  }

  // If we have a producer PC with tracks, create a consumer offer
  if (stream.producerTracks.length > 0 && werift) {
    await createConsumerOffer(ws, stream);
  } else {
    send(ws, { type: 'waiting', streamId, message: 'Waiting for broadcaster tracks' });
  }
}

function handleStopViewing(ws, msg) {
  const { streamId } = msg;
  const state = clients.get(ws);

  console.log(`[View] Viewer stopped watching stream ${streamId?.slice(0,8)}`);

  // Clean up consumer PC - stop transceivers first to release tracks
  if (state.consumerPC) {
    try {
      // Stop all senders to release tracks before closing
      const transceivers = state.consumerPC.getTransceivers?.() || [];
      for (const t of transceivers) {
        try {
          if (t.sender?.track) {
            t.sender.replaceTrack(null);
          }
          t.stop?.();
        } catch {}
      }
      state.consumerPC.close();
    } catch (e) {
      console.log('[View] Error cleaning up consumer PC:', e.message);
    }
    state.consumerPC = null;
  }

  // Remove from consumers and update count
  const stream = streams.get(streamId);
  if (stream && stream.consumers.has(ws)) {
    stream.consumers.delete(ws);
    broadcastViewerCount(streamId);
  }

  // Reset viewer state but keep connection open
  if (state.role === 'viewer') {
    state.role = null;
    state.streamId = null;
    broadcastRelayStats();
  }
}

// --- Cross-Relay Streaming (Phase 2.1) ---
async function connectToOriginRelay(viewerWs, stream) {
  const originUrl = stream.presence.relay;
  const streamId = stream.presence.stream.id;

  // Check if we already have a connection to this origin
  let originWs = originConnections.get(streamId);

  if (!originWs || originWs.readyState !== WebSocket.OPEN) {
    try {
      console.log(`[Cross-Relay] Connecting to origin relay: ${originUrl}`);
      originWs = new WebSocket(originUrl);

      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Connection timeout')), 10000);
        originWs.onopen = () => {
          clearTimeout(timeout);
          originConnections.set(streamId, originWs);
          resolve();
        };
        originWs.onerror = (e) => {
          clearTimeout(timeout);
          reject(e);
        };
      });

      // Set up message relay
      originWs.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          handleOriginMessage(viewerWs, streamId, msg);
        } catch {}
      };

      originWs.onclose = () => {
        originConnections.delete(streamId);
        // Notify viewer
        send(viewerWs, { type: 'stream_gone', streamId });
      };

    } catch (e) {
      console.error('[Cross-Relay] Failed to connect to origin:', e.message);
      return send(viewerWs, { type: 'error', message: 'Origin relay unreachable' });
    }
  }

  // Request stream from origin
  originWs.send(JSON.stringify({
    type: 'view',
    streamId,
    fromRelay: getPublicUrl()
  }));
}

function handleOriginMessage(viewerWs, streamId, msg) {
  // Forward signaling messages from origin relay to viewer
  if (msg.type === 'signal' || msg.type === 'candidate') {
    send(viewerWs, { ...msg, streamId });
  } else if (msg.type === 'error') {
    send(viewerWs, msg);
  }
}

// --- Mesh Forwarding (Phase 4) ---
function handleCanForward(ws, msg) {
  const { streamId, slots } = msg;
  const state = clients.get(ws);

  if (!forwarders.has(streamId)) {
    forwarders.set(streamId, new Set());
  }

  forwarders.get(streamId).add({
    ws,
    peerId: state.pubkey,
    slots: slots || 3
  });

  console.log(`[Mesh] Forwarder registered for stream ${streamId.slice(0, 8)}, slots: ${slots}`);
}

function handleForwardStopped(ws, msg) {
  const { streamId } = msg;
  const state = clients.get(ws);
  const streamForwarders = forwarders.get(streamId);

  if (streamForwarders) {
    for (const f of streamForwarders) {
      if (f.ws === ws || f.peerId === state.pubkey) {
        streamForwarders.delete(f);
        break;
      }
    }
    if (streamForwarders.size === 0) {
      forwarders.delete(streamId);
    }
  }
}

function handleForwardSlots(ws, msg) {
  const { streamId, slots } = msg;
  const state = clients.get(ws);
  const streamForwarders = forwarders.get(streamId);

  if (streamForwarders) {
    for (const f of streamForwarders) {
      if (f.ws === ws || f.peerId === state.pubkey) {
        f.slots = slots;
        break;
      }
    }
  }
}

function handleForwardCandidate(ws, msg) {
  const { targetPeer, candidate, streamId } = msg;
  // Forward ICE candidate to the target peer in mesh network
  for (const [clientWs, clientState] of clients) {
    if (clientState.pubkey === targetPeer) {
      send(clientWs, {
        type: 'forward_candidate',
        candidate,
        streamId,
        fromPeer: clients.get(ws)?.pubkey
      });
      break;
    }
  }
}

function shouldUseMesh(streamId) {
  // Use mesh if stream has many viewers and forwarders available
  const stream = streams.get(streamId);
  if (!stream) return false;

  const viewerCount = stream.consumers.size;
  const forwarderCount = forwarders.get(streamId)?.size || 0;

  // Enable mesh when > 5 viewers and forwarders available
  return viewerCount > 5 && forwarderCount > 0;
}

function getForwarderForStream(streamId, targetPeerId) {
  const streamForwarders = forwarders.get(streamId);
  if (!streamForwarders) return null;

  for (const f of streamForwarders) {
    if (f.peerId === targetPeerId && f.slots > 0) {
      return f;
    }
  }
  return null;
}

function selectBestForwarder(streamId) {
  const streamForwarders = forwarders.get(streamId);
  if (!streamForwarders || streamForwarders.size === 0) return null;

  // Select forwarder with most available slots
  let best = null;
  for (const f of streamForwarders) {
    if (f.slots > 0 && (!best || f.slots > best.slots)) {
      best = f;
    }
  }
  return best;
}

async function routeThroughForwarder(viewerWs, forwarder, streamId) {
  // Decrement forwarder slots
  forwarder.slots--;

  // Tell the forwarder to expect a new downstream peer
  send(forwarder.ws, {
    type: 'forward_request',
    streamId,
    viewerPubkey: clients.get(viewerWs)?.pubkey
  });

  // Tell viewer which forwarder to connect to
  send(viewerWs, {
    type: 'use_forwarder',
    streamId,
    forwarderPubkey: forwarder.peerId
  });
}

// --- Thumbnail Handling ---
function handleThumbnail(ws, msg) {
  const { streamId, data } = msg;
  const state = clients.get(ws);

  // Verify this is the broadcaster for this stream
  if (state.role !== 'broadcaster' || state.streamId !== streamId) {
    return;
  }

  const stream = streams.get(streamId);
  if (!stream) return;

  // Store thumbnail with stream
  stream.thumbnail = data;

  // Broadcast to all subscribers
  broadcast({ type: 'thumbnail', streamId, data }, ws);
}

// --- Bandwidth/Layer Selection (Phase 3.2) ---
function handleBandwidthReport(ws, msg) {
  const { bandwidth } = msg;
  const state = clients.get(ws);

  // Store bandwidth estimate for this viewer
  if (!state.bandwidth) state.bandwidth = [];
  state.bandwidth.push(bandwidth);
  if (state.bandwidth.length > 5) state.bandwidth.shift();

  // Calculate average bandwidth
  const avgBandwidth = state.bandwidth.reduce((a, b) => a + b, 0) / state.bandwidth.length;

  // Select appropriate layer based on bandwidth
  // h: > 2Mbps, m: > 500Kbps, l: < 500Kbps
  const layer = avgBandwidth > 2000000 ? 'h' :
                avgBandwidth > 500000 ? 'm' : 'l';

  // Store preferred layer for this viewer
  state.preferredLayer = layer;

  // If using werift with simulcast, we could configure layer selection here
  // (werift-specific implementation would go here)
}

function handleSignalForward(ws, msg) {
  const { sdp, streamId } = msg;
  console.log(`[Signal] signal_forward received, hasSdp=${!!sdp}`);
  if (!sdp) return;

  const state = clients.get(ws);

  // Set role from message if not already set (race condition with announce)
  if (!state.role && streamId) {
    state.role = 'broadcaster';
    state.streamId = streamId;
  }

  console.log(`[Signal] Client role=${state.role}, streamId=${state.streamId?.slice(0,8)}`);
  if (state.role === 'broadcaster') {
    handleBroadcasterOffer(ws, msg);
  }
}

async function handleAnswer(ws, msg) {
  const { sdp } = msg;
  const state = clients.get(ws);

  if (state.role === 'viewer' && state.consumerPC) {
    try {
      await state.consumerPC.setRemoteDescription({ type: 'answer', sdp });
    } catch (e) {
      console.error('[SFU] Error setting viewer answer:', e.message);
    }
  }
}

async function handleCandidate(ws, msg) {
  const { candidate } = msg;
  const state = clients.get(ws);
  const pc = state.role === 'broadcaster'
    ? streams.get(state.streamId)?.producerPC
    : state.consumerPC;

  if (pc && candidate) {
    try {
      await pc.addIceCandidate(candidate);
    } catch (e) {
      // ICE candidate errors are non-fatal
    }
  }
}

async function handleBroadcasterOffer(ws, msg) {
  console.log('[SFU] Handling broadcaster offer');
  if (!werift) {
    console.log('[SFU] werift not available');
    return send(ws, { type: 'error', message: 'WebRTC not available on this relay' });
  }

  const { sdp, streamId } = msg;
  let stream = streams.get(streamId);

  // Create stream if it doesn't exist yet (race with announce)
  if (!stream) {
    stream = {
      presence: null,
      producerPC: null,
      producerTracks: [],
      consumers: new Set(),
      lastSeen: Date.now()
    };
    streams.set(streamId, stream);
    console.log(`[SFU] Created stream ${streamId.slice(0, 8)} from signal_forward`);
  }

  try {
    const pc = new werift.RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      headerExtensions: { video: [], audio: [] }
    });

    pc.ontrack = (event) => {
      const track = event.track;
      stream.producerTracks.push(track);
      console.log(`[SFU] Producer track received: ${track.kind}`);

      // Only send offers to waiting consumers once we have both audio and video
      const hasVideo = stream.producerTracks.some(t => t.kind === 'video');
      const hasAudio = stream.producerTracks.some(t => t.kind === 'audio');
      if (hasVideo && hasAudio && !stream.offerssentToWaiting) {
        stream.offerssentToWaiting = true;
        console.log(`[SFU] Both tracks received, sending offers to ${stream.consumers.size} waiting consumers`);
        stream.consumers.forEach(async (viewerWs) => {
          if (viewerWs.readyState === 1) {
            await createConsumerOffer(viewerWs, stream);
          }
        });
      }
    };

    pc.onicecandidate = (candidate) => {
      if (candidate) {
        // werift candidate format differs from browser
        const candidateObj = {
          candidate: candidate.candidate,
          sdpMid: candidate.sdpMid,
          sdpMLineIndex: candidate.sdpMLineIndex
        };
        send(ws, { type: 'candidate', candidate: candidateObj, streamId });
      }
    };

    await pc.setRemoteDescription({ type: 'offer', sdp });
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    stream.producerPC = pc;

    send(ws, { type: 'signal', sdp: pc.localDescription.sdp, streamId });
  } catch (e) {
    console.error('[SFU] Error handling broadcaster offer:', e.message);
    send(ws, { type: 'error', message: 'SFU offer handling failed' });
  }
}

async function createConsumerOffer(ws, stream) {
  if (!werift) return;

  const startTime = Date.now();
  console.log('[SFU] createConsumerOffer starting...');

  const state = clients.get(ws);

  // Get fresh track references from producer PC instead of stored array
  let validTracks = [];
  if (stream.producerPC) {
    const transceivers = stream.producerPC.getTransceivers?.() || [];
    validTracks = transceivers
      .filter(t => t.receiver?.track)
      .map(t => t.receiver.track);
    console.log(`[SFU] Got ${validTracks.length} tracks from producer PC transceivers`);
  }

  // Fallback to stored tracks if needed
  if (validTracks.length === 0) {
    console.log(`[SFU] Falling back to stored producer tracks`);
    validTracks = stream.producerTracks.filter(t => {
      return t && (t.readyState === undefined || t.readyState === 'live');
    });
  }

  if (validTracks.length === 0) {
    console.warn('[SFU] No valid tracks available for consumer');
    send(ws, { type: 'error', message: 'Stream tracks unavailable' });
    return;
  }
  console.log(`[SFU] Valid tracks for consumer: ${validTracks.length}, kinds: ${validTracks.map(t => t.kind).join(', ')}`);

  try {
    const pc = new werift.RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      headerExtensions: { video: [], audio: [] }
    });

    // Close any existing consumer PC first
    if (state.consumerPC) {
      try { state.consumerPC.close(); } catch {}
    }
    state.consumerPC = pc;

    pc.onicecandidate = (candidate) => {
      if (candidate) {
        const candidateObj = {
          candidate: candidate.candidate,
          sdpMid: candidate.sdpMid,
          sdpMLineIndex: candidate.sdpMLineIndex
        };
        send(ws, { type: 'candidate', candidate: candidateObj, streamId: state.streamId });
      }
    };

    pc.onconnectionstatechange = () => {
      console.log(`[SFU] Consumer PC state: ${pc.connectionState}`);
      // Clean up consumer when PC disconnects/fails
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        const stream = streams.get(state.streamId);
        if (stream && stream.consumers.has(ws)) {
          stream.consumers.delete(ws);
          console.log(`[SFU] Consumer removed on PC ${pc.connectionState}, remaining: ${stream.consumers.size}`);
          broadcastViewerCount(state.streamId);
        }
      }
    };

    // Add producer tracks to consumer using addTransceiver
    for (const track of validTracks) {
      try {
        console.log(`[SFU] Adding ${track.kind} track, id=${track.id}, readyState=${track.readyState}, muted=${track.muted}`);
        pc.addTransceiver(track, { direction: 'sendonly' });
        console.log(`[SFU] Added ${track.kind} transceiver for consumer`);
      } catch (e) {
        console.error(`[SFU] Failed to add ${track.kind} transceiver: ${e.message}`);
      }
    }

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    console.log(`[SFU] Sending offer to viewer, tracks: ${validTracks.length}, took ${Date.now() - startTime}ms`);
    send(ws, { type: 'signal', sdp: pc.localDescription.sdp, streamId: state.streamId });

    // Request keyframe from producer so new consumer can decode immediately
    // This is critical for reconnecting viewers - send multiple PLI requests
    const requestKeyframe = () => {
      if (!stream.producerPC) return;
      const producerTransceivers = stream.producerPC.getTransceivers?.() || [];
      for (const t of producerTransceivers) {
        if (t.receiver?.track?.kind === 'video') {
          try {
            // Try different ways to get SSRC
            const ssrc = t.receiver.track?.ssrc || t.receiver.track?.rid || t.receiver.ssrc;
            if (ssrc && t.receiver.sendRtcpPLI) {
              t.receiver.sendRtcpPLI(ssrc);
              console.log(`[SFU] Sent PLI request for keyframe, ssrc=${ssrc}`);
            } else if (t.receiver.sendRtcpPLI) {
              // Try without SSRC argument
              t.receiver.sendRtcpPLI();
              console.log(`[SFU] Sent PLI request for keyframe (no ssrc)`);
            }
          } catch (e) {
            console.log(`[SFU] PLI request failed: ${e.message}`);
          }
        }
      }
    };

    // Send immediately and again after short delays
    requestKeyframe();
    setTimeout(requestKeyframe, 100);
    setTimeout(requestKeyframe, 500);
    setTimeout(requestKeyframe, 1000);
  } catch (e) {
    console.error('[SFU] Error creating consumer offer:', e.message, `after ${Date.now() - startTime}ms`);
    send(ws, { type: 'error', message: 'Failed to create stream offer' });
  }
}

function handleDisconnect(ws) {
  const state = clients.get(ws);
  if (!state) return;

  console.log(`[Disconnect] Client disconnected, role=${state.role}, streamId=${state.streamId?.slice(0,8)}`);

  if (state.role === 'broadcaster' && state.streamId) {
    const stream = streams.get(state.streamId);
    if (stream) {
      console.log(`[Disconnect] Removing stream ${state.streamId.slice(0,8)}`);
      // Close producer PC
      if (stream.producerPC) {
        try { stream.producerPC.close(); } catch {}
      }
      // Notify consumers
      stream.consumers.forEach((viewer) => {
        send(viewer, { type: 'stream_gone', streamId: state.streamId });
        const viewerState = clients.get(viewer);
        if (viewerState?.consumerPC) {
          try { viewerState.consumerPC.close(); } catch {}
          viewerState.consumerPC = null;
        }
      });
      // Clean up forwarders for this stream
      forwarders.delete(state.streamId);
      // Clean up origin connection if any
      const originWs = originConnections.get(state.streamId);
      if (originWs) {
        try { originWs.close(); } catch {}
        originConnections.delete(state.streamId);
      }
      streams.delete(state.streamId);
      broadcast({ type: 'stream_gone', streamId: state.streamId });
      console.log(`[Disconnect] Stream removed, total streams: ${streams.size}`);
    }
  }

  if (state.role === 'viewer' && state.streamId) {
    const stream = streams.get(state.streamId);
    if (stream) {
      stream.consumers.delete(ws);
      // Broadcast updated viewer count
      broadcastViewerCount(state.streamId);
    }
    if (state.consumerPC) {
      try { state.consumerPC.close(); } catch {}
    }

    // Remove from forwarders if this viewer was forwarding
    const streamForwarders = forwarders.get(state.streamId);
    if (streamForwarders) {
      for (const f of streamForwarders) {
        if (f.ws === ws || f.peerId === state.pubkey) {
          streamForwarders.delete(f);
          break;
        }
      }
    }
  }
}

// --- Ed25519 Verification ---
async function verifyPresence(presence) {
  try {
    // Extract signature, keep everything else (including pubkey) as payload
    const { signature, ...payload } = presence;
    const data = new TextEncoder().encode(JSON.stringify(payload));
    const sigBytes = Buffer.from(signature, 'hex');
    const keyBytes = Buffer.from(presence.pubkey, 'hex');

    // Use Node.js crypto for Ed25519 verification
    const keyObj = crypto.createPublicKey({
      key: Buffer.concat([
        // Ed25519 public key DER prefix
        Buffer.from('302a300506032b6570032100', 'hex'),
        keyBytes
      ]),
      format: 'der',
      type: 'spki'
    });

    return crypto.verify(null, data, keyObj, sigBytes);
  } catch (e) {
    console.error('[Auth] Signature verification error:', e.message);
    return false;
  }
}

// --- DHT / Hyperswarm ---
let swarm;
let relayAnnounceTimer;

// Create signed relay info packet (Phase 1.2)
function createRelayAnnouncement() {
  const payload = {
    type: 'relay_announce',
    url: getPublicUrl(),
    pubkey: relayPubkeyHex,
    timestamp: Date.now(),
    streams: streams.size,
    clients: clients.size
  };

  // Sign the announcement
  const data = Buffer.from(JSON.stringify(payload));
  const signature = crypto.sign(null, data, relayKeyPair.privateKey).toString('hex');

  return { ...payload, signature };
}

async function initSwarm() {
  try {
    swarm = new Hyperswarm();
    const discovery = swarm.join(TOPIC, { server: true, client: true });
    await discovery.flushed();
    console.log('[DHT] Joined topic:', TOPIC.toString('hex').slice(0, 16) + '...');

    swarm.on('connection', (conn, info) => {
      const peerKey = info.publicKey?.toString('hex').slice(0, 8);
      console.log('[DHT] Peer connected:', peerKey);

      // Immediately announce ourselves to new peer (Phase 1.2)
      const relayInfo = createRelayAnnouncement();
      conn.write(JSON.stringify(relayInfo));

      conn.on('data', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'presence') {
            handleDHTPresence(msg);
          } else if (msg.type === 'relay_announce') {
            handleDHTRelayAnnounce(msg);
          }
        } catch {}
      });

      conn.on('error', () => {});

      // Share our streams with new peer
      for (const [, stream] of streams) {
        if (!stream.remote) { // Only share local streams
          conn.write(JSON.stringify(stream.presence));
        }
      }
    });

    // Periodically re-announce relay info
    relayAnnounceTimer = setInterval(() => {
      announceRelayToSwarm();
    }, RELAY_ANNOUNCE_INTERVAL);

  } catch (e) {
    console.error('[DHT] Swarm init failed:', e.message);
  }
}

function announceRelayToSwarm() {
  if (!swarm) return;
  const relayInfo = createRelayAnnouncement();
  const data = JSON.stringify(relayInfo);
  for (const conn of swarm.connections) {
    try { conn.write(data); } catch {}
  }
}

function announceToSwarm(presence) {
  if (!swarm) return;
  const data = JSON.stringify(presence);
  for (const conn of swarm.connections) {
    try { conn.write(data); } catch {}
  }
}

// Handle relay announcements from DHT peers (Phase 1.2)
function handleDHTRelayAnnounce(msg) {
  const { url, pubkey, timestamp, signature } = msg;
  if (!url || !pubkey || !signature) return;

  // Verify signature
  try {
    const { signature: sig, ...payload } = msg;
    const data = Buffer.from(JSON.stringify(payload));
    const sigBytes = Buffer.from(sig, 'hex');
    const keyBytes = Buffer.from(pubkey, 'hex');

    const keyObj = crypto.createPublicKey({
      key: Buffer.concat([
        Buffer.from('302a300506032b6570032100', 'hex'),
        keyBytes
      ]),
      format: 'der',
      type: 'spki'
    });

    const valid = crypto.verify(null, data, keyObj, sigBytes);
    if (!valid) {
      console.warn('[DHT] Invalid relay announcement signature');
      return;
    }
  } catch (e) {
    console.warn('[DHT] Relay signature verification error:', e.message);
    return;
  }

  // Store/update known relay
  const existing = knownRelays.get(url);
  if (!existing || existing.timestamp < timestamp) {
    knownRelays.set(url, {
      url,
      pubkey,
      timestamp,
      lastSeen: Date.now()
    });
    console.log(`[DHT] Discovered relay: ${url}`);

    // Broadcast relay update to connected clients
    broadcastRelayUpdate();
  }
}

function handleDHTPresence(presence) {
  const streamId = presence.stream?.id;
  if (!streamId || streams.has(streamId)) return;

  // Store remote stream with origin relay info (Phase 2.1)
  streams.set(streamId, {
    presence,
    producerPC: null,
    producerTracks: [],
    consumers: new Set(),
    lastSeen: Date.now(),
    remote: true,
    originRelay: presence.relay || null
  });

  broadcast({ type: 'stream_available', presence });
}

// Broadcast relay list updates to clients (Phase 1.3)
function broadcastRelayUpdate() {
  broadcast({ type: 'relay_update', relays: getRelayList() });
}

// Broadcast connected client count to all clients
function broadcastRelayStats() {
  let broadcasters = 0, viewers = 0;
  for (const state of clients.values()) {
    if (state.role === 'broadcaster') broadcasters++;
    else if (state.role === 'viewer') viewers++;
  }
  broadcast({ type: 'relay_stats', clients: clients.size, broadcasters, viewers });
}

function getRelayStats() {
  let broadcasters = 0, viewers = 0;
  for (const state of clients.values()) {
    if (state.role === 'broadcaster') broadcasters++;
    else if (state.role === 'viewer') viewers++;
  }
  return { clients: clients.size, broadcasters, viewers };
}

// --- Presence & Relay Expiry ---
const RELAY_TTL = 120_000; // 2 minutes for relay expiry

const expiryTimer = setInterval(() => {
  const now = Date.now();

  // Expire old streams (only remote streams that haven't been refreshed)
  for (const [streamId, stream] of streams) {
    // Check if broadcaster is still connected (local stream)
    let broadcasterConnected = false;
    for (const [ws, state] of clients) {
      if (state.role === 'broadcaster' && state.streamId === streamId && ws.readyState === 1) {
        broadcasterConnected = true;
        stream.lastSeen = now; // Keep refreshing while connected
        break;
      }
    }

    // Only expire if broadcaster disconnected AND TTL exceeded
    if (!broadcasterConnected && now - stream.lastSeen > PRESENCE_TTL) {
      console.log(`[Expiry] Stream ${streamId.slice(0,8)} expired`);
      streams.delete(streamId);
      forwarders.delete(streamId);
      originConnections.get(streamId)?.close();
      originConnections.delete(streamId);
      broadcast({ type: 'stream_gone', streamId });
    }
  }

  // Expire old relays
  for (const [url, relay] of knownRelays) {
    if (now - relay.lastSeen > RELAY_TTL) {
      knownRelays.delete(url);
      console.log(`[DHT] Relay expired: ${url}`);
    }
  }
}, 10_000);

// --- Helpers ---
function send(ws, msg) {
  if (ws.readyState === 1) {
    ws.send(JSON.stringify(msg));
  }
}

function broadcast(msg, exclude = null) {
  let sent = 0;
  for (const [ws, state] of clients) {
    if (ws !== exclude && state.subscribed) {
      send(ws, msg);
      sent++;
    }
  }
  if (msg.type === 'stream_available' || msg.type === 'stream_gone') {
    console.log(`[Broadcast] ${msg.type} sent to ${sent} clients`);
  }
}

function getStreamList() {
  return Array.from(streams.values()).map(s => ({
    ...s.presence,
    viewerCount: s.consumers.size,
    thumbnail: s.thumbnail || null
  }));
}

function broadcastViewerCount(streamId) {
  const stream = streams.get(streamId);
  if (!stream) return;

  const count = stream.consumers.size;

  // Broadcast to all subscribers
  broadcast({ type: 'viewer_count', streamId, count });

  // Also explicitly notify the broadcaster (in case they missed the broadcast)
  for (const [ws, state] of clients) {
    if (state.role === 'broadcaster' && state.streamId === streamId && ws.readyState === 1) {
      send(ws, { type: 'viewer_count', streamId, count });
      break;
    }
  }
}

// Get list of known relays including self (Phase 1.3)
function getRelayList() {
  const list = [
    { url: getPublicUrl(), pubkey: relayPubkeyHex }
  ];

  // Add known peer relays
  for (const relay of knownRelays.values()) {
    list.push({
      url: relay.url,
      pubkey: relay.pubkey
    });
  }

  return list;
}

// --- Startup ---
const HOST = process.env.HOST || '0.0.0.0';
server.listen(PORT, HOST, () => {
  console.log(`[oneye] Relay listening on http://${HOST}:${PORT}`);
  // Show LAN IP for easy sharing
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        console.log(`[oneye] LAN: http://${iface.address}:${PORT}`);
      }
    }
  }
  initSwarm();
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n[oneye] Shutting down...');
  clearInterval(pingTimer);
  clearInterval(expiryTimer);
  if (relayAnnounceTimer) clearInterval(relayAnnounceTimer);

  // Close all origin relay connections
  for (const [, ws] of originConnections) {
    try { ws.close(); } catch {}
  }

  wss.close();
  if (swarm) await swarm.destroy();
  server.close();
  process.exit(0);
});

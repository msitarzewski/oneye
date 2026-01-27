# oneye - Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        DHT Network                               │
│                    (Hyperswarm Topic)                            │
│  ┌─────────┐    relay_announce    ┌─────────┐                   │
│  │ Relay A │◄────────────────────►│ Relay B │                   │
│  │  (SFU)  │    stream gossip     │  (SFU)  │                   │
│  └────┬────┘                      └────┬────┘                   │
└───────┼────────────────────────────────┼────────────────────────┘
        │                                │
        │ WebSocket + WebRTC             │ WebSocket + WebRTC
        │                                │
   ┌────┴────┐                      ┌────┴────┐
   │Broadcast│                      │ Viewers │
   │   er    │                      │         │
   └─────────┘                      └────┬────┘
                                         │
                              ┌──────────┼──────────┐
                              │    Mesh Network     │
                              │  (Viewer-to-Viewer) │
                              └─────────────────────┘
```

## Discovery Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     Client Discovery                             │
│                                                                  │
│  1. URL Hash     ─►  #relay=wss://...                           │
│         ↓ (fallback)                                            │
│  2. IPNS         ─►  /ipns/{name}/relays.json                   │
│         ↓ (fallback)                                            │
│  3. Well-Known   ─►  /.well-known/oneye.json                    │
│         ↓ (fallback)                                            │
│  4. DNS TXT      ─►  _oneye.{domain} via DoH                    │
│         ↓ (fallback)                                            │
│  5. Self         ─►  Current page URL becomes relay             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Relay-to-Relay Protocol

### Self-Announcement

When relays connect via DHT, they exchange signed announcements:

```json
{
  "type": "relay_announce",
  "url": "wss://relay.example.com",
  "pubkey": "ed25519-public-key-hex",
  "timestamp": 1706180000000,
  "streams": 5,
  "clients": 12,
  "signature": "ed25519-signature-hex"
}
```

Relays verify signatures and maintain a list of known peers. This list is shared with clients in `welcome` and `subscribed` messages.

### Stream Gossip

Stream presence packets are gossiped between relays:

```json
{
  "type": "presence",
  "version": 1,
  "pubkey": "broadcaster-pubkey",
  "timestamp": 1706180000000,
  "stream": {
    "id": "sha256-hash",
    "title": "",
    "tracks": ["video", "audio"]
  },
  "relay": "wss://origin-relay.example.com",
  "signature": "broadcaster-signature"
}
```

The `relay` field indicates which relay has the actual media tracks.

## Cross-Relay Streaming

When a viewer on Relay B requests a stream that originates on Relay A:

```
┌────────┐     view      ┌─────────┐    connect     ┌─────────┐
│ Viewer │──────────────►│ Relay B │───────────────►│ Relay A │
└────────┘               └─────────┘                └────┬────┘
                              │                          │
                              │◄─────── SDP/ICE ────────►│
                              │                          │
                              │◄─────── Media ──────────►│
                              │                          │
                         ┌────┴────┐                     │
                         │ Viewer  │◄────────────────────┘
                         └─────────┘
```

Relay B acts as a signaling proxy, forwarding WebRTC negotiation to Relay A.

## Media Flow (SFU)

### Broadcaster → Relay

```
┌─────────────┐                      ┌─────────────┐
│ Broadcaster │                      │    Relay    │
│             │                      │   (werift)  │
│ getUserMedia├──►┌──────────┐       │             │
│             │   │ RTCPeer  │──────►│ Producer PC │
│             │   │Connection│  SDP  │             │
│             │   └──────────┘◄──────│             │
│             │        │             │             │
│             │        │ Tracks      │ Store tracks│
│             │        └────────────►│ for viewers │
└─────────────┘                      └─────────────┘
```

### Relay → Viewer

```
┌─────────────┐                      ┌─────────────┐
│    Relay    │                      │   Viewer    │
│             │                      │             │
│ Stored     ├──►┌──────────┐       │             │
│ Tracks      │   │Consumer  │──────►│ RTCPeer    │
│             │   │   PC     │  SDP  │ Connection │
│             │   └──────────┘◄──────│             │
│             │        │             │             │
│             │        │ Tracks      │ Display    │
│             │        └────────────►│ video/audio│
└─────────────┘                      └─────────────┘
```

## Bandwidth Adaptation

### Simulcast Encoding (Broadcaster)

```
┌─────────────────────────────────────────────────────┐
│              Broadcaster Video Track                 │
│                                                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │
│  │   Layer H   │  │   Layer M   │  │   Layer L   │ │
│  │   720p      │  │   360p      │  │   180p      │ │
│  │  2.5 Mbps   │  │  600 Kbps   │  │  150 Kbps   │ │
│  └─────────────┘  └─────────────┘  └─────────────┘ │
└─────────────────────────────────────────────────────┘
```

### Layer Selection (Relay)

Viewers report bandwidth estimates. Relay selects appropriate layer:

| Bandwidth | Layer | Resolution |
|-----------|-------|------------|
| > 2 Mbps  | H     | 720p       |
| > 500 Kbps| M     | 360p       |
| < 500 Kbps| L     | 180p       |

## Mesh Forwarding

When a stream has many viewers, some can forward to others:

```
                    ┌─────────┐
                    │  Relay  │
                    └────┬────┘
                         │
           ┌─────────────┼─────────────┐
           │             │             │
      ┌────┴────┐   ┌────┴────┐   ┌────┴────┐
      │Viewer A │   │Viewer B │   │Viewer C │
      │(forward)│   │(forward)│   │         │
      └────┬────┘   └────┬────┘   └─────────┘
           │             │
     ┌─────┴─────┐ ┌─────┴─────┐
     │           │ │           │
┌────┴───┐ ┌────┴┴──┐ ┌───┴────┐
│Viewer D│ │Viewer E│ │Viewer F│
└────────┘ └────────┘ └────────┘
```

### Auto-Enable Conditions

Mesh forwarding auto-enables when:
- Connection type is NOT cellular
- Effective connection > 2G
- Battery > 20% (or > 50% if discharging)
- Data saver is OFF

## Trust Model

| Layer | Trust Anchor | Who Controls |
|-------|--------------|--------------|
| IPNS key | Bootstrap list | You (optional) |
| Relay key | Relay identity | Each operator |
| Broadcaster key | Stream ownership | Each broadcaster |
| DHT topic | Open membership | No one (decentralized) |

### Identity

- **Relays**: Ed25519 keypair generated on startup, signs relay announcements
- **Clients**: Ed25519 keypair stored in localStorage, signs presence packets
- **No registration**: Identity IS the public key

### Verification

All presence packets are signed. Relays verify signatures before accepting announcements:

```javascript
// Signing (client)
const signature = await crypto.subtle.sign('Ed25519', privateKey, payload);

// Verification (server)
const valid = crypto.verify(null, payload, publicKey, signature);
```

## Message Types

### Client → Relay

| Type | Purpose |
|------|---------|
| `subscribe` | Join network, get stream/relay lists |
| `announce` | Start broadcasting |
| `unannounce` | Stop broadcasting |
| `view` | Request to watch a stream |
| `signal_forward` | WebRTC offer (broadcaster) |
| `answer` | WebRTC answer (viewer) |
| `candidate` | ICE candidate |
| `bandwidth_report` | Viewer bandwidth estimate |
| `can_forward` | Offer to forward stream (mesh) |

### Relay → Client

| Type | Purpose |
|------|---------|
| `welcome` | Initial connection, includes streams/relays |
| `subscribed` | Subscription confirmed |
| `stream_available` | New stream announced |
| `stream_gone` | Stream ended |
| `signal` | WebRTC SDP |
| `candidate` | ICE candidate |
| `relay_update` | New relays discovered |

### Relay → Relay (DHT)

| Type | Purpose |
|------|---------|
| `relay_announce` | Self-identification with signature |
| `presence` | Stream announcement (gossiped) |

## Privacy Design

- **Ephemeral**: No recording, no persistence. Streams exist only while live.
- **No accounts**: Keypairs are the only identity.
- **No tracking**: No cookies, no analytics, no server-side user data.
- **Minimal metadata**: Only what's needed for signaling.
- **End-to-end optional**: WebRTC encryption between peers (DTLS-SRTP).

## Client Architecture

### Module Overview

The client is a single HTML file with modular JavaScript using the IIFE (Immediately Invoked Function Expression) pattern:

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client Modules                            │
│                                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │ Identity │  │ Bootstrap│  │ Discovery│  │   Media  │       │
│  │ (keys)   │  │ (relays) │  │ (streams)│  │ (camera) │       │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘       │
│                                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │   RTC    │  │ Location │  │ Settings │  │  MapView │       │
│  │ (WebRTC) │  │ (geo)    │  │ (prefs)  │  │ (Leaflet)│       │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘       │
│                                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │ Sidebar  │  │MobileNav │  │ Amplify  │  │    UI    │       │
│  │          │  │          │  │          │  │ (streams)│       │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘       │
│                                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                      │
│  │Broadcast │  │ Archives │  │ Bandwidth│                      │
│  │  Setup   │  │ (replay) │  │ Monitor  │                      │
│  └──────────┘  └──────────┘  └──────────┘                      │
└─────────────────────────────────────────────────────────────────┘
```

### Settings Module

Manages user preferences with localStorage persistence:

```javascript
const Settings = {
  STORAGE_KEY: 'oneye:settings',
  DEFAULTS: {
    theme: 'system',           // 'system' | 'dark' | 'light'
    autoPlay: true,            // Auto-play streams on click
    locationAccess: false,     // Remember location permission
    locationPrecision: 'city', // 'exact' | 'neighborhood' | 'city' | 'region'
    notifications: false,      // Browser notifications
    defaultView: 'live',       // 'live' | 'archives' | 'map'
    sidebarExpanded: false     // Sidebar state
  }
};
```

**Theme Application:**
- `data-theme="light"` or `data-theme="dark"` on `<html>`
- Remove attribute for system preference (uses `prefers-color-scheme`)
- Updates MapView tiles (CartoDB dark/light)

### UI Components

**Sidebar:**
- Grouped sections: Navigation (Live/Archives/Map), Browse (Categories/Tags), Settings
- Collapsible with state persistence
- Auto-expands when clicking Categories/Tags while collapsed
- Auto-collapses after category/tag selection

**Mobile Navigation:**
- Hamburger menu in header
- Tab bar: Live | Archives | Map
- Categories in 2-column grid
- Session info footer with relay status
- Settings gear opens modal

**Settings Modal:**
- Appearance: Theme selector
- Playback: Auto-play toggle
- Privacy: Location access, precision, notifications
- Defaults: Default view selector

**Connection Indicator:**
- Info icon in footer (bottom-right)
- Gray when disconnected, green with glow when connected
- Tooltip shows relay URL on hover/tap

### Broadcast Setup Flow

```
┌─────────────┐     ┌─────────────────┐     ┌─────────────┐
│  Go Live    │────►│ BroadcastSetup  │────►│   goLive()  │
│  Button     │     │     Modal       │     │  (camera)   │
└─────────────┘     └─────────────────┘     └─────────────┘
                           │
                    ┌──────┴──────┐
                    │   Settings  │
                    ├─────────────┤
                    │ • Title     │
                    │ • Categories│
                    │ • Tags      │
                    │ • Location  │
                    │ • Precision │
                    │ • Recording │
                    └─────────────┘
```

### Location Privacy

Broadcasters can share location with configurable precision:

| Precision | Accuracy | Use Case |
|-----------|----------|----------|
| Exact | ~10m | Specific venue |
| Neighborhood | ~1km | General area |
| City | ~10km | Metro area |
| Region | ~100km | State/province |

Location is fuzzed client-side before sending to relay.

### View System

Three main content views share the same container:

```
┌─────────────────────────────────────────┐
│                Header                    │
├──────────┬──────────────────────────────┤
│          │                              │
│ Sidebar  │     Content Area             │
│          │  ┌────────────────────────┐  │
│ • Live   │  │ Live: Stream Grid      │  │
│ • Archive│  │ Archives: Archive Grid │  │
│ • Map    │  │ Map: Leaflet Map       │  │
│ • Browse │  │                        │  │
│ • Settings│ └────────────────────────┘  │
│          │                              │
├──────────┴──────────────────────────────┤
│                Footer                    │
│         [Go Live]           (i)         │
└─────────────────────────────────────────┘
```

`Sidebar.switchView(view)` toggles visibility and updates active states.

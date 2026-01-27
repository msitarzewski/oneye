# Location Reverse Geocoding

**Date**: 2025-01-27
**Status**: Complete

## Objective

Implement reverse geocoding so location displays human-readable names (e.g., "New York, NY") instead of coordinates.

## Implementation

### Architecture

```
Browser Geolocation → currentLocation (lat/lng)
        ↓
Nominatim API (background fetch)
        ↓
addressData { city, state, country, neighborhood }
        ↓
formatLabel() → "City, State" (based on precision)
```

Uses OpenStreetMap's Nominatim API - no API key required, no CDN dependency.

### Changes (`index.html` Location Module)

**New Functions**:

```javascript
// Reverse geocode using Nominatim (OpenStreetMap)
async function reverseGeocode(lat, lng) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=14&addressdetails=1`;
  const response = await fetch(url, {
    headers: { 'User-Agent': 'oneye-stream-app' }
  });
  const data = await response.json();
  const addr = data.address || {};
  return {
    city: addr.city || addr.town || addr.village || addr.municipality || '',
    state: addr.state || addr.region || addr.province || '',
    country: addr.country || '',
    neighborhood: addr.suburb || addr.neighbourhood || addr.district || ''
  };
}

// Format label based on precision level
function formatLabel(addrData) {
  switch (precision) {
    case 'exact':
    case 'neighborhood':
      // "Neighborhood, City" or "City, State"
    case 'city':
      // "City, State" or "City, Country"
    case 'region':
      // "State, Country"
    case 'country':
      // "Country"
  }
}
```

**Modified Functions**:

- `requestLocation()` - Calls `reverseGeocode()` in background after getting position, stores `addressData` and `label` in `currentLocation`
- `setPrecision()` - Reformats label when precision changes using cached `addressData`
- `getLocationData()` - Returns cached label instead of empty string
- `getLocationLabel()` - Returns cached label with fallback to coordinates

### Label Format by Precision

| Precision | Example Output |
|-----------|----------------|
| exact | "SoHo, New York" |
| neighborhood | "SoHo, New York" |
| city | "New York, New York" |
| region | "New York, United States" |
| country | "United States" |

## Integration Points

| Location | Action |
|----------|--------|
| `index.html:6117` | `reverseGeocode()` function |
| `index.html:6147` | `formatLabel()` function |
| `index.html:6174` | `requestLocation()` calls geocoding |
| `index.html:6228` | `setPrecision()` reformats label |
| `index.html:6247` | `getLocationData()` returns label |
| `index.html:6259` | `getLocationLabel()` returns label |

## Data Flow

```
User enables location
  → requestLocation()
  → Browser geolocation API
  → currentLocation = { lat, lng, accuracy, timestamp, label: '', addressData: null }
  → resolve(currentLocation)  // Don't block on geocoding
  → reverseGeocode(lat, lng)  // Background
  → currentLocation.addressData = { city, state, country, neighborhood }
  → currentLocation.label = formatLabel(addressData)  // "City, State"

User changes precision
  → setPrecision(level)
  → currentLocation.label = formatLabel(currentLocation.addressData)  // Reformat

Presence packet sent
  → getLocationData()
  → { lat, lng, precision, label: currentLocation.label }
```

## No External Dependencies

- Uses native `fetch()` API
- Nominatim is a simple REST API call (no SDK/library)
- No API key required
- User-Agent header required by Nominatim TOS

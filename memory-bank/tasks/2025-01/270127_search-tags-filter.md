# Search Tags Filter

**Date**: 2025-01-27
**Status**: Complete

## Objective

Fix search to filter by tags in addition to title.

## Problem

The `performSearch()` function in the Sidebar module only checked the title text when filtering stream and archive cards. Users searching for tags like "gaming" or category emojis wouldn't find matching streams.

## Implementation

### Before

```javascript
cards.forEach(card => {
  const title = card.querySelector('.title')?.textContent?.toLowerCase() || '';
  const visible = !query || title.includes(query);
  // ...
});
```

### After

```javascript
cards.forEach(card => {
  const title = card.querySelector('.title')?.textContent?.toLowerCase() || '';
  const tags = Array.from(card.querySelectorAll('.tag')).map(t => t.textContent.toLowerCase());
  const visible = !query || title.includes(query) || tags.some(t => t.includes(query));
  // ...
});
```

### Changes (`index.html`)

**Modified Function**: `performSearch()` in Sidebar module (line ~7337)

- Extract tags from `.tag` elements in each card
- Check if query matches title OR any tag text
- Applied to both live stream cards and archive cards

## Card Structure Reference

**Stream cards** (`.stream-card`):
- Title: `.title`
- Tags: `.tags .tag` (shows emoji for categories, `#tag` for custom)

**Archive cards** (`.archive-card`):
- Title: `.title`
- Tags: `.tags-content .tag` (inside disclosure)

## Testing

1. Go live with tags (e.g., "gaming", "music")
2. Search for a tag name → stream should appear
3. Search for category emoji → stream should appear
4. Search in Archives view → same behavior
5. Search for partial tag match → should work (e.g., "gam" matches "gaming")

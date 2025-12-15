# Location-Based Feed Migration Summary

## What Changed

**Before:** City-based routing with subdomains (`nashville.yipyaps.com`)
**After:** Location-based feed using GPS + S2 cells (`yipyaps.com`)

---

## How It Works Now

1. User opens `yipyaps.com`
2. App requests GPS permission
3. GPS coords → S2 cell ID (a ~2.5 mile hex region)
4. Posts are stored with `cellId` instead of `city`
5. Feed shows posts from your cell + neighboring cells (~7.5mi coverage)
6. Posts expire after 24 hours

---

## Files Changed

| File | What Changed |
|------|--------------|
| `src/lib/geo.ts` | Added `coordsToCellId()` and `getCellIdWithNeighbors()` using S2 geometry |
| `src/db/schema.ts` | Added `cellId` column, made `city` optional, added indexes |
| `src/lib/posts.ts` | `createPost` computes cellId from GPS; `getPosts` queries by cellId + neighbors |
| `src/lib/types.ts` | Simplified to just `LocationContext`, `GetPostsInput`, `CreatePostInput` |
| `src/routes/index.tsx` | Removed city picker, subdomain logic; now just GPS → feed |
| `src/components/location-prompt-modal.tsx` | New simple "Enable Location" modal |
| `wrangler.jsonc` | Removed `*.yipyaps.com` wildcard route |

## New Files

- `src/lib/geocoding.ts` - Simple Google Maps geocoding to resolve city name from coords

## Files Deleted

- `src/components/city-onboarding-modal.tsx` (replaced by location-prompt-modal)
- `src/lib/geolocation.ts` (replaced by simpler geocoding.ts)

---

## Database Schema Change

```sql
-- New column
ALTER TABLE posts ADD COLUMN cell_id TEXT;

-- New indexes
CREATE INDEX posts_cell_id_idx ON posts(cell_id);
CREATE INDEX posts_created_at_idx ON posts(created_at);

-- city column is now nullable (was NOT NULL)
```

**Run migration:**
```bash
npx drizzle-kit generate
npx drizzle-kit push
```

---

## Key Code Changes

### Creating a Post (before)
```ts
// Required city from subdomain, validated against GPS cookie
await db.insert(posts).values({
  content,
  city,  // from subdomain
  latitude,
  longitude,
})
```

### Creating a Post (after)
```ts
// Compute S2 cell from GPS coords
const cellId = coordsToCellId(latitude, longitude)
// Resolve city for future display (non-blocking)
const { city } = await resolveCity(latitude, longitude, apiKey)

await db.insert(posts).values({
  content,
  cellId,  // S2 cell token for queries
  city,    // for future display
  latitude,
  longitude,
})
```

### Fetching Posts (before)
```ts
// Query by city OR filter all posts by distance in JS
db.select().from(posts).where(eq(posts.city, city))
```

### Fetching Posts (after)
```ts
// Query by cell + neighbors, filter by 24h
const cellIds = getCellIdWithNeighbors(lat, lng)
db.select().from(posts).where(
  and(
    inArray(posts.cellId, cellIds),
    gt(posts.createdAt, twentyFourHoursAgo)
  )
)
```

---

## What's Removed

- Subdomain routing (`*.yipyaps.com`)
- City picker dropdown
- `yipyaps_city_slug` cookie
- City validation ("You must be in Nashville to post")

## What's Kept

- Google Maps Geocoding API (for resolving city name, stored for future display)

---

## New Package

```bash
npm install s2-geometry
```

S2 is Google's spatial indexing library. Level 11 cells are ~4km (~2.5mi) across.

---

## User Experience Change

| Before | After |
|--------|-------|
| "Welcome to Yipyaps - Find my city" | "Welcome to Yipyaps - Enable Location" |
| "Notes from Nashville + Nearby" | "Notes from people near you" |
| "You must be in Nashville to post" | GPS required, no city validation |
| Posts visible forever | Posts expire after 24 hours |

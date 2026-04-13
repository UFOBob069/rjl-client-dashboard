# Ramos James Law — Client Data Platform (Phase 1)

Internal Next.js admin app for **historical client data**: CSV import to **Firestore**, **CRUD**, and a **Mapbox** map with clustering. Built as an extensible foundation (shared field config, flexible `customFields`, import provenance).

## Stack

- Next.js (App Router) + React + TypeScript + Tailwind CSS v4
- Firebase Authentication (**Google sign-in**, restricted to **@ramosjames.com**) + Firestore
- CSV: Papa Parse in the browser
- Map: `react-map-gl` + Mapbox GL (GeoJSON clustering)

## Quick start

```bash
npm install
cp .env.local.example .env.local
# Edit .env.local with Firebase + Mapbox keys
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Unauthenticated users are sent to `/login`.

`npm run dev` uses **webpack** (same rationale as production build) so the Mapbox bundle loads reliably.

## Connect Firebase

1. In [Firebase Console](https://console.firebase.google.com/), create or select a project.
2. Enable **Authentication** → Sign-in method → **Google** (set support email, save).
3. Under **Authentication** → **Settings** → **Authorized domains**, add your production host and `localhost` for local dev.
4. Staff sign in with Google; the app and Firestore rules only allow users whose email ends with **`@ramosjames.com`** (see `src/lib/authPolicy.ts` and `firestore.rules`). To change the domain, update both places.
5. Enable **Firestore** (Native mode).
6. Project settings → Your apps → Web app → copy config into `.env.local` using the `NEXT_PUBLIC_FIREBASE_*` names from `.env.local.example`.
7. Deploy security rules (`firestore.rules` — Google auth + `@ramosjames.com` only):

   ```bash
   firebase deploy --only firestore:rules
   ```

   Tighten further with custom claims if you add roles later.

## Firestore schema

### Collection: `clients`

Each document is one client. Recommended fields (see `src/types/client.ts`):

| Area | Fields |
|------|--------|
| Identity | `firstName`, `lastName`, `fullName`, `email`, `phone` |
| Address | `street`, `city`, `state`, `zip`, `fullAddress` |
| Map | `latitude`, `longitude` |
| Meta | `createdAt`, `updatedAt`, `status`, `isDeleted`, `notes` |
| Flex | `customFields` (object) |
| Import | `importSource` (`filename`, `importedAt`, `importBatchId`), `dedupeKey` |

**Soft delete:** `isDeleted: true` hides records from list/map queries in the app (loaded by ID still shows a “deleted” notice).

**Evolution:** Add new first-class fields in **both** `src/types/client.ts` and `src/lib/fieldConfig.ts` (`CLIENT_FORM_FIELDS`). Optional: migrate values out of `customFields` over time.

### Collection: `importLogs`

One document per import run: counts, filename, batch id, optional `userEmail`, `importedAt`. Used on the dashboard “Recent imports” card.

### Indexes

The app queries `clients` with `orderBy("updatedAt", "desc")` and filters `isDeleted` in memory to avoid a composite index. If the collection grows very large, switch to `where("isDeleted", "==", false)` + `orderBy("updatedAt")` and add the composite index Firestore suggests.

`importLogs` uses `orderBy("importedAt", "desc")`.

**Query limit:** Firestore allows at most **10,000** documents per `limit()`. `listActiveClients` clamps to that (`FIRESTORE_MAX_QUERY_LIMIT` in `src/lib/firestore/clients.ts`). Beyond that, add **pagination** (`startAfter` / cursors) or server-side aggregation.

## CSV import

1. **Upload** (`/upload`): file is parsed in the browser (Papa Parse).
2. **Map columns** to client fields or “Skip”. Unmapped columns can be pushed into `customFields` (column name → value).
3. **Preview** shows the first rows.
4. **Import** batches writes (Firestore limit 450 ops/batch). Each row gets:
   - `importSource` (filename, timestamp, `importBatchId`)
   - `dedupeKey` from `computeDedupeKey` in `src/lib/clientRecord.ts` (email / name+zip / … / row hash)
5. **Duplicates:** Rows whose `dedupeKey` already exists in Firestore (recent docs scan, configurable cap) or appears twice in the same file are **skipped**; counts are shown after import.

Optional: **Geocode** rows missing coordinates (Mapbox Geocoding API, low concurrency — suitable for smaller files).

Heuristic column guessing lives in `src/lib/csvGuessMapping.ts` — extend `HEADER_SYNONYMS` as you see real exports.

## Manual CRUD

- **Table:** `/clients` — search; columns driven by `showInTable` in `fieldConfig.ts`.
- **New:** `/clients/new`
- **Detail / edit:** `/clients/[id]` — `ClientForm`; **Soft delete** button.

## Map provider

- **Current:** Mapbox token `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` in `.env.local` (map tiles **and** forward geocoding).
- **Pins:** Documents need `latitude` / `longitude`. If they only have `fullAddress` (or street/city/state/zip), opening **Map** runs Mapbox geocoding, writes coords back to Firestore, then shows pins (`src/lib/geocodeMissingClientCoords.ts` + `src/app/(admin)/map/page.tsx`).
- **Component:** `src/components/map/ClientsMap.tsx` — swap `MAP_STYLE` or replace `Map` / `Source` / `Layer` with another provider (e.g. Google Maps + a clustering helper) while keeping the same `clients` prop shape.
- **Geocoding API:** `src/lib/geocode.ts` — same token; replace implementation to match another geocoder if you change map stack.

## Where to extend

| Goal | Location |
|------|----------|
| New standard field | `src/types/client.ts` + `CLIENT_FORM_FIELDS` in `src/lib/fieldConfig.ts` |
| Table / map popup columns | `showInTable` / `showOnMapPopup` on field definitions |
| CSV synonyms | `src/lib/csvGuessMapping.ts` |
| Dedupe rules | `computeDedupeKey` in `src/lib/clientRecord.ts` |
| Dashboard KPIs | `src/app/(admin)/dashboard/page.tsx` |
| Map filters | `src/app/(admin)/map/page.tsx` (compose filters → `filtered` clients) |

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Development server |
| `npm run build` | Production build (uses **webpack** so Mapbox GL bundles correctly; Next 16’s default Turbopack build can fail on `mapbox-gl` dynamic imports) |
| `npm run start` | Run production build |
| `npm run lint` | ESLint |

## License

Private / internal use for Ramos James Law.

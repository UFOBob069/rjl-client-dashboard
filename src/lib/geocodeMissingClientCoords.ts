import type { Client } from "@/types/client";
import { addressForGeocode } from "@/lib/address";
import { clientHasCoordinates } from "@/lib/clientRecord";
import { geocodeAddress, mapPool } from "@/lib/geocode";
import { updateClient } from "@/lib/firestore/clients";

export type GeocodeMissingResult = {
  /** Clients with any newly resolved coordinates merged in */
  clients: Client[];
  attempted: number;
  succeeded: number;
};

/**
 * For clients with no lat/lng but a usable address string, call Mapbox forward geocoding
 * and persist coordinates to Firestore. Used by the map page so pins appear without a CSV re-import.
 *
 * Pass `onlyIds` to geocode just that subset (e.g. first-time attempts); omit to process all eligible rows.
 * Extension: throttle / queue here if you routinely geocode thousands of rows client-side.
 */
export async function geocodeClientsMissingCoordinates(
  clients: Client[],
  options?: { concurrency?: number; persist?: boolean; onlyIds?: Set<string> }
): Promise<GeocodeMissingResult> {
  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
  if (!token?.trim()) {
    return { clients, attempted: 0, succeeded: 0 };
  }

  const concurrency = options?.concurrency ?? 3;
  const persist = options?.persist ?? true;
  const idFilter = options?.onlyIds;

  const need = clients.filter((c) => {
    if (idFilter && !idFilter.has(c.id)) return false;
    return !clientHasCoordinates(c) && Boolean(addressForGeocode(c));
  });
  if (!need.length) {
    return { clients, attempted: 0, succeeded: 0 };
  }

  const byId = new Map(clients.map((c) => [c.id, { ...c }]));

  let succeeded = 0;
  await mapPool(need, concurrency, async (c) => {
    const addr = addressForGeocode(c);
    if (!addr) return;
    const g = await geocodeAddress(addr);
    if (!g) return;
    if (persist) {
      try {
        await updateClient(c.id, { latitude: g.latitude, longitude: g.longitude });
      } catch {
        return;
      }
    }
    const row = byId.get(c.id);
    if (row) {
      row.latitude = g.latitude;
      row.longitude = g.longitude;
    }
    succeeded++;
  });

  return {
    clients: clients.map((c) => byId.get(c.id) ?? c),
    attempted: need.length,
    succeeded,
  };
}

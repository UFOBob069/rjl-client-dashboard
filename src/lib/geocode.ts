/**
 * Geocoding via Mapbox Geocoding API.
 * Swap: implement the same function signature with Google Geocoding, HERE, etc.
 * Keep server-side keys in API Route if you need to hide tokens in production.
 */
export type GeocodeResult = {
  latitude: number;
  longitude: number;
  placeName?: string;
};

export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
  if (!token || !address.trim()) return null;

  const url = new URL(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json`
  );
  url.searchParams.set("access_token", token);
  url.searchParams.set("limit", "1");

  const res = await fetch(url.toString());
  if (!res.ok) return null;
  const data = (await res.json()) as {
    features?: { center: [number, number]; place_name?: string }[];
  };
  const f = data.features?.[0];
  if (!f?.center) return null;
  const [longitude, latitude] = f.center;
  return { latitude, longitude, placeName: f.place_name };
}

/** Small concurrency pool for import-time geocoding. */
export async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx]!, idx);
    }
  }
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

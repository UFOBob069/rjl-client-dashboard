/**
 * Build a single-line US-style address from parts. Extend for international formats later.
 */
export function buildFullAddress(parts: {
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
}): string {
  const line1 = (parts.street ?? "").trim();
  const city = (parts.city ?? "").trim();
  const state = (parts.state ?? "").trim();
  const zip = (parts.zip ?? "").trim();
  const cityState = [city, state].filter(Boolean).join(", ");
  const tail = [cityState, zip].filter(Boolean).join(" ");
  return [line1, tail].filter(Boolean).join(", ");
}

export function addressForGeocode(client: {
  fullAddress?: string;
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
}): string | null {
  const full = (client.fullAddress ?? "").trim();
  if (full) return full;
  const built = buildFullAddress({
    street: client.street,
    city: client.city,
    state: client.state,
    zip: client.zip,
  });
  return built || null;
}

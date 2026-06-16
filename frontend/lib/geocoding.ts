// Client-side address validation via Mapbox, mirroring the backend check for
// instant UX feedback. The server re-validates authoritatively at order time.

export type AddressCheck = {
  valid: boolean;
  normalized?: string;
  reason?: "not_found" | "low_confidence" | "unavailable";
};

const MIN_RELEVANCE = 0.6;

export async function validateAddressClient(
  addressLine: string,
  city: string,
  postalCode: string
): Promise<AddressCheck> {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  // Without a token we cannot validate here; let the server decide.
  if (!token) return { valid: true, reason: "unavailable" };

  const text = [addressLine, `${postalCode} ${city}`.trim()]
    .filter(Boolean)
    .join(", ");
  const url =
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(text)}.json` +
    `?access_token=${token}&country=pt&language=pt&limit=1&types=address,postcode&autocomplete=false`;

  try {
    const res = await fetch(url);
    if (!res.ok) return { valid: true, reason: "unavailable" };
    const data = await res.json();
    const feature = data.features?.[0];
    if (!feature) return { valid: false, reason: "not_found" };

    const types: string[] = feature.place_type ?? [];
    const accepted = types.includes("address") || types.includes("postcode");
    if ((feature.relevance ?? 0) >= MIN_RELEVANCE && accepted) {
      return { valid: true, normalized: feature.place_name };
    }
    return {
      valid: false,
      normalized: feature.place_name,
      reason: "low_confidence"
    };
  } catch {
    return { valid: true, reason: "unavailable" };
  }
}

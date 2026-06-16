// Client-side address validation via Mapbox, mirroring the backend check for
// instant UX feedback. The server re-validates authoritatively at order time.

export type AddressCheck = {
  valid: boolean;
  normalized?: string;
  reason?: "not_found" | "low_confidence" | "unavailable";
};

const MIN_RELEVANCE = 0.6;

export type PostalLookup = {
  city: string;
  region?: string;
  center?: [number, number]; // [lon, lat]
};

const PT_POSTAL = /^\d{4}-\d{3}$/;

async function geocodePostcode(
  code: string,
  token: string
): Promise<any | null> {
  const url =
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(code)}.json` +
    `?access_token=${token}&country=pt&language=pt&types=postcode,place,locality&limit=1`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    return data.features?.[0] ?? null;
  } catch {
    return null;
  }
}

/**
 * Resolve a Portuguese postal code (NNNN-NNN) to its locality via Mapbox.
 * Falls back to the 4-digit prefix when the full code isn't matched. Returns
 * only the public-safe locality/region + an approximate centre — never a street.
 */
export async function lookupPostalCode(
  postalCode: string
): Promise<PostalLookup | null> {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const code = postalCode.trim();
  if (!token || !PT_POSTAL.test(code)) return null;

  let feature = await geocodePostcode(code, token);
  if (!feature) feature = await geocodePostcode(code.split("-")[0], token);
  if (!feature) return null;

  const ctx: any[] = feature.context ?? [];
  const byId = (prefix: string) =>
    ctx.find(item => String(item.id ?? "").startsWith(prefix))?.text as string | undefined;

  const city = byId("place") || byId("locality") || feature.text || "";
  const region = byId("region");
  const center =
    Array.isArray(feature.center) && feature.center.length === 2
      ? ([feature.center[0], feature.center[1]] as [number, number])
      : undefined;

  if (!city) return null;
  return { city, region, center };
}

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

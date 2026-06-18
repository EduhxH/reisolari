import axios from "axios";
import { backendUrl } from "@/lib/api";

const auth = (idToken: string) => ({ headers: { Authorization: `Bearer ${idToken}` } });

export type MyListing = {
  id: string;
  owner_id: string;
  title: string;
  description: string;
  price_cents: number;
  currency: string;
  condition: string;
  category_path: string[];
  city?: string | null;
  listing_type: string;
  status: "active" | "sold";
  active: boolean;
  image_urls: string[];
  favorites_count: number;
  created_at: string;
};

export type ListingDetail = MyListing & {
  category_id: string | null;
  attributes: Record<string, any>;
  delivery_pickup: boolean;
  delivery_shipping: boolean;
  stock: number;
};

/** Public single-listing fetch (no auth) for the detail page. */
export async function getListing(id: string): Promise<ListingDetail> {
  const res = await axios.get(`${backendUrl}/api/v1/listings/${id}`);
  return res.data;
}

/** All listings owned by the authenticated user (active + sold/archived). */
export async function getMyListings(idToken: string): Promise<MyListing[]> {
  const res = await axios.get(`${backendUrl}/api/v1/listings/mine`, auth(idToken));
  return res.data;
}

export async function markListingSold(idToken: string, id: string): Promise<ListingDetail> {
  const res = await axios.post(`${backendUrl}/api/v1/listings/${id}/mark-sold`, {}, auth(idToken));
  return res.data;
}

export async function reactivateListing(idToken: string, id: string): Promise<ListingDetail> {
  const res = await axios.post(`${backendUrl}/api/v1/listings/${id}/reactivate`, {}, auth(idToken));
  return res.data;
}

export type UpdateListingPayload = {
  title?: string;
  description?: string;
  condition?: string;
  price_cents?: number;
  stock?: number;
  delivery_pickup?: boolean;
  delivery_shipping?: boolean;
  attributes?: Record<string, any>;
  image_urls?: string[];
};

export async function updateListing(
  idToken: string,
  id: string,
  patch: UpdateListingPayload
): Promise<ListingDetail> {
  const res = await axios.patch(`${backendUrl}/api/v1/listings/${id}`, patch, auth(idToken));
  return res.data;
}

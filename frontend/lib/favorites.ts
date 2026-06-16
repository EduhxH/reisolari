import axios from "axios";
import { backendUrl } from "@/lib/api";

const auth = (idToken: string) => ({ headers: { Authorization: `Bearer ${idToken}` } });

export type FavoriteResult = { favorited: boolean; count: number };

export async function addFavorite(idToken: string, listingId: string): Promise<FavoriteResult> {
  const res = await axios.post(
    `${backendUrl}/api/v1/favorites/`,
    { listing_id: listingId },
    auth(idToken)
  );
  return res.data;
}

export async function removeFavorite(idToken: string, listingId: string): Promise<FavoriteResult> {
  const res = await axios.delete(
    `${backendUrl}/api/v1/favorites/${listingId}`,
    auth(idToken)
  );
  return res.data;
}

export async function getFavoriteIds(idToken: string): Promise<string[]> {
  const res = await axios.get(`${backendUrl}/api/v1/favorites/ids`, auth(idToken));
  return res.data;
}

export async function getFavorites(idToken: string): Promise<any[]> {
  const res = await axios.get(`${backendUrl}/api/v1/favorites/`, auth(idToken));
  return res.data;
}

import axios from "axios";
import { backendUrl } from "@/lib/api";

const auth = (idToken: string) => ({ headers: { Authorization: `Bearer ${idToken}` } });

export type MyProfile = {
  uid: string;
  display_name: string | null;
  location: string | null;
  profession: string | null;
  employer: string | null;
  bio: string | null;
  banner_url: string | null;
  avatar_url: string | null;
  member_since: string | null;
};

export type RatingSummary = { average: number; count: number };

export type ProfileListing = {
  id: string;
  title: string;
  price_cents: number;
  currency: string;
  image_urls: string[];
  condition: string;
};

export type PublicProfile = {
  uid: string;
  display_name: string;
  location: string | null;
  profession: string | null;
  employer: string | null;
  bio: string | null;
  banner_url: string | null;
  avatar_url: string | null;
  member_since: string | null;
  rating: RatingSummary;
  listings: ProfileListing[];
  my_rating: { stars: number; comment: string | null } | null;
  can_rate: boolean;
  is_self: boolean;
};

export type UserRating = {
  id: string;
  rater_uid: string;
  rater_name: string;
  rater_avatar: string | null;
  stars: number;
  comment: string | null;
  created_at: string | null;
};

export async function getMyProfile(idToken: string): Promise<MyProfile> {
  const res = await axios.get(`${backendUrl}/api/v1/profiles/me`, auth(idToken));
  return res.data;
}

export async function updateProfile(
  idToken: string,
  data: Partial<MyProfile>
): Promise<MyProfile> {
  const res = await axios.put(`${backendUrl}/api/v1/profiles/me`, data, auth(idToken));
  return res.data;
}

export async function getPublicProfile(
  uid: string,
  idToken?: string | null
): Promise<PublicProfile> {
  const res = await axios.get(
    `${backendUrl}/api/v1/profiles/${uid}`,
    idToken ? auth(idToken) : undefined
  );
  return res.data;
}

export async function rateUser(
  idToken: string,
  uid: string,
  stars: number,
  comment?: string
): Promise<RatingSummary> {
  const res = await axios.post(
    `${backendUrl}/api/v1/profiles/${uid}/ratings`,
    { stars, comment },
    auth(idToken)
  );
  return res.data;
}

export async function getUserRatings(uid: string): Promise<UserRating[]> {
  const res = await axios.get(`${backendUrl}/api/v1/profiles/${uid}/ratings`);
  return res.data;
}

export type ProfileSummary = {
  uid: string;
  display_name: string;
  avatar_url: string | null;
  rating: RatingSummary;
};

/** Batch seller cards (name, avatar, rating) for listing owners. */
export async function getProfilesSummary(
  uids: string[]
): Promise<Record<string, ProfileSummary>> {
  const unique = Array.from(new Set(uids.filter(Boolean)));
  if (unique.length === 0) return {};
  const res = await axios.get(`${backendUrl}/api/v1/profiles/summary`, {
    params: { uids: unique.join(",") }
  });
  return res.data;
}

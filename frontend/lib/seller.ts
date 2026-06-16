import axios from "axios";
import { backendUrl } from "@/lib/api";

export type SellerProfile = {
  firebase_uid: string;
  is_seller: boolean;
  email?: string | null;
};

export type AdDraft = {
  step: number;
  data: Record<string, any>;
  updated_at: string;
};

const authHeader = (idToken: string) => ({
  headers: { Authorization: `Bearer ${idToken}` }
});

export async function upsertSellerProfile(idToken: string): Promise<SellerProfile> {
  const res = await axios.post(
    `${backendUrl}/api/v1/seller/profile`,
    {},
    authHeader(idToken)
  );
  return res.data;
}

export async function getSellerProfile(idToken: string): Promise<SellerProfile> {
  const res = await axios.get(`${backendUrl}/api/v1/seller/profile`, authHeader(idToken));
  return res.data;
}

export async function getDraft(idToken: string): Promise<AdDraft | null> {
  const res = await axios.get(`${backendUrl}/api/v1/seller/drafts`, authHeader(idToken));
  return res.data ?? null;
}

export async function saveDraft(
  idToken: string,
  step: number,
  data: Record<string, any>
): Promise<void> {
  await axios.put(
    `${backendUrl}/api/v1/seller/drafts`,
    { step, data },
    authHeader(idToken)
  );
}

export async function deleteDraft(idToken: string): Promise<void> {
  await axios.delete(`${backendUrl}/api/v1/seller/drafts`, authHeader(idToken));
}

/** Publish the finished listing (Fase 6). Returns the created listing id. */
export async function publishListing(
  idToken: string,
  payload: Record<string, any>
): Promise<{ id: string }> {
  const res = await axios.post(
    `${backendUrl}/api/v1/listings/`,
    payload,
    authHeader(idToken)
  );
  return res.data;
}

import axios from "axios";
import { backendUrl } from "@/lib/api";

const auth = (idToken: string) => ({ headers: { Authorization: `Bearer ${idToken}` } });

export type AppNotification = {
  id: string;
  type: "new_message" | "favorite";
  title: string;
  body: string;
  data: Record<string, any>;
  read: boolean;
  created_at: string;
};

export async function listNotifications(idToken: string): Promise<AppNotification[]> {
  const res = await axios.get(`${backendUrl}/api/v1/notifications/`, auth(idToken));
  return res.data;
}

export async function getUnreadCount(idToken: string): Promise<number> {
  const res = await axios.get(`${backendUrl}/api/v1/notifications/unread-count`, auth(idToken));
  return res.data.count;
}

export async function markAllRead(idToken: string): Promise<void> {
  await axios.post(`${backendUrl}/api/v1/notifications/read-all`, {}, auth(idToken));
}

export async function markRead(idToken: string, id: string): Promise<void> {
  await axios.post(`${backendUrl}/api/v1/notifications/${id}/read`, {}, auth(idToken));
}

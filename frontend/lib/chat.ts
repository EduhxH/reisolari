import axios from "axios";
import { backendUrl } from "@/lib/api";

const auth = (idToken: string) => ({ headers: { Authorization: `Bearer ${idToken}` } });

export type ChatMessage = {
  id: string;
  room_id: string;
  sender_uid: string;
  kind: "user" | "system";
  content: string;
  flagged: boolean;
  created_at: string;
};

export type ChatRoomListing = {
  id: string;
  title: string;
  price_cents: number;
  image_url: string | null;
  active: boolean;
} | null;

export type ChatRoom = {
  id: string;
  listing_id: string;
  listing: ChatRoomListing;
  role: "buyer" | "seller";
  counterparty_uid: string;
  last_message: ChatMessage | null;
  unread: number;
  created_at: string;
};

export async function createRoom(idToken: string, listingId: string): Promise<ChatRoom> {
  const res = await axios.post(
    `${backendUrl}/api/v1/chat/rooms`,
    { listing_id: listingId },
    auth(idToken)
  );
  return res.data;
}

export async function listRooms(idToken: string): Promise<ChatRoom[]> {
  const res = await axios.get(`${backendUrl}/api/v1/chat/rooms`, auth(idToken));
  return res.data;
}

export async function getMessages(idToken: string, roomId: string): Promise<ChatMessage[]> {
  const res = await axios.get(
    `${backendUrl}/api/v1/chat/rooms/${roomId}/messages`,
    auth(idToken)
  );
  return res.data;
}

export async function sendMessage(
  idToken: string,
  roomId: string,
  content: string
): Promise<{ message: ChatMessage; warning: string | null }> {
  const res = await axios.post(
    `${backendUrl}/api/v1/chat/rooms/${roomId}/messages`,
    { content },
    auth(idToken)
  );
  return res.data;
}

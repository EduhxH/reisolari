"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState
} from "react";
import { useAuth } from "@/lib/auth";
import { backendUrl } from "@/lib/api";
import {
  getUnreadCount,
  listNotifications,
  markAllRead as apiMarkAllRead,
  type AppNotification
} from "@/lib/notifications";
import type { ChatMessage } from "@/lib/chat";

type MessageHandler = (message: ChatMessage) => void;
type PushPermission = NotificationPermission | "unsupported";

type RealtimeContextValue = {
  connected: boolean;
  notifications: AppNotification[];
  unreadCount: number;
  pushPermission: PushPermission;
  requestPushPermission: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
  markAllRead: () => Promise<void>;
  subscribeMessages: (roomId: string, handler: MessageHandler) => () => void;
};

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

function wsBase(): string {
  if (backendUrl) return backendUrl.replace(/^http/, "ws");
  if (typeof window !== "undefined") {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${proto}//${window.location.host}`;
  }
  return "";
}

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [connected, setConnected] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pushPermission, setPushPermission] = useState<PushPermission>("default");

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const subscribersRef = useRef<Map<string, Set<MessageHandler>>>(new Map());

  useEffect(() => {
    setPushPermission(typeof Notification === "undefined" ? "unsupported" : Notification.permission);
  }, []);

  const subscribeMessages = useCallback((roomId: string, handler: MessageHandler) => {
    const map = subscribersRef.current;
    if (!map.has(roomId)) map.set(roomId, new Set());
    map.get(roomId)!.add(handler);
    return () => {
      const set = map.get(roomId);
      if (set) {
        set.delete(handler);
        if (set.size === 0) map.delete(roomId);
      }
    };
  }, []);

  const showBrowserNotification = useCallback((n: AppNotification) => {
    try {
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        const notification = new Notification(n.title, { body: n.body, tag: n.id });
        notification.onclick = () => {
          window.focus();
          if (n.data?.room_id) window.location.href = `/mensagens?room=${n.data.room_id}`;
        };
      }
    } catch {
      // notifications unavailable — silently skip
    }
  }, []);

  const refreshNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const [list, count] = await Promise.all([listNotifications(token), getUnreadCount(token)]);
      setNotifications(list);
      setUnreadCount(count);
    } catch {
      // ignore transient errors
    }
  }, [user]);

  const markAllRead = useCallback(async () => {
    if (!user) return;
    try {
      const token = await user.getIdToken();
      await apiMarkAllRead(token);
      setUnreadCount(0);
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch {
      // ignore
    }
  }, [user]);

  const requestPushPermission = useCallback(async () => {
    if (typeof Notification === "undefined") {
      setPushPermission("unsupported");
      return;
    }
    try {
      setPushPermission(await Notification.requestPermission());
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      setConnected(false);
      return;
    }
    let cancelled = false;

    const scheduleReconnect = () => {
      if (cancelled) return;
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      reconnectRef.current = setTimeout(connect, 3000);
    };

    const connect = async () => {
      if (cancelled) return;
      let token: string;
      try {
        token = await user.getIdToken();
      } catch {
        return;
      }
      if (cancelled) return;
      let ws: WebSocket;
      try {
        ws = new WebSocket(`${wsBase()}/ws/stream?token=${encodeURIComponent(token)}`);
      } catch {
        scheduleReconnect();
        return;
      }
      wsRef.current = ws;

      ws.onopen = () => {
        if (!cancelled) setConnected(true);
      };
      ws.onclose = () => {
        if (!cancelled) {
          setConnected(false);
          scheduleReconnect();
        }
      };
      ws.onerror = () => {
        try {
          ws.close();
        } catch {
          // ignore
        }
      };
      ws.onmessage = event => {
        let payload: any;
        try {
          payload = JSON.parse(event.data);
        } catch {
          return;
        }
        if (payload.type === "notification" && payload.notification) {
          const n = payload.notification as AppNotification;
          setNotifications(prev => [n, ...prev].slice(0, 50));
          setUnreadCount(prev => prev + 1);
          showBrowserNotification(n);
        } else if (payload.type === "message" && payload.message) {
          const handlers = subscribersRef.current.get(payload.room_id);
          if (handlers) handlers.forEach(handler => handler(payload.message as ChatMessage));
        }
      };
    };

    connect();
    refreshNotifications();

    return () => {
      cancelled = true;
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      if (wsRef.current) {
        try {
          wsRef.current.close();
        } catch {
          // ignore
        }
        wsRef.current = null;
      }
    };
  }, [user, refreshNotifications, showBrowserNotification]);

  const value: RealtimeContextValue = {
    connected,
    notifications,
    unreadCount,
    pushPermission,
    requestPushPermission,
    refreshNotifications,
    markAllRead,
    subscribeMessages
  };
  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export function useRealtime(): RealtimeContextValue {
  const ctx = useContext(RealtimeContext);
  if (!ctx) throw new Error("useRealtime must be used within a RealtimeProvider");
  return ctx;
}

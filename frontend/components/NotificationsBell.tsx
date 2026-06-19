"use client";

import Link from "next/link";
import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, MessageSquare, Star, UserRound } from "lucide-react";
import { useRealtime } from "@/lib/realtime";

function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "agora";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

function iconFor(n: { data?: { room_id?: string; profile_uid?: string } }) {
  if (n.data?.room_id) return <MessageSquare className="h-4 w-4" />;
  if (n.data?.profile_uid) return <Star className="h-4 w-4" />;
  return <UserRound className="h-4 w-4" />;
}

export default function NotificationsBell() {
  const { notifications, unreadCount, markAllRead, pushPermission, requestPushPermission } = useRealtime();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && unreadCount > 0) markAllRead();
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={toggle}
        className="supaste-button relative grid h-10 w-10 place-items-center rounded-full bg-white text-supaste-ink ring-1 ring-black/10"
        aria-label="Notificações"
      >
        <motion.span
          animate={unreadCount > 0 ? { rotate: [0, -12, 12, -8, 8, 0] } : {}}
          transition={{ duration: 0.6, repeat: unreadCount > 0 ? Infinity : 0, repeatDelay: 3 }}
        >
          <Bell className="h-4 w-4" />
        </motion.span>
        {unreadCount > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-[16px] place-items-center rounded-full bg-supaste-blue px-1 text-[10px] font-bold text-white ring-2 ring-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="supaste-glass-strong absolute right-0 z-50 mt-2 max-h-[26rem] w-80 overflow-auto rounded-[24px] p-1.5"
          >
            <div className="flex items-center justify-between px-3 py-2">
              <span className="text-sm font-semibold text-supaste-ink">Notificações</span>
              {notifications.length > 0 ? (
                <span className="rounded-full bg-supaste-section px-2 py-0.5 text-[10px] font-semibold text-supaste-muted">
                  {notifications.length}
                </span>
              ) : null}
            </div>

            {pushPermission === "default" ? (
              <button
                onClick={requestPushPermission}
                className="mb-1 w-full rounded-[18px] bg-supaste-blue/8 px-3 py-2 text-left text-[11px] font-semibold text-supaste-blue transition-colors hover:bg-supaste-blue/12"
              >
                Ativar notificações do navegador em tempo real
              </button>
            ) : pushPermission === "denied" ? (
              <div className="mb-1 rounded-[18px] px-3 py-2 text-[11px] text-supaste-muted">
                Notificações do navegador bloqueadas nas definições do site.
              </div>
            ) : null}

            {notifications.length === 0 ? (
              <div className="grid place-items-center gap-2 p-8 text-center">
                <span className="grid h-12 w-12 place-items-center rounded-full bg-supaste-section text-supaste-muted">
                  <Bell className="h-5 w-5" />
                </span>
                <p className="text-xs text-supaste-muted">Sem notificações por agora.</p>
              </div>
            ) : (
              <ul className="space-y-0.5">
                {notifications.map(n => {
                  const href = n.data?.room_id
                    ? `/mensagens?room=${n.data.room_id}`
                    : n.data?.profile_uid
                    ? `/perfil/${n.data.profile_uid}`
                    : "/marketplace";
                  return (
                    <li key={n.id}>
                      <Link
                        href={href}
                        onClick={() => setOpen(false)}
                        className={`flex items-start gap-3 rounded-[18px] px-3 py-2.5 transition-colors hover:bg-supaste-section ${
                          n.read ? "" : "bg-supaste-blue/5"
                        }`}
                      >
                        <span
                          className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full ${
                            n.read ? "bg-supaste-section text-supaste-muted" : "bg-supaste-blue/15 text-supaste-blue"
                          }`}
                        >
                          {iconFor(n)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-xs font-semibold text-supaste-ink">{n.title}</span>
                            <span className="shrink-0 text-[10px] text-supaste-muted">{timeAgo(n.created_at)}</span>
                          </div>
                          <p className="mt-0.5 line-clamp-2 text-[11px] text-supaste-muted">{n.body}</p>
                        </div>
                        {!n.read ? <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-supaste-blue" /> : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

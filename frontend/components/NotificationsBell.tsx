"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRealtime } from "@/lib/realtime";

function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "agora";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

export default function NotificationsBell() {
  const {
    notifications,
    unreadCount,
    markAllRead,
    pushPermission,
    requestPushPermission
  } = useRealtime();
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
        className="relative h-9 w-9 grid place-items-center rounded-lg border border-slate-800 bg-slate-900 text-slate-200 hover:border-emerald-600 transition-colors"
        aria-label="Notificações"
      >
        <span aria-hidden>🔔</span>
        {unreadCount > 0 ? (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 grid place-items-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-auto rounded-xl border border-slate-800 bg-card shadow-xl z-50">
          <div className="p-3 border-b border-slate-800">
            <span className="text-sm font-semibold text-white">Notificações</span>
          </div>

          {pushPermission === "default" ? (
            <button
              onClick={requestPushPermission}
              className="w-full text-left px-3 py-2 text-[11px] text-emerald-300 bg-emerald-500/5 hover:bg-emerald-500/10 border-b border-slate-800"
            >
              🔔 Ativar notificações do navegador em tempo real
            </button>
          ) : pushPermission === "denied" ? (
            <div className="px-3 py-2 text-[11px] text-slate-500 border-b border-slate-800">
              Notificações do navegador bloqueadas nas definições do site.
            </div>
          ) : null}

          {notifications.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500">Sem notificações.</div>
          ) : (
            <ul className="divide-y divide-slate-800/60">
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
                      className={`block px-3 py-2.5 hover:bg-slate-800/40 transition-colors ${
                        n.read ? "" : "bg-emerald-500/5"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-slate-100">{n.title}</span>
                        <span className="text-[10px] text-slate-500">{timeAgo(n.created_at)}</span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-2">{n.body}</p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}

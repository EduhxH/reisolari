"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { useRealtime } from "@/lib/realtime";
import { useRequireAuth, AuthChecking } from "@/lib/useRequireAuth";
import { formatPrice } from "@/lib/api";
import {
  getMessages,
  listRooms,
  sendMessage,
  type ChatMessage,
  type ChatRoom
} from "@/lib/chat";

function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
}

export default function MensagensPage() {
  const { user, loading } = useAuth();
  const { ready } = useRequireAuth();
  const { subscribeMessages } = useRealtime();
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const activeRoom = rooms.find(room => room.id === activeId) ?? null;

  // Load rooms once authenticated; honour ?room=<id> deep links.
  useEffect(() => {
    if (loading || !user) return;
    let cancelled = false;
    (async () => {
      const token = await user.getIdToken();
      const list = await listRooms(token).catch(() => []);
      if (cancelled) return;
      setRooms(list);
      const wanted = new URLSearchParams(window.location.search).get("room");
      setActiveId(prev => prev ?? wanted ?? list[0]?.id ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, loading]);

  // Load the active conversation's history.
  useEffect(() => {
    if (!user || !activeId) {
      setMessages([]);
      return;
    }
    let cancelled = false;
    setWarning(null);
    (async () => {
      const token = await user.getIdToken();
      const history = await getMessages(token, activeId).catch(() => []);
      if (cancelled) return;
      setMessages(history);
      setRooms(prev => prev.map(room => (room.id === activeId ? { ...room, unread: 0 } : room)));
    })();
    return () => {
      cancelled = true;
    };
  }, [user, activeId]);

  // Live updates for the open conversation.
  useEffect(() => {
    if (!activeId) return;
    return subscribeMessages(activeId, incoming => {
      setMessages(prev => (prev.some(m => m.id === incoming.id) ? prev : [...prev, incoming]));
      if (incoming.kind === "system") setWarning(incoming.content);
    });
  }, [activeId, subscribeMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    const content = input.trim();
    if (!content || !user || !activeId || sending) return;
    setSending(true);
    try {
      const token = await user.getIdToken();
      const result = await sendMessage(token, activeId, content);
      setInput("");
      setMessages(prev =>
        prev.some(m => m.id === result.message.id) ? prev : [...prev, result.message]
      );
      if (result.warning) setWarning(result.warning);
    } catch {
      // keep the input so the user can retry
    } finally {
      setSending(false);
    }
  };

  if (!ready) {
    return <AuthChecking />;
  }

  return (
    <main className="min-h-screen bg-bg text-slate-100 p-4 sm:p-6">
      <div className="max-w-5xl mx-auto space-y-4">
        <header className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-white">Mensagens</h1>
          <div className="flex items-center gap-3 text-xs">
            <Link href="/diretrizes" className="text-slate-400 hover:text-emerald-300">
              🔒 Diretrizes de segurança
            </Link>
            <Link href="/marketplace" className="text-slate-300 hover:text-emerald-300 font-semibold">
              ← Marketplace
            </Link>
          </div>
        </header>

        <div className="grid md:grid-cols-[280px,1fr] gap-4 h-[70vh]">
          {/* Rooms list */}
          <aside className="rounded-xl border border-slate-800 bg-card overflow-auto">
            {rooms.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">
                Sem conversas ainda. Contacte um vendedor a partir de um anúncio.
              </div>
            ) : (
              <ul className="divide-y divide-slate-800/60">
                {rooms.map(room => (
                  <li key={room.id}>
                    <button
                      onClick={() => setActiveId(room.id)}
                      className={`w-full text-left px-3 py-3 hover:bg-slate-800/40 transition-colors ${
                        room.id === activeId ? "bg-slate-800/60" : ""
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className="h-9 w-9 rounded bg-slate-950 overflow-hidden shrink-0">
                          {room.listing?.image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={room.listing.image_url} alt="" className="h-full w-full object-cover" />
                          ) : null}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-slate-100 truncate">
                              {room.listing?.title ?? "Anúncio"}
                            </span>
                            {room.unread > 0 ? (
                              <span className="min-w-[16px] h-4 px-1 grid place-items-center rounded-full bg-emerald-500 text-[10px] font-bold text-slate-950">
                                {room.unread}
                              </span>
                            ) : null}
                          </div>
                          <span className="text-[10px] text-slate-500">
                            {room.role === "buyer" ? "Vendedor" : "Comprador"}
                            {room.last_message ? ` · ${room.last_message.content.slice(0, 24)}` : ""}
                          </span>
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </aside>

          {/* Thread */}
          <section className="rounded-xl border border-slate-800 bg-card flex flex-col">
            {activeRoom ? (
              <>
                <div className="p-3 border-b border-slate-800 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">
                      {activeRoom.listing?.title ?? "Anúncio"}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      <Link href={`/perfil/${activeRoom.counterparty_uid}`} className="hover:text-emerald-300">
                        {activeRoom.role === "buyer" ? "Ver perfil do vendedor" : "Ver perfil do comprador"}
                      </Link>
                      {activeRoom.listing ? ` · ${formatPrice(activeRoom.listing.price_cents)}` : ""}
                    </p>
                  </div>
                  <Link
                    href={activeRoom.listing ? `/anuncio/${activeRoom.listing_id}` : "/marketplace"}
                    className="text-[11px] text-emerald-300 hover:text-emerald-200 whitespace-nowrap"
                  >
                    Ver anúncio
                  </Link>
                </div>

                <div className="flex-1 overflow-auto p-3 space-y-2">
                  {messages.map(message => {
                    if (message.kind === "system") {
                      return (
                        <div key={message.id} className="flex justify-center">
                          <div className="max-w-[85%] rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200 text-center">
                            {message.content}
                          </div>
                        </div>
                      );
                    }
                    const mine = message.sender_uid === user?.uid;
                    return (
                      <div key={message.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                            mine
                              ? "bg-emerald-500 text-slate-950 rounded-br-sm"
                              : "bg-slate-800 text-slate-100 rounded-bl-sm"
                          }`}
                        >
                          <p className="whitespace-pre-wrap break-words">{message.content}</p>
                          <span className={`block text-[9px] mt-0.5 ${mine ? "text-emerald-950/70" : "text-slate-500"}`}>
                            {timeOf(message.created_at)}
                            {message.flagged ? " · ⚠️" : ""}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={bottomRef} />
                </div>

                {warning ? (
                  <div className="px-3 py-1.5 text-[10px] text-amber-300/90 bg-amber-500/5 border-t border-amber-500/20">
                    {warning}
                  </div>
                ) : null}

                <div className="p-3 border-t border-slate-800 flex items-center gap-2">
                  <input
                    value={input}
                    onChange={event => setInput(event.target.value)}
                    onKeyDown={event => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        send();
                      }
                    }}
                    placeholder="Escreva uma mensagem…"
                    className="flex-1 rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-600"
                  />
                  <button
                    onClick={send}
                    disabled={sending || !input.trim()}
                    className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-950 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Enviar
                  </button>
                </div>
              </>
            ) : (
              <div className="flex-1 grid place-items-center text-xs text-slate-500">
                Selecione uma conversa.
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

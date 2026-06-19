"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { AlertTriangle, ArrowLeft, Send, Shield } from "lucide-react";
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
      setMessages(prev => (prev.some(m => m.id === result.message.id) ? prev : [...prev, result.message]));
      if (result.warning) setWarning(result.warning);
    } catch {
      // keep the input so the user can retry
    } finally {
      setSending(false);
    }
  };

  if (!ready) return <AuthChecking />;

  return (
    <main className="flex h-screen flex-col bg-supaste-mist text-supaste-ink">
      <header className="px-4 pt-4">
        <nav className="supaste-glass-strong mx-auto flex max-w-6xl items-center justify-between rounded-full px-4 py-2.5">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/images/reisolari-logo.jpeg" alt="Reisolari" width={30} height={30} className="rounded-full" />
            <span className="font-display text-base font-semibold tracking-tight">Mensagens</span>
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/diretrizes" className="flex items-center gap-1.5 text-supaste-muted transition-colors hover:text-supaste-blue">
              <Shield className="h-4 w-4" /> Segurança
            </Link>
            <Link href="/marketplace" className="flex items-center gap-1.5 font-medium text-supaste-muted transition-colors hover:text-supaste-blue">
              <ArrowLeft className="h-4 w-4" /> Marketplace
            </Link>
          </div>
        </nav>
      </header>

      <div className="mx-auto flex w-full max-w-6xl flex-1 gap-4 overflow-hidden p-4">
        {/* Conversations */}
        <aside className={`${activeRoom ? "hidden md:flex" : "flex"} w-full flex-col overflow-hidden rounded-[24px] bg-white shadow-soft-float md:w-80`}>
          <div className="border-b border-black/5 px-4 py-3 text-sm font-semibold">Conversas</div>
          {rooms.length === 0 ? (
            <div className="grid flex-1 place-items-center p-6 text-center text-xs text-supaste-muted">
              Sem conversas ainda. Contacte um vendedor a partir de um anúncio.
            </div>
          ) : (
            <ul className="flex-1 overflow-y-auto">
              {rooms.map(room => (
                <li key={room.id}>
                  <button
                    onClick={() => setActiveId(room.id)}
                    className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${
                      room.id === activeId ? "bg-supaste-section" : "hover:bg-supaste-section/60"
                    }`}
                  >
                    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl bg-supaste-section">
                      {room.listing?.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={room.listing.image_url} alt="" className="h-full w-full object-cover" />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-semibold text-supaste-ink">
                          {room.listing?.title ?? "Anúncio"}
                        </span>
                        {room.unread > 0 ? (
                          <span className="grid h-5 min-w-[20px] place-items-center rounded-full bg-supaste-blue px-1 text-[10px] font-bold text-white">
                            {room.unread}
                          </span>
                        ) : null}
                      </div>
                      <span className="block truncate text-[11px] text-supaste-muted">
                        {room.role === "buyer" ? "Vendedor" : "Comprador"}
                        {room.last_message ? ` · ${room.last_message.content}` : ""}
                      </span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        {/* Thread */}
        <section className={`${activeRoom ? "flex" : "hidden md:flex"} min-w-0 flex-1 flex-col overflow-hidden rounded-[24px] bg-white shadow-soft-float`}>
          {activeRoom ? (
            <>
              <div className="flex items-center justify-between gap-3 border-b border-black/5 px-4 py-3">
                <button onClick={() => setActiveId(null)} className="grid h-9 w-9 shrink-0 place-items-center rounded-full hover:bg-supaste-section md:hidden" aria-label="Voltar">
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-supaste-ink">{activeRoom.listing?.title ?? "Anúncio"}</p>
                  <p className="truncate text-[11px] text-supaste-muted">
                    <Link href={`/perfil/${activeRoom.counterparty_uid}`} className="hover:text-supaste-blue">
                      {activeRoom.role === "buyer" ? "Ver perfil do vendedor" : "Ver perfil do comprador"}
                    </Link>
                    {activeRoom.listing ? ` · ${formatPrice(activeRoom.listing.price_cents)}` : ""}
                  </p>
                </div>
                <Link
                  href={activeRoom.listing ? `/anuncio/${activeRoom.listing_id}` : "/marketplace"}
                  className="shrink-0 rounded-full bg-supaste-section px-3 py-1.5 text-[11px] font-semibold text-supaste-ink hover:bg-[#ececef]"
                >
                  Ver anúncio
                </Link>
              </div>

              <div className="flex-1 space-y-2.5 overflow-y-auto scroll-smooth bg-supaste-mist/40 p-4">
                {messages.map(message => {
                  if (message.kind === "system") {
                    return (
                      <div key={message.id} className="flex justify-center">
                        <div className="flex max-w-[85%] items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-[11px] text-amber-700">
                          <AlertTriangle className="h-3 w-3 shrink-0" />
                          <span>{message.content}</span>
                        </div>
                      </div>
                    );
                  }
                  const mine = message.sender_uid === user?.uid;
                  return (
                    <motion.div
                      key={message.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25 }}
                      className={`flex ${mine ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm ${
                          mine
                            ? "rounded-br-md bg-supaste-blue text-white"
                            : "rounded-bl-md bg-white text-supaste-ink shadow-soft-float"
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words">{message.content}</p>
                        <span className={`mt-0.5 flex items-center gap-1 text-[9px] ${mine ? "text-white/70" : "text-supaste-muted"}`}>
                          {timeOf(message.created_at)}
                          {message.flagged ? <AlertTriangle className="h-2.5 w-2.5" /> : null}
                        </span>
                      </div>
                    </motion.div>
                  );
                })}
                <div ref={bottomRef} />
              </div>

              {warning ? (
                <div className="flex items-center gap-1.5 border-t border-amber-200 bg-amber-50 px-4 py-2 text-[11px] text-amber-700">
                  <AlertTriangle className="h-3 w-3 shrink-0" /> {warning}
                </div>
              ) : null}

              <div className="flex items-center gap-2 border-t border-black/5 p-3">
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
                  className="min-w-0 flex-1 rounded-full border border-black/10 bg-supaste-mist px-4 py-2.5 text-sm text-supaste-ink outline-none focus:border-supaste-blue"
                />
                <button
                  onClick={send}
                  disabled={sending || !input.trim()}
                  className="supaste-button grid h-11 w-11 shrink-0 place-items-center rounded-full bg-supaste-black text-white disabled:opacity-40"
                  aria-label="Enviar"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </>
          ) : (
            <div className="grid flex-1 place-items-center text-sm text-supaste-muted">Selecione uma conversa.</div>
          )}
        </section>
      </div>
    </main>
  );
}

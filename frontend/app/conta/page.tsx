"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { formatPrice } from "@/lib/api";
import { displayNameFor } from "@/lib/auth";
import {
  getMyListings,
  markListingSold,
  reactivateListing,
  type MyListing
} from "@/lib/listings";
import { listRooms, type ChatRoom } from "@/lib/chat";
import { getFavorites, removeFavorite } from "@/lib/favorites";
import { getMyProfile, updateProfile, type MyProfile } from "@/lib/profile";
import { compressToWebp, uploadImage } from "@/lib/imageUpload";
import { useRequireAuth, AuthChecking } from "@/lib/useRequireAuth";
import { checkAdmin } from "@/lib/reports";

type Tab = "listings" | "chats" | "favorites" | "perfil";

const EMPTY_PROFILE: MyProfile = {
  uid: "",
  display_name: "",
  location: "",
  profession: "",
  employer: "",
  bio: "",
  banner_url: null,
  avatar_url: null,
  member_since: null
};

const inputClass =
  "w-full mt-1 rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-600";

const conditionLabels: Record<string, string> = {
  novo: "Novo",
  usado_como_novo: "Como novo",
  usado_sinais: "Usado",
  pecas: "Para peças"
};

function StatusBadge({ listing }: { listing: MyListing }) {
  const cls =
    listing.status === "sold"
      ? "bg-amber-400/20 text-amber-300 border-amber-500/30"
      : listing.active
      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
      : "bg-slate-700/40 text-slate-400 border-slate-600/40";
  const label = listing.status === "sold" ? "Vendido" : listing.active ? "Ativo" : "Inativo";
  return <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${cls}`}>{label}</span>;
}

export default function ContaPage() {
  const { user, loading } = useAuth();
  const { ready } = useRequireAuth();
  const [tab, setTab] = useState<Tab>("listings");
  const [listings, setListings] = useState<MyListing[]>([]);
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [favorites, setFavorites] = useState<MyListing[]>([]);
  const [loadingTab, setLoadingTab] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [uploading, setUploading] = useState<"banner" | "avatar" | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("tab");
    if (requested === "perfil" || requested === "chats" || requested === "favorites") {
      setTab(requested as Tab);
    }
  }, []);

  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      return;
    }
    let cancelled = false;
    user
      .getIdToken()
      .then(token => checkAdmin(token))
      .then(value => {
        if (!cancelled) setIsAdmin(value);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (loading || !user) return;
    let cancelled = false;
    setLoadingTab(true);
    (async () => {
      const token = await user.getIdToken();
      if (cancelled) return;
      if (tab === "listings") {
        const data = await getMyListings(token).catch(() => []);
        if (!cancelled) setListings(data);
      } else if (tab === "chats") {
        const data = await listRooms(token).catch(() => []);
        if (!cancelled) setRooms(data);
      } else if (tab === "favorites") {
        const data = await getFavorites(token).catch(() => []);
        if (!cancelled) setFavorites(data);
      } else if (tab === "perfil") {
        const data = await getMyProfile(token).catch(() => null);
        if (!cancelled && data) setProfile(data);
      }
      if (!cancelled) setLoadingTab(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, loading, tab]);

  const toggleSold = async (listing: MyListing) => {
    if (!user) return;
    setBusy(listing.id);
    try {
      const token = await user.getIdToken();
      const updated =
        listing.status === "sold"
          ? await reactivateListing(token, listing.id)
          : await markListingSold(token, listing.id);
      setListings(prev => prev.map(item => (item.id === listing.id ? updated : item)));
    } catch {
      // ignore
    } finally {
      setBusy(null);
    }
  };

  const unfavorite = async (id: string) => {
    if (!user) return;
    try {
      const token = await user.getIdToken();
      await removeFavorite(token, id);
      setFavorites(prev => prev.filter(item => item.id !== id));
    } catch {
      // ignore
    }
  };

  const setProfileField = (key: keyof MyProfile, value: string) => {
    setProfile(prev => ({ ...(prev ?? EMPTY_PROFILE), [key]: value }));
    setProfileSaved(false);
  };

  const uploadProfileImage = async (kind: "banner" | "avatar", file: File) => {
    if (!user) return;
    setUploading(kind);
    try {
      const token = await user.getIdToken();
      const blob = await compressToWebp(file);
      const { url } = await uploadImage(blob, token);
      setProfile(prev => ({
        ...(prev ?? EMPTY_PROFILE),
        [kind === "banner" ? "banner_url" : "avatar_url"]: url
      }));
      setProfileSaved(false);
    } catch {
      // validation/upload errors are surfaced by the picker constraints
    } finally {
      setUploading(null);
    }
  };

  const saveProfile = async () => {
    if (!user || !profile) return;
    setSavingProfile(true);
    try {
      const token = await user.getIdToken();
      const creation = user.metadata?.creationTime;
      const memberSince = creation ? new Date(creation).toISOString() : undefined;
      const saved = await updateProfile(token, {
        display_name: profile.display_name,
        location: profile.location,
        profession: profile.profession,
        employer: profile.employer,
        bio: profile.bio,
        banner_url: profile.banner_url,
        avatar_url: profile.avatar_url,
        ...(memberSince ? { member_since: memberSince } : {})
      });
      setProfile(saved);
      setProfileSaved(true);
    } catch {
      // ignore
    } finally {
      setSavingProfile(false);
    }
  };

  if (!ready) {
    return <AuthChecking />;
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "listings", label: "Meus anúncios" },
    { id: "chats", label: "Conversas" },
    { id: "favorites", label: "Favoritos" },
    { id: "perfil", label: "Perfil" }
  ];

  return (
    <main className="min-h-screen bg-bg text-slate-100 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <header className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div>
            <h1 className="text-2xl font-bold text-white">A minha conta</h1>
            <p className="text-sm text-slate-400">
              {user ? displayNameFor(user) : ""} · gerir anúncios e conversas
            </p>
          </div>
          <div className="flex items-center gap-3">
            {user ? (
              <Link href={`/perfil/${user.uid}`} className="text-xs font-semibold text-emerald-300 hover:text-emerald-200">
                Ver perfil público
              </Link>
            ) : null}
            {isAdmin ? (
              <Link href="/admin/reports" className="text-xs font-semibold text-amber-300 hover:text-amber-200">
                Moderação
              </Link>
            ) : null}
            <Link href="/marketplace" className="text-xs font-semibold text-slate-300 hover:text-emerald-300">
              ← Marketplace
            </Link>
          </div>
        </header>

        <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-800 self-start w-fit">
          {tabs.map(item => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all ${
                tab === item.id ? "bg-slate-800 text-emerald-400" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {loadingTab ? <p className="text-sm text-slate-400">A carregar…</p> : null}

        {/* Meus anúncios */}
        {tab === "listings" ? (
          listings.length === 0 && !loadingTab ? (
            <div className="text-sm text-slate-400 py-12 text-center border border-dashed border-slate-800 rounded-lg">
              Ainda não tem anúncios.{" "}
              <Link href="/dashboard/marketplace/anunciar" className="text-emerald-400 font-semibold">
                Criar anúncio
              </Link>
            </div>
          ) : (
            <ul className="space-y-3">
              {listings.map(listing => (
                <li
                  key={listing.id}
                  className="flex items-center gap-3 rounded-xl border border-slate-800 bg-card p-3"
                >
                  <div className="h-14 w-14 rounded bg-slate-950 overflow-hidden shrink-0">
                    {listing.image_urls[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={listing.image_urls[0]} alt="" className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-100 truncate">{listing.title}</span>
                      <StatusBadge listing={listing} />
                    </div>
                    <div className="text-[11px] text-slate-500 flex items-center gap-2">
                      <span className="text-emerald-400 font-bold">
                        {formatPrice(listing.price_cents, listing.currency)}
                      </span>
                      <span>· {conditionLabels[listing.condition] ?? listing.condition}</span>
                      <span>· ❤️ {listing.favorites_count}</span>
                    </div>
                  </div>
                  <Link
                    href={`/anuncio/${listing.id}/editar`}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-300 bg-slate-800 border border-slate-700 hover:border-emerald-700 whitespace-nowrap"
                  >
                    Editar
                  </Link>
                  <button
                    onClick={() => toggleSold(listing)}
                    disabled={busy === listing.id}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50 transition-colors whitespace-nowrap ${
                      listing.status === "sold"
                        ? "text-emerald-300 bg-slate-800 border border-slate-700 hover:border-emerald-700"
                        : "text-slate-950 bg-amber-400 hover:bg-amber-300"
                    }`}
                  >
                    {listing.status === "sold" ? "Reativar" : "Marcar vendido"}
                  </button>
                </li>
              ))}
            </ul>
          )
        ) : null}

        {/* Conversas */}
        {tab === "chats" ? (
          rooms.length === 0 && !loadingTab ? (
            <div className="text-sm text-slate-400 py-12 text-center border border-dashed border-slate-800 rounded-lg">
              Sem conversas ainda.
            </div>
          ) : (
            <ul className="space-y-2">
              {rooms.map(room => (
                <li key={room.id}>
                  <Link
                    href={`/mensagens?room=${room.id}`}
                    className="flex items-center gap-3 rounded-xl border border-slate-800 bg-card p-3 hover:border-emerald-700 transition-colors"
                  >
                    <div className="h-12 w-12 rounded bg-slate-950 overflow-hidden shrink-0">
                      {room.listing?.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={room.listing.image_url} alt="" className="h-full w-full object-cover" />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-slate-100 truncate">
                          {room.listing?.title ?? "Anúncio"}
                        </span>
                        {room.unread > 0 ? (
                          <span className="min-w-[16px] h-4 px-1 grid place-items-center rounded-full bg-emerald-500 text-[10px] font-bold text-slate-950">
                            {room.unread}
                          </span>
                        ) : null}
                      </div>
                      <span className="text-[11px] text-slate-500">
                        {room.role === "buyer" ? "Vendedor" : "Comprador"}
                        {room.last_message ? ` · ${room.last_message.content.slice(0, 40)}` : ""}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )
        ) : null}

        {/* Favoritos */}
        {tab === "favorites" ? (
          favorites.length === 0 && !loadingTab ? (
            <div className="text-sm text-slate-400 py-12 text-center border border-dashed border-slate-800 rounded-lg">
              Ainda não guardou anúncios nos favoritos.
            </div>
          ) : (
            <ul className="grid sm:grid-cols-2 gap-3">
              {favorites.map(listing => (
                <li key={listing.id} className="rounded-xl border border-slate-800 bg-card p-3 flex items-center gap-3">
                  <div className="h-14 w-14 rounded bg-slate-950 overflow-hidden shrink-0">
                    {listing.image_urls?.[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={listing.image_urls[0]} alt="" className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-sm font-semibold text-slate-100 truncate block">{listing.title}</span>
                    <span className="text-[11px] text-emerald-400 font-bold">
                      {formatPrice(listing.price_cents, listing.currency)}
                    </span>
                  </div>
                  <button
                    onClick={() => unfavorite(listing.id)}
                    className="text-xs text-slate-400 hover:text-red-400"
                    aria-label="Remover dos favoritos"
                  >
                    Remover
                  </button>
                </li>
              ))}
            </ul>
          )
        ) : null}

        {/* Perfil */}
        {tab === "perfil" ? (
          <div className="space-y-4 max-w-2xl">
            <div className="rounded-xl border border-slate-800 bg-card overflow-hidden">
              <div className="h-28 bg-gradient-to-r from-emerald-900/60 via-slate-800 to-slate-900 relative">
                {profile?.banner_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profile.banner_url} alt="" className="h-full w-full object-cover" />
                ) : null}
                <label className="absolute bottom-2 right-2 text-[11px] font-semibold text-slate-950 bg-emerald-500 hover:bg-emerald-400 rounded px-2 py-1 cursor-pointer">
                  {uploading === "banner" ? "A enviar…" : "Mudar banner"}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={event => {
                      const file = event.target.files?.[0];
                      if (file) uploadProfileImage("banner", file);
                      event.target.value = "";
                    }}
                  />
                </label>
              </div>
              <div className="p-4 flex items-center gap-3 -mt-10">
                <div className="h-20 w-20 rounded-2xl border-4 border-card bg-slate-800 overflow-hidden grid place-items-center shrink-0">
                  {profile?.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-2xl font-bold text-emerald-400">
                      {(profile?.display_name || "U").charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <label className="text-[11px] font-semibold text-emerald-300 border border-emerald-500/40 rounded px-2 py-1 cursor-pointer hover:bg-emerald-500/10">
                  {uploading === "avatar" ? "A enviar…" : "Mudar foto"}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={event => {
                      const file = event.target.files?.[0];
                      if (file) uploadProfileImage("avatar", file);
                      event.target.value = "";
                    }}
                  />
                </label>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400">Nome a mostrar</label>
                <input
                  value={profile?.display_name ?? ""}
                  onChange={event => setProfileField("display_name", event.target.value)}
                  className={inputClass}
                  placeholder="O seu nome"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400">Localidade</label>
                <input
                  value={profile?.location ?? ""}
                  onChange={event => setProfileField("location", event.target.value)}
                  className={inputClass}
                  placeholder="Ex.: Lisboa"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400">Profissão</label>
                <input
                  value={profile?.profession ?? ""}
                  onChange={event => setProfileField("profession", event.target.value)}
                  className={inputClass}
                  placeholder="Ex.: Eletricista"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400">Emprego / empresa</label>
                <input
                  value={profile?.employer ?? ""}
                  onChange={event => setProfileField("employer", event.target.value)}
                  className={inputClass}
                  placeholder="Ex.: SolarTech"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-slate-400">Biografia</label>
              <textarea
                value={profile?.bio ?? ""}
                onChange={event => setProfileField("bio", event.target.value)}
                rows={4}
                maxLength={1000}
                className={inputClass}
                placeholder="Conte um pouco sobre si e o que vende…"
              />
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={saveProfile}
                disabled={savingProfile}
                className="px-5 py-2 rounded-lg text-sm font-semibold text-slate-950 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50"
              >
                {savingProfile ? "A guardar…" : "Guardar perfil"}
              </button>
              {profileSaved ? <span className="text-xs text-emerald-400">Perfil guardado ✓</span> : null}
              {user ? (
                <Link href={`/perfil/${user.uid}`} className="text-xs text-slate-400 hover:text-emerald-300">
                  Ver perfil público →
                </Link>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}

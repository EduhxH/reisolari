"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
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
import { downloadOrcamento, getQuestionnaireStatus } from "@/lib/questionnaire";

type Tab = "listings" | "chats" | "favorites" | "perfil" | "simulador";

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
  "w-full mt-1 rounded-lg bg-white border border-black/10 px-3 py-2 text-sm text-supaste-ink outline-none focus:border-supaste-blue";

const conditionLabels: Record<string, string> = {
  novo: "Novo",
  usado_como_novo: "Como novo",
  usado_sinais: "Usado",
  pecas: "Para peças"
};

function StatusBadge({ listing }: { listing: MyListing }) {
  const cls =
    listing.status === "sold"
      ? "bg-amber-100 text-amber-700 border-amber-200"
      : listing.active
      ? "bg-supaste-blue/10 text-supaste-blue border-supaste-blue/20"
      : "bg-black/5 text-supaste-muted border-black/10";
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
  const [hasSimulation, setHasSimulation] = useState(false);
  const [downloadingQuote, setDownloadingQuote] = useState(false);

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("tab");
    if (["perfil", "chats", "favorites", "simulador"].includes(requested ?? "")) {
      setTab(requested as Tab);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    user
      .getIdToken()
      .then(token => getQuestionnaireStatus(token))
      .then(done => {
        if (!cancelled) setHasSimulation(done);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [user]);

  const downloadQuote = async () => {
    if (!user) return;
    setDownloadingQuote(true);
    try {
      const token = await user.getIdToken();
      await downloadOrcamento(token);
    } catch {
      // ignore
    } finally {
      setDownloadingQuote(false);
    }
  };

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
    { id: "perfil", label: "Perfil" },
    { id: "simulador", label: "Simulador" }
  ];

  return (
    <main className="min-h-screen bg-supaste-mist text-supaste-ink">
      <header className="px-4 pt-5">
        <nav className="supaste-glass-strong mx-auto flex max-w-4xl items-center justify-between rounded-full px-4 py-2.5">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/images/reisolari-logo.jpeg" alt="Reisolari" width={30} height={30} className="rounded-full" />
            <span className="font-display text-base font-semibold tracking-tight">Reisolari</span>
          </Link>
          <div className="flex items-center gap-4 text-sm font-medium text-supaste-muted">
            {user ? (
              <Link href={`/perfil/${user.uid}`} className="transition-colors hover:text-supaste-ink">
                Perfil público
              </Link>
            ) : null}
            {isAdmin ? (
              <Link href="/admin/reports" className="text-amber-600 transition-colors hover:text-amber-500">
                Moderação
              </Link>
            ) : null}
            <Link href="/marketplace" className="transition-colors hover:text-supaste-ink">
              Marketplace
            </Link>
          </div>
        </nav>
      </header>

      <div className="mx-auto max-w-4xl space-y-6 px-6 py-8">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">A minha conta</h1>
          <p className="text-sm text-supaste-muted">
            {user ? displayNameFor(user) : ""} · gerir anúncios e conversas
          </p>
        </div>

        <div className="flex bg-supaste-section p-1 rounded-lg border border-black/10 self-start w-fit">
          {tabs.map(item => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all ${
                tab === item.id ? "bg-supaste-section text-supaste-blue" : "text-supaste-muted hover:text-supaste-ink"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {loadingTab ? <p className="text-sm text-supaste-muted">A carregar…</p> : null}

        {/* Meus anúncios */}
        {tab === "listings" ? (
          listings.length === 0 && !loadingTab ? (
            <div className="text-sm text-supaste-muted py-12 text-center border border-dashed border-black/10 rounded-lg">
              Ainda não tem anúncios.{" "}
              <Link href="/dashboard/marketplace/anunciar" className="text-supaste-blue font-semibold">
                Criar anúncio
              </Link>
            </div>
          ) : (
            <ul className="space-y-3">
              {listings.map(listing => (
                <li
                  key={listing.id}
                  className="flex items-center gap-3 rounded-xl border border-black/10 bg-white p-3"
                >
                  <div className="h-14 w-14 rounded bg-white overflow-hidden shrink-0">
                    {listing.image_urls[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={listing.image_urls[0]} alt="" className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-supaste-ink truncate">{listing.title}</span>
                      <StatusBadge listing={listing} />
                    </div>
                    <div className="text-[11px] text-supaste-muted flex items-center gap-2">
                      <span className="text-supaste-blue font-bold">
                        {formatPrice(listing.price_cents, listing.currency)}
                      </span>
                      <span>· {conditionLabels[listing.condition] ?? listing.condition}</span>
                      <span>· ❤️ {listing.favorites_count}</span>
                    </div>
                  </div>
                  <Link
                    href={`/anuncio/${listing.id}/editar`}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-supaste-muted bg-supaste-section border border-black/10 hover:border-supaste-blue whitespace-nowrap"
                  >
                    Editar
                  </Link>
                  <button
                    onClick={() => toggleSold(listing)}
                    disabled={busy === listing.id}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50 transition-colors whitespace-nowrap ${
                      listing.status === "sold"
                        ? "text-supaste-blue bg-supaste-section border border-black/10 hover:border-supaste-blue"
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
            <div className="text-sm text-supaste-muted py-12 text-center border border-dashed border-black/10 rounded-lg">
              Sem conversas ainda.
            </div>
          ) : (
            <ul className="space-y-2">
              {rooms.map(room => (
                <li key={room.id}>
                  <Link
                    href={`/mensagens?room=${room.id}`}
                    className="flex items-center gap-3 rounded-xl border border-black/10 bg-white p-3 hover:border-supaste-blue transition-colors"
                  >
                    <div className="h-12 w-12 rounded bg-white overflow-hidden shrink-0">
                      {room.listing?.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={room.listing.image_url} alt="" className="h-full w-full object-cover" />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-supaste-ink truncate">
                          {room.listing?.title ?? "Anúncio"}
                        </span>
                        {room.unread > 0 ? (
                          <span className="min-w-[16px] h-4 px-1 grid place-items-center rounded-full bg-supaste-black text-[10px] font-bold text-slate-950">
                            {room.unread}
                          </span>
                        ) : null}
                      </div>
                      <span className="text-[11px] text-supaste-muted">
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
            <div className="text-sm text-supaste-muted py-12 text-center border border-dashed border-black/10 rounded-lg">
              Ainda não guardou anúncios nos favoritos.
            </div>
          ) : (
            <ul className="grid sm:grid-cols-2 gap-3">
              {favorites.map(listing => (
                <li key={listing.id} className="rounded-xl border border-black/10 bg-white p-3 flex items-center gap-3">
                  <div className="h-14 w-14 rounded bg-white overflow-hidden shrink-0">
                    {listing.image_urls?.[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={listing.image_urls[0]} alt="" className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-sm font-semibold text-supaste-ink truncate block">{listing.title}</span>
                    <span className="text-[11px] text-supaste-blue font-bold">
                      {formatPrice(listing.price_cents, listing.currency)}
                    </span>
                  </div>
                  <button
                    onClick={() => unfavorite(listing.id)}
                    className="text-xs text-supaste-muted hover:text-red-400"
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
            <div className="rounded-xl border border-black/10 bg-white overflow-hidden">
              <div className="h-28 bg-gradient-to-r from-supaste-blue/20 via-supaste-section to-white relative">
                {profile?.banner_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profile.banner_url} alt="" className="h-full w-full object-cover" />
                ) : null}
                <label className="absolute bottom-2 right-2 text-[11px] font-semibold text-white bg-supaste-black hover:opacity-90 rounded px-2 py-1 cursor-pointer">
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
                <div className="h-20 w-20 rounded-2xl border-4 border-card bg-supaste-section overflow-hidden grid place-items-center shrink-0">
                  {profile?.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-2xl font-bold text-supaste-blue">
                      {(profile?.display_name || "U").charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <label className="text-[11px] font-semibold text-supaste-blue border border-supaste-blue/30 rounded px-2 py-1 cursor-pointer hover:bg-supaste-blue/10">
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
                <label className="text-xs text-supaste-muted">Nome a mostrar</label>
                <input
                  value={profile?.display_name ?? ""}
                  onChange={event => setProfileField("display_name", event.target.value)}
                  className={inputClass}
                  placeholder="O seu nome"
                />
              </div>
              <div>
                <label className="text-xs text-supaste-muted">Localidade</label>
                <input
                  value={profile?.location ?? ""}
                  onChange={event => setProfileField("location", event.target.value)}
                  className={inputClass}
                  placeholder="Ex.: Lisboa"
                />
              </div>
              <div>
                <label className="text-xs text-supaste-muted">Profissão</label>
                <input
                  value={profile?.profession ?? ""}
                  onChange={event => setProfileField("profession", event.target.value)}
                  className={inputClass}
                  placeholder="Ex.: Eletricista"
                />
              </div>
              <div>
                <label className="text-xs text-supaste-muted">Emprego / empresa</label>
                <input
                  value={profile?.employer ?? ""}
                  onChange={event => setProfileField("employer", event.target.value)}
                  className={inputClass}
                  placeholder="Ex.: SolarTech"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-supaste-muted">Biografia</label>
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
                className="px-5 py-2 rounded-lg text-sm font-semibold text-white bg-supaste-black hover:opacity-90 disabled:opacity-50"
              >
                {savingProfile ? "A guardar…" : "Guardar perfil"}
              </button>
              {profileSaved ? <span className="text-xs text-supaste-blue">Perfil guardado ✓</span> : null}
              {user ? (
                <Link href={`/perfil/${user.uid}`} className="text-xs text-supaste-muted hover:text-supaste-blue">
                  Ver perfil público →
                </Link>
              ) : null}
            </div>
          </div>
        ) : null}

        {/* Simulador / Definições */}
        {tab === "simulador" ? (
          <div className="space-y-4 max-w-2xl">
            <div className="rounded-xl border border-black/10 bg-white p-5 space-y-3">
              <h2 className="text-lg font-semibold text-white">Simulador solar</h2>
              <p className="text-sm text-supaste-muted">
                {hasSimulation
                  ? "Pode rever as suas propostas, descarregar o orçamento ou refazer o questionário a qualquer momento."
                  : "Ainda não fez o questionário. Faça-o para receber as suas propostas ideais."}
              </p>
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <Link
                  href="/questionario"
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-supaste-black hover:opacity-90"
                >
                  {hasSimulation ? "Refazer questionário" : "Fazer questionário"}
                </Link>
                {hasSimulation ? (
                  <>
                    <Link
                      href="/ideais"
                      className="px-4 py-2 rounded-lg text-sm font-semibold text-supaste-ink bg-supaste-section border border-black/10 hover:border-supaste-blue"
                    >
                      Ver propostas ideais
                    </Link>
                    <button
                      onClick={downloadQuote}
                      disabled={downloadingQuote}
                      className="px-4 py-2 rounded-lg text-sm font-semibold text-supaste-ink bg-supaste-section border border-black/10 hover:border-supaste-blue disabled:opacity-50"
                    >
                      {downloadingQuote ? "A gerar…" : "Descarregar orçamento (PDF)"}
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}

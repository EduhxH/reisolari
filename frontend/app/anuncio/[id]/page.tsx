"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { formatPrice, fetchCategoryAttributes, type AttributeField } from "@/lib/api";
import {
  getListing,
  markListingSold,
  reactivateListing,
  type ListingDetail
} from "@/lib/listings";
import { createRoom, sendMessage } from "@/lib/chat";
import { addFavorite, getFavoriteIds, removeFavorite } from "@/lib/favorites";
import { getProfilesSummary, type ProfileSummary } from "@/lib/profile";
import { getMyReportedIds } from "@/lib/reports";
import ReportDialog from "@/components/ReportDialog";

const conditionLabels: Record<string, string> = {
  novo: "Novo",
  usado_como_novo: "Como novo",
  usado_sinais: "Com sinais de uso",
  pecas: "Para peças"
};

export default function AnuncioPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const { user } = useAuth();
  const router = useRouter();

  const [listing, setListing] = useState<ListingDetail | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [fields, setFields] = useState<AttributeField[] | null>(null);
  const [activeImage, setActiveImage] = useState(0);
  const [favorited, setFavorited] = useState(false);
  const [favCount, setFavCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [seller, setSeller] = useState<ProfileSummary | null>(null);
  const [reported, setReported] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getListing(id)
      .then(data => {
        if (cancelled) return;
        setListing(data);
        setFavCount(data.favorites_count);
      })
      .catch(() => {
        if (!cancelled) setNotFound(true);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Ficha técnica labels/units from the category's attribute schema.
  useEffect(() => {
    if (!listing?.category_id) return;
    let cancelled = false;
    fetchCategoryAttributes(listing.category_id)
      .then(schema => {
        if (!cancelled) setFields(schema?.fields ?? null);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [listing?.category_id]);

  // Seller reputation card.
  useEffect(() => {
    if (!listing?.owner_id) return;
    let cancelled = false;
    getProfilesSummary([listing.owner_id])
      .then(map => {
        if (!cancelled) setSeller(map[listing.owner_id] ?? null);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [listing?.owner_id]);

  // Heart state for the signed-in user.
  useEffect(() => {
    if (!user) {
      setFavorited(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const token = await user.getIdToken().catch(() => null);
      if (!token || cancelled) return;
      const ids = await getFavoriteIds(token).catch(() => [] as string[]);
      if (!cancelled) setFavorited(ids.includes(id));
    })();
    return () => {
      cancelled = true;
    };
  }, [user, id]);

  useEffect(() => {
    if (!user) {
      setReported(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const token = await user.getIdToken().catch(() => null);
      if (!token || cancelled) return;
      const ids = await getMyReportedIds(token).catch(() => [] as string[]);
      if (!cancelled) setReported(ids.includes(`listing:${id}`));
    })();
    return () => {
      cancelled = true;
    };
  }, [user, id]);

  const isOwner = !!user && !!listing && listing.owner_id === user.uid;

  const toggleFavorite = async () => {
    if (!user) return router.push("/login");
    try {
      const token = await user.getIdToken();
      const result = favorited
        ? await removeFavorite(token, id)
        : await addFavorite(token, id);
      setFavorited(result.favorited);
      setFavCount(result.count);
    } catch {
      // ignore
    }
  };

  const openChat = async (withIntent: boolean) => {
    if (!user) return router.push("/login");
    if (!listing) return;
    setBusy(true);
    try {
      const token = await user.getIdToken();
      const room = await createRoom(token, id);
      if (withIntent) {
        await sendMessage(
          token,
          room.id,
          `Olá! Tenho interesse em comprar "${listing.title}". Ainda está disponível?`
        );
      }
      router.push(`/mensagens?room=${room.id}`);
    } catch {
      setBusy(false);
    }
  };

  const toggleSold = async () => {
    if (!user || !listing) return;
    setBusy(true);
    try {
      const token = await user.getIdToken();
      const updated =
        listing.status === "sold"
          ? await reactivateListing(token, id)
          : await markListingSold(token, id);
      setListing(updated);
    } catch {
      // ignore
    } finally {
      setBusy(false);
    }
  };

  if (notFound) {
    return (
      <main className="min-h-screen bg-bg text-slate-100 grid place-items-center p-6">
        <div className="text-center space-y-3">
          <p className="text-slate-300">Anúncio não encontrado.</p>
          <Link href="/marketplace" className="text-emerald-400 font-semibold">
            ← Marketplace
          </Link>
        </div>
      </main>
    );
  }

  if (!listing) {
    return (
      <main className="min-h-screen bg-bg text-slate-100 grid place-items-center p-6">
        <p className="text-sm text-slate-400">A carregar…</p>
      </main>
    );
  }

  const images = listing.image_urls.length > 0 ? listing.image_urls : [];
  const filledAttributes = fields
    ? fields
        .filter(field => {
          const value = listing.attributes?.[field.key];
          return value !== undefined && value !== null && value !== "";
        })
        .map(field => ({
          label: field.label,
          value: `${listing.attributes[field.key]}${field.unit ? ` ${field.unit}` : ""}`
        }))
    : Object.entries(listing.attributes ?? {}).map(([key, value]) => ({
        label: key,
        value: String(value)
      }));

  return (
    <main className="min-h-screen bg-bg text-slate-100 p-6">
      <div className="max-w-4xl mx-auto space-y-5">
        <div className="flex items-center justify-between">
          <Link href="/marketplace" className="text-xs font-semibold text-slate-300 hover:text-emerald-300">
            ← Marketplace
          </Link>
          <Link href="/diretrizes" className="text-[11px] text-slate-400 hover:text-emerald-300">
            🔒 Comprar em segurança
          </Link>
        </div>

        {listing.status === "sold" ? (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-200 text-center font-semibold">
            Este anúncio foi marcado como vendido.
          </div>
        ) : null}

        <div className="grid md:grid-cols-2 gap-6">
          {/* Gallery */}
          <div className="space-y-2">
            <div className="aspect-[4/3] rounded-xl bg-slate-950 border border-slate-800 overflow-hidden grid place-items-center">
              {images[activeImage] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={images[activeImage]} alt={listing.title} className="h-full w-full object-cover" />
              ) : (
                <span className="text-xs text-slate-500">Sem imagem</span>
              )}
            </div>
            {images.length > 1 ? (
              <div className="flex gap-2 overflow-auto">
                {images.map((url, index) => (
                  <button
                    key={url}
                    onClick={() => setActiveImage(index)}
                    className={`h-14 w-14 rounded overflow-hidden border shrink-0 ${
                      index === activeImage ? "border-emerald-500" : "border-slate-800"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {/* Summary + actions */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                {conditionLabels[listing.condition] ?? listing.condition}
              </span>
              {listing.listing_type === "premium" ? (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-400/20 text-amber-300">Premium</span>
              ) : null}
            </div>

            <h1 className="text-2xl font-bold text-white leading-tight">{listing.title}</h1>
            <p className="text-2xl font-bold text-emerald-400">
              {formatPrice(listing.price_cents, listing.currency)}
            </p>

            <p className="text-[11px] text-slate-400">
              {listing.category_path?.length ? listing.category_path.join(" › ") : ""}
              {listing.city ? ` · ${listing.city}` : ""}
            </p>

            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={toggleFavorite}
                className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-semibold text-slate-200 bg-slate-800 border border-slate-700 hover:border-emerald-700"
              >
                <span aria-hidden>{favorited ? "❤️" : "🤍"}</span>
                {favCount > 0 ? <span className="text-xs">{favCount}</span> : null}
              </button>

              {isOwner ? (
                <>
                  <Link
                    href={`/anuncio/${id}/editar`}
                    className="flex-1 px-4 py-2 rounded-lg text-sm font-semibold text-center text-slate-200 bg-slate-800 border border-slate-700 hover:border-emerald-700"
                  >
                    Editar
                  </Link>
                  <button
                    onClick={toggleSold}
                    disabled={busy}
                    className={`flex-1 px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50 ${
                      listing.status === "sold"
                        ? "text-emerald-300 bg-slate-800 border border-slate-700 hover:border-emerald-700"
                        : "text-slate-950 bg-amber-400 hover:bg-amber-300"
                    }`}
                  >
                    {listing.status === "sold" ? "Reativar" : "Marcar vendido"}
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => openChat(false)}
                    disabled={busy || listing.status === "sold"}
                    className="flex-1 px-4 py-2 rounded-lg text-sm font-semibold text-slate-200 bg-slate-800 border border-slate-700 hover:border-emerald-700 disabled:opacity-50"
                  >
                    💬 Mensagem
                  </button>
                  <button
                    onClick={() => openChat(true)}
                    disabled={busy || listing.status === "sold"}
                    className="flex-1 px-4 py-2 rounded-lg text-sm font-semibold text-slate-950 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50"
                  >
                    🛒 Comprar
                  </button>
                </>
              )}
            </div>

            <div className="flex flex-wrap gap-2 pt-1 text-[11px] text-slate-400">
              {listing.delivery_pickup ? (
                <span className="px-2 py-1 rounded bg-slate-900 border border-slate-800">🤝 Entrega em mãos</span>
              ) : null}
              {listing.delivery_shipping ? (
                <span className="px-2 py-1 rounded bg-slate-900 border border-slate-800">📦 Envio por transportadora</span>
              ) : null}
            </div>

            {!isOwner && seller ? (
              <Link
                href={`/perfil/${listing.owner_id}`}
                className="flex items-center gap-2 rounded-lg border border-slate-800 bg-card p-2 w-fit hover:border-emerald-700 transition-colors"
              >
                <div className="h-9 w-9 rounded-full bg-slate-800 overflow-hidden grid place-items-center text-sm font-bold text-emerald-400 shrink-0">
                  {seller.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={seller.avatar_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    seller.display_name.charAt(0).toUpperCase()
                  )}
                </div>
                <div className="text-[11px] leading-tight">
                  <p className="text-slate-200 font-semibold">{seller.display_name}</p>
                  <p className="text-slate-400">
                    {seller.rating.count > 0
                      ? `★ ${seller.rating.average.toFixed(1)} · ${seller.rating.count} ${
                          seller.rating.count === 1 ? "avaliação" : "avaliações"
                        }`
                      : "Sem avaliações ainda"}
                  </p>
                </div>
              </Link>
            ) : null}
          </div>
        </div>

        {/* Ficha técnica */}
        {filledAttributes.length > 0 ? (
          <section className="rounded-xl border border-slate-800 bg-card p-5">
            <h2 className="text-sm font-semibold text-white mb-3">Ficha técnica</h2>
            <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-2">
              {filledAttributes.map(attribute => (
                <div key={attribute.label} className="flex justify-between gap-3 border-b border-slate-800/60 pb-1.5">
                  <dt className="text-xs text-slate-400">{attribute.label}</dt>
                  <dd className="text-xs text-slate-100 font-medium text-right">{attribute.value}</dd>
                </div>
              ))}
            </dl>
          </section>
        ) : null}

        {/* Descrição */}
        <section className="rounded-xl border border-slate-800 bg-card p-5">
          <h2 className="text-sm font-semibold text-white mb-2">Descrição</h2>
          <p className="text-sm text-slate-300 whitespace-pre-wrap break-words">{listing.description}</p>
        </section>

        <p className="text-[11px] text-slate-500">
          🔒 Negocie sempre dentro da Reisolari. Veja as{" "}
          <Link href="/diretrizes" className="text-emerald-300 hover:text-emerald-200">
            diretrizes de segurança
          </Link>{" "}
          para evitar burlas.
        </p>

        {!isOwner ? (
          <div>
            <ReportDialog targetType="listing" targetId={id} alreadyReported={reported} label="🚩 Denunciar este anúncio" />
          </div>
        ) : null}
      </div>
    </main>
  );
}

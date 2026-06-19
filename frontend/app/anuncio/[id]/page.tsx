"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowLeft, Eye, Handshake, Heart, MessageCircle, Shield, ShoppingCart, Star, Truck } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { formatPrice, fetchCategoryAttributes, type AttributeField } from "@/lib/api";
import Reveal from "@/components/Reveal";
import {
  getListing,
  markListingSold,
  reactivateListing,
  recordListingView,
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
  const { user, loading } = useAuth();
  const router = useRouter();

  const [listing, setListing] = useState<ListingDetail | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [fields, setFields] = useState<AttributeField[] | null>(null);
  const [activeImage, setActiveImage] = useState(0);
  const [favorited, setFavorited] = useState(false);
  const [favCount, setFavCount] = useState(0);
  const [views, setViews] = useState(0);
  const [busy, setBusy] = useState(false);
  const [seller, setSeller] = useState<ProfileSummary | null>(null);
  const [reported, setReported] = useState(false);
  const viewedIdRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getListing(id)
      .then(data => {
        if (cancelled) return;
        setListing(data);
        setFavCount(data.favorites_count);
        setViews(data.views_count ?? 0);
      })
      .catch(() => {
        if (!cancelled) setNotFound(true);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Count a unique view, once per listing and only after auth has settled so the
  // owner's own views are excluded server-side.
  useEffect(() => {
    if (loading || viewedIdRef.current === id) return;
    viewedIdRef.current = id;
    let cancelled = false;
    (async () => {
      const token = user ? await user.getIdToken().catch(() => null) : null;
      const count = await recordListingView(id, token).catch(() => null);
      if (!cancelled && count != null) setViews(count);
    })();
    return () => {
      cancelled = true;
    };
  }, [id, user, loading]);

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
      <main className="min-h-screen bg-supaste-mist text-supaste-ink grid place-items-center p-6">
        <div className="text-center space-y-3">
          <p className="text-supaste-muted">Anúncio não encontrado.</p>
          <Link href="/marketplace" className="text-supaste-blue font-semibold">
            ← Marketplace
          </Link>
        </div>
      </main>
    );
  }

  if (!listing) {
    return (
      <main className="min-h-screen bg-supaste-mist text-supaste-ink grid place-items-center p-6">
        <p className="text-sm text-supaste-muted">A carregar…</p>
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
    <main className="flex min-h-screen flex-col bg-supaste-mist text-supaste-ink">
      <header className="px-4 pt-5">
        <nav className="supaste-glass-strong mx-auto flex max-w-4xl items-center justify-between rounded-full px-4 py-2.5">
          <Link href="/marketplace" className="flex items-center gap-1.5 text-sm font-medium text-supaste-muted transition-colors hover:text-supaste-ink">
            <ArrowLeft className="h-4 w-4" /> Marketplace
          </Link>
          <Link href="/diretrizes" className="flex items-center gap-1.5 text-xs font-medium text-supaste-muted transition-colors hover:text-supaste-blue">
            <Shield className="h-4 w-4" /> Comprar em segurança
          </Link>
        </nav>
      </header>

      <div className="mx-auto w-full max-w-4xl flex-1 space-y-5 px-6 py-8">
        {listing.status === "sold" ? (
          <div className="rounded-2xl bg-amber-50 px-4 py-3 text-center text-sm font-semibold text-amber-700">
            Este anúncio foi marcado como vendido.
          </div>
        ) : null}

        <Reveal className="grid gap-6 md:grid-cols-2">
          {/* Gallery */}
          <div className="space-y-2">
            <div className="grid aspect-[4/3] place-items-center overflow-hidden rounded-[24px] bg-white shadow-soft-float">
              {images[activeImage] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={images[activeImage]} alt={listing.title} className="h-full w-full object-cover" />
              ) : (
                <span className="text-xs text-supaste-muted">Sem imagem</span>
              )}
            </div>
            {images.length > 1 ? (
              <div className="flex gap-2 overflow-auto pb-1">
                {images.map((url, index) => (
                  <button
                    key={url}
                    onClick={() => setActiveImage(index)}
                    className={`h-16 w-16 shrink-0 overflow-hidden rounded-2xl ring-2 transition ${
                      index === activeImage ? "ring-supaste-blue" : "ring-transparent hover:ring-black/10"
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
          <div className="rounded-[24px] bg-white p-6 shadow-soft-float">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-supaste-blue/10 px-3 py-1 text-[11px] font-semibold text-supaste-blue">
                {conditionLabels[listing.condition] ?? listing.condition}
              </span>
              {listing.listing_type === "premium" ? (
                <span className="rounded-full bg-amber-100 px-3 py-1 text-[11px] font-semibold text-amber-700">Premium</span>
              ) : null}
            </div>

            <h1 className="mt-3 font-display text-2xl font-semibold leading-tight tracking-tight">{listing.title}</h1>
            <p className="mt-1 font-display text-3xl font-semibold tracking-tight text-supaste-blue">
              {formatPrice(listing.price_cents, listing.currency)}
            </p>

            <p className="mt-2 text-xs text-supaste-muted">
              {listing.category_path?.length ? listing.category_path.join(" › ") : ""}
              {listing.city ? ` · ${listing.city}` : ""}
            </p>
            <p className="mt-1 flex items-center gap-1 text-xs text-supaste-muted">
              <Eye className="h-3.5 w-3.5" /> {views} {views === 1 ? "visualização" : "visualizações"}
            </p>

            <div className="mt-4 flex items-center gap-2">
              <button
                onClick={toggleFavorite}
                className="flex items-center gap-1.5 rounded-full bg-supaste-section px-4 py-2.5 text-sm font-semibold text-supaste-ink transition hover:bg-[#e6e9ef]"
                aria-label="Favorito"
              >
                <Heart className={`h-4 w-4 ${favorited ? "fill-red-500 text-red-500" : ""}`} />
                {favCount > 0 ? <span className="text-xs">{favCount}</span> : null}
              </button>

              {isOwner ? (
                <>
                  <Link
                    href={`/anuncio/${id}/editar`}
                    className="flex-1 rounded-full bg-supaste-section px-4 py-2.5 text-center text-sm font-semibold text-supaste-ink transition hover:bg-[#e6e9ef]"
                  >
                    Editar
                  </Link>
                  <button
                    onClick={toggleSold}
                    disabled={busy}
                    className={`flex-1 rounded-full px-4 py-2.5 text-sm font-semibold disabled:opacity-50 ${
                      listing.status === "sold"
                        ? "bg-supaste-section text-supaste-ink hover:bg-[#e6e9ef]"
                        : "bg-amber-400 text-supaste-black hover:bg-amber-300"
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
                    className="flex flex-1 items-center justify-center gap-2 rounded-full bg-supaste-section px-4 py-2.5 text-sm font-semibold text-supaste-ink transition hover:bg-[#e6e9ef] disabled:opacity-50"
                  >
                    <MessageCircle className="h-4 w-4" /> Mensagem
                  </button>
                  <button
                    onClick={() => openChat(true)}
                    disabled={busy || listing.status === "sold"}
                    className="supaste-button flex flex-1 items-center justify-center gap-2 rounded-full bg-supaste-black px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    <ShoppingCart className="h-4 w-4" /> Comprar
                  </button>
                </>
              )}
            </div>

            <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-medium text-supaste-muted">
              {listing.delivery_pickup ? (
                <span className="flex items-center gap-1.5 rounded-full bg-supaste-section px-3 py-1.5">
                  <Handshake className="h-3.5 w-3.5" /> Entrega em mãos
                </span>
              ) : null}
              {listing.delivery_shipping ? (
                <span className="flex items-center gap-1.5 rounded-full bg-supaste-section px-3 py-1.5">
                  <Truck className="h-3.5 w-3.5" /> Envio por transportadora
                </span>
              ) : null}
            </div>

            {!isOwner && seller ? (
              <Link
                href={`/perfil/${listing.owner_id}`}
                className="mt-4 flex w-fit items-center gap-2.5 rounded-2xl bg-supaste-section p-2.5 pr-4 transition hover:bg-[#e6e9ef]"
              >
                <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-white text-sm font-bold text-supaste-blue">
                  {seller.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={seller.avatar_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    seller.display_name.charAt(0).toUpperCase()
                  )}
                </div>
                <div className="text-xs leading-tight">
                  <p className="font-semibold text-supaste-ink">{seller.display_name}</p>
                  <p className="flex items-center gap-1 text-supaste-muted">
                    {seller.rating.count > 0 ? (
                      <>
                        <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                        {seller.rating.average.toFixed(1)} · {seller.rating.count}{" "}
                        {seller.rating.count === 1 ? "avaliação" : "avaliações"}
                      </>
                    ) : (
                      "Sem avaliações ainda"
                    )}
                  </p>
                </div>
              </Link>
            ) : null}
          </div>
        </Reveal>

        {/* Ficha técnica */}
        {filledAttributes.length > 0 ? (
          <Reveal className="rounded-[24px] bg-white p-6 shadow-soft-float">
            <h2 className="mb-3 font-display text-lg font-semibold tracking-tight">Ficha técnica</h2>
            <dl className="grid gap-x-8 gap-y-2.5 sm:grid-cols-2">
              {filledAttributes.map(attribute => (
                <div key={attribute.label} className="flex justify-between gap-3 border-b border-black/5 pb-2">
                  <dt className="text-sm text-supaste-muted">{attribute.label}</dt>
                  <dd className="text-right text-sm font-medium text-supaste-ink">{attribute.value}</dd>
                </div>
              ))}
            </dl>
          </Reveal>
        ) : null}

        {/* Descrição */}
        <Reveal className="rounded-[24px] bg-white p-6 shadow-soft-float">
          <h2 className="mb-2 font-display text-lg font-semibold tracking-tight">Descrição</h2>
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-supaste-muted">{listing.description}</p>
        </Reveal>

        <p className="flex items-center gap-1.5 text-xs text-supaste-muted">
          <Shield className="h-4 w-4 shrink-0" /> Negocie sempre dentro da Reisolari. Veja as{" "}
          <Link href="/diretrizes" className="font-semibold text-supaste-blue hover:underline">diretrizes de segurança</Link> para evitar burlas.
        </p>

        {!isOwner ? (
          <ReportDialog targetType="listing" targetId={id} alreadyReported={reported} label="Denunciar este anúncio" />
        ) : null}
      </div>

      <footer className="border-t border-black/5">
        <div className="mx-auto flex max-w-4xl items-center justify-center gap-2.5 px-6 py-8">
          <Image src="/images/reisolari-logo.jpeg" alt="" width={26} height={26} className="rounded-full" />
          <span className="font-display font-semibold text-supaste-ink">Reisolari</span>
        </div>
      </footer>
    </main>
  );
}

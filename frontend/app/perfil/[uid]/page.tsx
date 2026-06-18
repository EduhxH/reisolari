"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { formatPrice } from "@/lib/api";
import {
  getPublicProfile,
  getUserRatings,
  rateUser,
  type PublicProfile,
  type UserRating
} from "@/lib/profile";
import ReportDialog from "@/components/ReportDialog";

function Stars({ value, className = "" }: { value: number; className?: string }) {
  return (
    <span className={`text-amber-400 ${className}`} aria-label={`${value} de 5 estrelas`}>
      {[0, 1, 2, 3, 4].map(i => (
        <span key={i} className={i < Math.round(value) ? "text-amber-400" : "text-slate-700"}>
          ★
        </span>
      ))}
    </span>
  );
}

function memberSince(iso: string | null): string | null {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString("pt-PT", { month: "long", year: "numeric" });
  } catch {
    return null;
  }
}

export default function PerfilPage({ params }: { params: { uid: string } }) {
  const { uid } = params;
  const { user } = useAuth();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [ratings, setRatings] = useState<UserRating[]>([]);
  const [notFound, setNotFound] = useState(false);
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    const token = user ? await user.getIdToken().catch(() => null) : null;
    const [p, r] = await Promise.all([
      getPublicProfile(uid, token).catch(() => null),
      getUserRatings(uid).catch(() => [])
    ]);
    if (!p) {
      setNotFound(true);
      return;
    }
    setProfile(p);
    setRatings(r);
    if (p.my_rating) {
      setStars(p.my_rating.stars);
      setComment(p.my_rating.comment ?? "");
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, user]);

  const submitRating = async () => {
    if (!user || stars < 1) return;
    setSubmitting(true);
    try {
      const token = await user.getIdToken();
      await rateUser(token, uid, stars, comment.trim() || undefined);
      await load();
    } catch {
      // ignore
    } finally {
      setSubmitting(false);
    }
  };

  if (notFound) {
    return (
      <main className="min-h-screen bg-bg text-slate-100 grid place-items-center p-6">
        <div className="text-center space-y-3">
          <p className="text-slate-300">Perfil não encontrado.</p>
          <Link href="/marketplace" className="text-emerald-400 font-semibold">
            ← Marketplace
          </Link>
        </div>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="min-h-screen bg-bg text-slate-100 grid place-items-center p-6">
        <p className="text-sm text-slate-400">A carregar…</p>
      </main>
    );
  }

  const since = memberSince(profile.member_since);
  const initial = (profile.display_name || "U").charAt(0).toUpperCase();

  return (
    <main className="min-h-screen bg-bg text-slate-100 pb-10">
      {/* Banner */}
      <div className="h-40 sm:h-52 w-full bg-gradient-to-r from-emerald-900/60 via-slate-800 to-slate-900 relative">
        {profile.banner_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={profile.banner_url} alt="" className="h-full w-full object-cover" />
        ) : null}
        <div className="absolute top-3 left-3">
          <Link href="/marketplace" className="text-xs font-semibold text-white/90 bg-black/40 rounded px-2 py-1 hover:bg-black/60">
            ← Marketplace
          </Link>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6">
        {/* Header card */}
        <div className="-mt-12 flex flex-col sm:flex-row sm:items-end gap-4">
          <div className="h-24 w-24 rounded-2xl border-4 border-bg bg-slate-800 overflow-hidden grid place-items-center shrink-0">
            {profile.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="text-3xl font-bold text-emerald-400">{initial}</span>
            )}
          </div>
          <div className="flex-1 min-w-0 pb-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-white">{profile.display_name}</h1>
              {profile.is_self ? (
                <Link href="/conta?tab=perfil" className="text-[11px] font-semibold text-emerald-300 hover:text-emerald-200 border border-emerald-500/40 rounded px-2 py-0.5">
                  Editar perfil
                </Link>
              ) : (
                <ReportDialog targetType="user" targetId={uid} />
              )}
            </div>
            <div className="flex items-center gap-2 mt-1 text-sm">
              <Stars value={profile.rating.average} />
              <span className="text-slate-400 text-xs">
                {profile.rating.count > 0
                  ? `${profile.rating.average.toFixed(1)} · ${profile.rating.count} ${
                      profile.rating.count === 1 ? "avaliação" : "avaliações"
                    }`
                  : "Sem avaliações"}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
              {profile.location ? <span>📍 {profile.location}</span> : null}
              {profile.profession ? (
                <span>💼 {profile.profession}{profile.employer ? ` · ${profile.employer}` : ""}</span>
              ) : profile.employer ? (
                <span>💼 {profile.employer}</span>
              ) : null}
              {since ? <span>🗓️ Desde {since} no Reisolari</span> : null}
            </p>
          </div>
        </div>

        {/* Bio */}
        {profile.bio ? (
          <p className="mt-4 text-sm text-slate-300 whitespace-pre-wrap break-words">{profile.bio}</p>
        ) : null}

        {/* Rate this user */}
        {!profile.is_self && user && profile.can_rate ? (
          <section className="mt-6 rounded-xl border border-slate-800 bg-card p-4">
            <h2 className="text-sm font-semibold text-white mb-2">
              {profile.my_rating ? "Atualizar a sua avaliação" : "Avaliar este utilizador"}
            </h2>
            <div className="flex items-center gap-1 mb-2">
              {[1, 2, 3, 4, 5].map(n => (
                <button
                  key={n}
                  onClick={() => setStars(n)}
                  className={`text-2xl ${n <= stars ? "text-amber-400" : "text-slate-700"} hover:text-amber-300`}
                  aria-label={`${n} estrelas`}
                >
                  ★
                </button>
              ))}
            </div>
            <textarea
              value={comment}
              onChange={event => setComment(event.target.value)}
              rows={2}
              maxLength={600}
              placeholder="Comentário (opcional)…"
              className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-600"
            />
            <button
              onClick={submitRating}
              disabled={submitting || stars < 1}
              className="mt-2 px-4 py-2 rounded-lg text-sm font-semibold text-slate-950 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50"
            >
              {profile.my_rating ? "Atualizar avaliação" : "Enviar avaliação"}
            </button>
          </section>
        ) : !profile.is_self && user && !profile.can_rate ? (
          <p className="mt-4 text-[11px] text-slate-500">
            Para avaliar este utilizador, contacte-o primeiro através de um anúncio.
          </p>
        ) : null}

        {/* Listings */}
        <section className="mt-8">
          <h2 className="text-sm font-semibold text-white mb-3">
            À venda ({profile.listings.length})
          </h2>
          {profile.listings.length === 0 ? (
            <p className="text-xs text-slate-500">Sem anúncios ativos.</p>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {profile.listings.map(listing => (
                <Link
                  key={listing.id}
                  href={`/anuncio/${listing.id}`}
                  className="rounded-lg border border-slate-800 bg-card overflow-hidden hover:border-emerald-700 transition-colors"
                >
                  <div className="aspect-[4/3] bg-slate-950">
                    {listing.image_urls[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={listing.image_urls[0]} alt={listing.title} className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                  <div className="p-2">
                    <p className="text-xs font-semibold text-slate-100 line-clamp-1">{listing.title}</p>
                    <p className="text-xs text-emerald-400 font-bold">
                      {formatPrice(listing.price_cents, listing.currency)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Reviews */}
        <section className="mt-8">
          <h2 className="text-sm font-semibold text-white mb-3">Avaliações</h2>
          {ratings.length === 0 ? (
            <p className="text-xs text-slate-500">Ainda sem avaliações.</p>
          ) : (
            <ul className="space-y-3">
              {ratings.map(rating => (
                <li key={rating.id} className="rounded-xl border border-slate-800 bg-card p-3">
                  <div className="flex items-center justify-between gap-2">
                    <Link href={`/perfil/${rating.rater_uid}`} className="text-xs font-semibold text-slate-100 hover:text-emerald-300">
                      {rating.rater_name}
                    </Link>
                    <Stars value={rating.stars} className="text-xs" />
                  </div>
                  {rating.comment ? (
                    <p className="text-xs text-slate-300 mt-1 whitespace-pre-wrap break-words">{rating.comment}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}

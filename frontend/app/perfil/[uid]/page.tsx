"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Briefcase, CalendarDays, MapPin, Star } from "lucide-react";
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
import Reveal, { RevealStagger, RevealItem } from "@/components/Reveal";

function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value} de 5 estrelas`}>
      {[0, 1, 2, 3, 4].map(i => (
        <Star
          key={i}
          style={{ width: size, height: size }}
          className={i < Math.round(value) ? "fill-amber-400 text-amber-400" : "text-black/15"}
        />
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

function Metric({ label, value, children }: { label: string; value?: string; children?: React.ReactNode }) {
  return (
    <div className="text-center sm:text-left">
      <div className="text-[11px] uppercase tracking-wide text-supaste-muted">{label}</div>
      <div className="mt-0.5 font-display text-2xl font-semibold tracking-tight text-supaste-ink">
        {children ?? value}
      </div>
    </div>
  );
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
      <main className="grid min-h-screen place-items-center bg-supaste-mist p-6 text-supaste-ink">
        <div className="space-y-3 text-center">
          <p className="text-supaste-muted">Perfil não encontrado.</p>
          <Link href="/marketplace" className="font-semibold text-supaste-blue">Voltar ao marketplace →</Link>
        </div>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="grid min-h-screen place-items-center bg-supaste-mist p-6">
        <p className="text-sm text-supaste-muted">A carregar…</p>
      </main>
    );
  }

  const since = memberSince(profile.member_since);
  const initial = (profile.display_name || "U").charAt(0).toUpperCase();

  return (
    <main className="min-h-screen bg-supaste-mist pb-12 text-supaste-ink">
      {/* Banner */}
      <div className="relative h-44 w-full overflow-hidden bg-gradient-to-r from-supaste-blue/30 via-supaste-iris/20 to-supaste-section sm:h-56">
        {profile.banner_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={profile.banner_url} alt="" className="h-full w-full object-cover" />
        ) : null}
        <Link
          href="/marketplace"
          className="absolute left-4 top-4 flex items-center gap-1.5 rounded-full bg-white/85 px-3 py-1.5 text-xs font-semibold text-supaste-ink backdrop-blur hover:bg-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Marketplace
        </Link>
      </div>

      <div className="mx-auto max-w-4xl px-6">
        {/* Header */}
        <Reveal className="-mt-14 rounded-[28px] bg-white p-6 shadow-soft-float">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-end">
              <div className="grid h-28 w-28 shrink-0 place-items-center overflow-hidden rounded-[28px] border-4 border-white bg-supaste-section shadow-soft-float">
                {profile.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="font-display text-4xl font-semibold text-supaste-blue">{initial}</span>
                )}
              </div>
              <div className="min-w-0 text-center sm:text-left">
                <h1 className="font-display text-2xl font-semibold tracking-tight">{profile.display_name}</h1>
                <div className="mt-1.5 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-supaste-muted sm:justify-start">
                  {profile.location ? (
                    <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {profile.location}</span>
                  ) : null}
                  {profile.profession || profile.employer ? (
                    <span className="flex items-center gap-1">
                      <Briefcase className="h-3.5 w-3.5" />
                      {profile.profession}
                      {profile.profession && profile.employer ? " · " : ""}
                      {profile.employer}
                    </span>
                  ) : null}
                  {since ? (
                    <span className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" /> Desde {since}</span>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="flex shrink-0 items-center justify-center gap-2">
              {profile.is_self ? (
                <Link href="/conta?tab=perfil" className="supaste-button rounded-full bg-supaste-black px-5 py-2.5 text-sm font-semibold text-white">
                  Editar perfil
                </Link>
              ) : (
                <ReportDialog targetType="user" targetId={uid} />
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="mt-6 grid grid-cols-3 gap-4 border-t border-black/5 pt-5">
            <Metric label="Avaliação">
              <span className="flex items-center justify-center gap-2 sm:justify-start">
                {profile.rating.count > 0 ? profile.rating.average.toFixed(1) : "—"}
                <Stars value={profile.rating.average} size={16} />
              </span>
            </Metric>
            <Metric label="Avaliações" value={`${profile.rating.count}`} />
            <Metric label="À venda" value={`${profile.listings.length}`} />
          </div>

          {profile.bio ? (
            <p className="mt-5 whitespace-pre-wrap break-words text-sm leading-relaxed text-supaste-muted">{profile.bio}</p>
          ) : null}
        </Reveal>

        {/* Rating form */}
        {!profile.is_self && user && profile.can_rate ? (
          <Reveal delay={0.05} className="mt-5 rounded-[24px] bg-white p-5 shadow-soft-float">
            <h2 className="text-sm font-semibold">{profile.my_rating ? "Atualizar a sua avaliação" : "Avaliar este utilizador"}</h2>
            <div className="mt-2 flex items-center gap-1">
              {[1, 2, 3, 4, 5].map(n => (
                <button key={n} onClick={() => setStars(n)} aria-label={`${n} estrelas`}>
                  <Star className={`h-7 w-7 transition-colors ${n <= stars ? "fill-amber-400 text-amber-400" : "text-black/15 hover:text-amber-300"}`} />
                </button>
              ))}
            </div>
            <textarea
              value={comment}
              onChange={event => setComment(event.target.value)}
              rows={2}
              maxLength={600}
              placeholder="Comentário (opcional)…"
              className="mt-3 w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm text-supaste-ink outline-none focus:border-supaste-blue"
            />
            <button
              onClick={submitRating}
              disabled={submitting || stars < 1}
              className="supaste-button mt-3 rounded-full bg-supaste-black px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {profile.my_rating ? "Atualizar avaliação" : "Enviar avaliação"}
            </button>
          </Reveal>
        ) : !profile.is_self && user && !profile.can_rate ? (
          <p className="mt-4 text-xs text-supaste-muted">
            Para avaliar este utilizador, contacte-o primeiro através de um anúncio.
          </p>
        ) : null}

        {/* Listings */}
        <section className="mt-8">
          <h2 className="mb-3 font-display text-lg font-semibold tracking-tight">À venda</h2>
          {profile.listings.length === 0 ? (
            <p className="text-sm text-supaste-muted">Sem anúncios ativos.</p>
          ) : (
            <RevealStagger className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {profile.listings.map(listing => (
                <RevealItem key={listing.id}>
                  <Link
                    href={`/anuncio/${listing.id}`}
                    className="block overflow-hidden rounded-[20px] bg-white shadow-soft-float transition-transform hover:-translate-y-0.5"
                  >
                    <div className="aspect-[4/3] bg-supaste-section">
                      {listing.image_urls[0] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={listing.image_urls[0]} alt={listing.title} className="h-full w-full object-cover" />
                      ) : null}
                    </div>
                    <div className="p-3">
                      <p className="line-clamp-1 text-sm font-semibold text-supaste-ink">{listing.title}</p>
                      <p className="text-sm font-bold text-supaste-blue">{formatPrice(listing.price_cents, listing.currency)}</p>
                    </div>
                  </Link>
                </RevealItem>
              ))}
            </RevealStagger>
          )}
        </section>

        {/* Reviews */}
        <section className="mt-8">
          <h2 className="mb-3 font-display text-lg font-semibold tracking-tight">Avaliações</h2>
          {ratings.length === 0 ? (
            <p className="text-sm text-supaste-muted">Ainda sem avaliações.</p>
          ) : (
            <ul className="space-y-3">
              {ratings.map(rating => (
                <li key={rating.id} className="rounded-[20px] bg-white p-4 shadow-soft-float">
                  <div className="flex items-center justify-between gap-2">
                    <Link href={`/perfil/${rating.rater_uid}`} className="text-sm font-semibold text-supaste-ink hover:text-supaste-blue">
                      {rating.rater_name}
                    </Link>
                    <Stars value={rating.stars} />
                  </div>
                  {rating.comment ? (
                    <p className="mt-1.5 whitespace-pre-wrap break-words text-sm text-supaste-muted">{rating.comment}</p>
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

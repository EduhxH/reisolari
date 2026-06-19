"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  BadgeCheck,
  ExternalLink,
  Heart,
  MessageCircle,
  Search,
  ShoppingCart,
  SlidersHorizontal,
  Store,
  UserRound
} from "lucide-react";
import AnunciarButton from "@/components/AnunciarButton";
import AuthHeaderButtons from "@/components/AuthHeaderButtons";
import CartDrawer from "@/components/CartDrawer";
import NotificationsBell from "@/components/NotificationsBell";
import StoreCatalog from "@/components/StoreCatalog";
import { addFavorite, getFavoriteIds, removeFavorite } from "@/lib/favorites";
import { useAuth } from "@/lib/auth";
import { useCart } from "@/lib/cart";
import { createRoom, sendMessage } from "@/lib/chat";
import { backendUrl, fetchCategoryTree, type CategoryNode } from "@/lib/api";
import { getProfilesSummary, type ProfileSummary } from "@/lib/profile";

type Listing = {
  id: string;
  owner_id: string;
  title: string;
  description: string;
  price_cents: number;
  currency: string;
  condition: "novo" | "usado_como_novo" | "usado_sinais" | "pecas";
  category_path: string[];
  listing_type: "classico" | "premium";
  city?: string | null;
  image_urls: string[];
  favorites_count: number;
  views_count: number;
  created_at: string;
};

type OLXAd = {
  id: number;
  title: string;
  description: string;
  price_display: string;
  price_cents: number;
  url: string;
  image_url: string | null;
  seller_name: string;
  location: string;
  created_at: string;
};

type Tab = "store" | "internal" | "olx";

const conditionLabels: Record<Listing["condition"], string> = {
  novo: "Novo",
  usado_como_novo: "Como novo",
  usado_sinais: "Usado",
  pecas: "Para pecas"
};

const tabs: { id: Tab; label: string; hint: string }[] = [
  { id: "store", label: "Loja Reisolari", hint: "Envio para todo o país" },
  { id: "internal", label: "Particulares", hint: "Compra e venda entre pessoas" },
  { id: "olx", label: "Usados no OLX", hint: "Anúncios na sua região" }
];

const formatListingPrice = (cents: number, currency: string) =>
  new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: currency.toUpperCase()
  }).format(cents / 100);

export default function MarketplacePage() {
  const { count, isHydrated } = useCart();
  const { user } = useAuth();
  const router = useRouter();
  const [cartOpen, setCartOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("store");
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [actionBusy, setActionBusy] = useState<string | null>(null);

  const [listings, setListings] = useState<Listing[]>([]);
  const [condition, setCondition] = useState("");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [sort, setSort] = useState("recent");
  const [tree, setTree] = useState<CategoryNode[]>([]);
  const [sellerSummaries, setSellerSummaries] = useState<Record<string, ProfileSummary>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [olxListings, setOlxListings] = useState<OLXAd[]>([]);
  const [olxLoading, setOlxLoading] = useState(false);
  const [olxError, setOlxError] = useState<string | null>(null);
  const [searchDistrict, setSearchDistrict] = useState("Portugal");
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);

  useEffect(() => {
    const latStr = localStorage.getItem("reisolari_lat");
    const lonStr = localStorage.getItem("reisolari_lon");
    if (latStr && lonStr) setCoords({ lat: parseFloat(latStr), lon: parseFloat(lonStr) });
  }, []);

  useEffect(() => {
    fetchCategoryTree().then(setTree).catch(() => setTree([]));
  }, []);

  useEffect(() => {
    const handle = setTimeout(() => {
      const params: Record<string, any> = { sort };
      if (condition) params.condition = condition;
      if (categoryFilter) params.category_id = categoryFilter;
      if (search.trim()) params.search = search.trim();
      setLoading(true);
      setError(null);
      axios
        .get(`${backendUrl}/api/v1/listings/`, { params })
        .then(response => setListings(response.data))
        .catch(() => setError("Nao foi possivel carregar os anuncios do mercado interno."))
        .finally(() => setLoading(false));
    }, 350);
    return () => clearTimeout(handle);
  }, [condition, categoryFilter, sort, search]);

  useEffect(() => {
    const owners = Array.from(new Set(listings.map(item => item.owner_id))).filter(Boolean);
    if (owners.length === 0) return;
    getProfilesSummary(owners).then(setSellerSummaries).catch(() => undefined);
  }, [listings]);

  useEffect(() => {
    if (!user) {
      setFavoriteIds(new Set());
      return;
    }
    let cancelled = false;
    (async () => {
      const token = await user.getIdToken().catch(() => null);
      if (!token || cancelled) return;
      const ids = await getFavoriteIds(token).catch(() => []);
      if (!cancelled) setFavoriteIds(new Set(ids));
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    const loadOlxListings = async () => {
      setOlxLoading(true);
      setOlxError(null);
      try {
        const params: Record<string, any> = {};
        if (coords) {
          params.latitude = coords.lat;
          params.longitude = coords.lon;
        }
        const response = await axios.get(`${backendUrl}/api/v1/listings/olx`, { params });
        setOlxListings(response.data.ads || []);
        setSearchDistrict(response.data.district || "Portugal");
      } catch {
        setOlxError("Nao foi possivel carregar os anuncios do OLX.");
      } finally {
        setOlxLoading(false);
      }
    };
    loadOlxListings();
  }, [coords]);

  const toggleFavorite = async (listing: Listing) => {
    if (!user) {
      router.push("/login");
      return;
    }
    const token = await user.getIdToken();
    const isFav = favoriteIds.has(listing.id);
    try {
      const result = isFav
        ? await removeFavorite(token, listing.id)
        : await addFavorite(token, listing.id);
      setFavoriteIds(prev => {
        const next = new Set(prev);
        if (result.favorited) next.add(listing.id);
        else next.delete(listing.id);
        return next;
      });
      setListings(prev =>
        prev.map(item =>
          item.id === listing.id ? { ...item, favorites_count: result.count } : item
        )
      );
    } catch {
      // ignore transient errors
    }
  };

  const openChat = async (listing: Listing, intent = false) => {
    if (!user) {
      router.push("/login");
      return;
    }
    setActionBusy(listing.id);
    try {
      const token = await user.getIdToken();
      const room = await createRoom(token, listing.id);
      if (intent) {
        await sendMessage(
          token,
          room.id,
          `Ola! Tenho interesse em comprar "${listing.title}". Ainda esta disponivel?`
        );
      }
      router.push(`/mensagens?room=${room.id}`);
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Nao foi possivel abrir a conversa.");
    } finally {
      setActionBusy(null);
    }
  };

  return (
    <main className="min-h-screen bg-white text-supaste-ink">
      <header className="sticky top-0 z-40 border-b border-black/5 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto max-w-[1320px] px-5">
          {/* Row 1 — brand + actions */}
          <div className="flex items-center justify-between gap-4 py-3">
            <Link href="/" className="flex items-center gap-2.5">
              <Image src="/images/reisolari-logo.jpeg" alt="Reisolari" width={34} height={34} className="rounded-full" />
              <span className="flex flex-col leading-none">
                <span className="font-display text-base font-semibold tracking-tight text-supaste-ink">Reisolari</span>
                <span className="text-[10px] font-medium uppercase tracking-wide text-supaste-muted">Marketplace</span>
              </span>
            </Link>

            <div className="flex items-center gap-2">
              <AnunciarButton className="supaste-button hidden rounded-full bg-white px-4 py-2 text-xs font-semibold text-supaste-ink ring-1 ring-black/10 sm:inline-flex" />
              {user ? <NotificationsBell /> : null}
              <AuthHeaderButtons />
              <Link
                href="/dashboard"
                className="supaste-button hidden items-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-semibold text-supaste-ink ring-1 ring-black/10 md:inline-flex"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Simulador
              </Link>
              <button
                onClick={() => setCartOpen(true)}
                className="supaste-button relative flex items-center gap-2 rounded-full bg-supaste-black px-4 py-2 text-xs font-semibold text-white"
                aria-label="Abrir carrinho"
              >
                <ShoppingCart className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Carrinho</span>
                {isHydrated && count > 0 ? (
                  <span className="absolute -right-1 -top-1 grid h-5 min-w-[20px] place-items-center rounded-full bg-supaste-blue px-1 text-[10px] font-bold text-white">
                    {count}
                  </span>
                ) : null}
              </button>
            </div>
          </div>

          {/* Row 2 — segmented tabs */}
          <div className="flex gap-1.5 overflow-x-auto pb-3">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                title={tab.hint}
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                  activeTab === tab.id
                    ? "bg-supaste-black text-white"
                    : "bg-supaste-section text-supaste-ink hover:bg-[#ececef]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-[1320px] px-5 py-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            {activeTab === "store" ? (
          <StoreCatalog />
        ) : activeTab === "internal" ? (
          <div className="space-y-5">
            <MarketplaceFilters
              search={search}
              setSearch={setSearch}
              categoryFilter={categoryFilter}
              setCategoryFilter={setCategoryFilter}
              condition={condition}
              setCondition={setCondition}
              sort={sort}
              setSort={setSort}
              tree={tree}
            />

            {error ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {error}
              </div>
            ) : null}

            {loading ? (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div key={index} className="h-[360px] animate-pulse rounded-[28px] bg-black/5" />
                ))}
              </div>
            ) : listings.length === 0 ? (
              <EmptyState title="Nenhum anuncio disponivel" body="Ajuste os filtros ou publique o primeiro produto solar." />
            ) : (
              <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {listings.map(listing => (
                  <ListingCard
                    key={listing.id}
                    listing={listing}
                    isOwner={Boolean(user && listing.owner_id === user.uid)}
                    favorite={favoriteIds.has(listing.id)}
                    seller={sellerSummaries[listing.owner_id]}
                    busy={actionBusy === listing.id}
                    onFavorite={() => toggleFavorite(listing)}
                    onMessage={() => openChat(listing, false)}
                    onBuyIntent={() => openChat(listing, true)}
                  />
                ))}
              </section>
            )}
          </div>
        ) : (
          <div className="space-y-5">
            <div className="supaste-glass-strong flex flex-col gap-3 rounded-[28px] p-5 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-supaste-muted">OLX Portugal</p>
                <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight text-supaste-black">
                  Anúncios usados em {searchDistrict}
                </h2>
              </div>
              <p className="max-w-lg text-sm leading-6 text-supaste-muted">
                Faça o questionário para usarmos a sua localização e mostrar anúncios mais perto de si.
              </p>
            </div>

            {olxError ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {olxError}
              </div>
            ) : null}

            {olxLoading ? (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div key={index} className="h-[340px] animate-pulse rounded-[28px] bg-black/5" />
                ))}
              </div>
            ) : olxListings.length === 0 ? (
              <EmptyState title="Nenhum resultado OLX" body="Nao foram encontrados paineis solares usados nesta regiao." />
            ) : (
              <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {olxListings.map(ad => (
                  <OLXCard key={ad.id} ad={ad} />
                ))}
              </section>
            )}
          </div>
            )}
          </motion.div>
        </AnimatePresence>
      </section>

      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
    </main>
  );
}

function MarketplaceFilters({
  search,
  setSearch,
  categoryFilter,
  setCategoryFilter,
  condition,
  setCondition,
  sort,
  setSort,
  tree
}: {
  search: string;
  setSearch: (value: string) => void;
  categoryFilter: string;
  setCategoryFilter: (value: string) => void;
  condition: string;
  setCondition: (value: string) => void;
  sort: string;
  setSort: (value: string) => void;
  tree: CategoryNode[];
}) {
  return (
    <div className="supaste-glass-strong flex flex-col gap-2 rounded-[28px] p-2 lg:flex-row lg:items-center">
      <label className="relative flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-supaste-muted" />
        <input
          value={search}
          onChange={event => setSearch(event.target.value)}
          placeholder="Pesquisar anuncios"
          className="w-full rounded-full border border-transparent bg-white px-9 py-3 text-sm font-medium text-supaste-black outline-none transition-colors duration-300 focus:border-supaste-blue"
        />
      </label>
      <select
        value={categoryFilter}
        onChange={event => setCategoryFilter(event.target.value)}
        className="rounded-full border border-transparent bg-white px-4 py-3 text-sm font-semibold text-supaste-black outline-none transition-colors duration-300 focus:border-supaste-blue"
      >
        <option value="">Todas as categorias</option>
        {tree.map(root => (
          <optgroup key={root.id} label={root.name}>
            {root.children.map(child => (
              <option key={child.id} value={child.id}>
                {child.name}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      <select
        value={condition}
        onChange={event => setCondition(event.target.value)}
        className="rounded-full border border-transparent bg-white px-4 py-3 text-sm font-semibold text-supaste-black outline-none transition-colors duration-300 focus:border-supaste-blue"
      >
        <option value="">Qualquer estado</option>
        <option value="novo">Novo</option>
        <option value="usado_como_novo">Como novo</option>
        <option value="usado_sinais">Com sinais de uso</option>
        <option value="pecas">Para pecas</option>
      </select>
      <select
        value={sort}
        onChange={event => setSort(event.target.value)}
        className="rounded-full border border-transparent bg-white px-4 py-3 text-sm font-semibold text-supaste-black outline-none transition-colors duration-300 focus:border-supaste-blue"
      >
        <option value="recent">Mais recentes</option>
        <option value="price_asc">Preco crescente</option>
        <option value="price_desc">Preco decrescente</option>
      </select>
    </div>
  );
}

function ListingCard({
  listing,
  isOwner,
  favorite,
  seller,
  busy,
  onFavorite,
  onMessage,
  onBuyIntent
}: {
  listing: Listing;
  isOwner: boolean;
  favorite: boolean;
  seller?: ProfileSummary;
  busy: boolean;
  onFavorite: () => void;
  onMessage: () => void;
  onBuyIntent: () => void;
}) {
  return (
    <article className="supaste-glass-strong overflow-hidden rounded-[28px] transition-transform duration-400 ease-in-out hover:-translate-y-1">
      <div className="relative aspect-[4/3] bg-[#f5f5f7]">
        {listing.image_urls[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={listing.image_urls[0]} alt={listing.title} className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full w-full place-items-center bg-[linear-gradient(135deg,#eef3ef,#ffffff)] text-supaste-muted">
            <Store className="h-8 w-8" />
          </div>
        )}
        <span className="absolute left-4 top-4 rounded-full bg-white/86 px-3 py-1 text-[10px] font-bold text-supaste-black backdrop-blur">
          {conditionLabels[listing.condition]}
        </span>
        {listing.listing_type === "premium" ? (
          <span className="absolute bottom-4 left-4 rounded-full bg-supaste-blue px-3 py-1 text-[10px] font-bold text-white">
            Premium
          </span>
        ) : null}
        {!isOwner ? (
          <button
            onClick={onFavorite}
            className="absolute right-4 top-4 flex items-center gap-1 rounded-full bg-white/86 px-3 py-1 text-[10px] font-bold text-supaste-black backdrop-blur transition-colors duration-300 hover:text-red-600"
            aria-label="Adicionar aos favoritos"
          >
            <Heart className={`h-3.5 w-3.5 ${favorite ? "fill-red-500 text-red-500" : ""}`} />
            {listing.favorites_count > 0 ? listing.favorites_count : null}
          </button>
        ) : null}
      </div>

      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <Link
            href={`/anuncio/${listing.id}`}
            className="line-clamp-2 text-lg font-bold leading-snug tracking-[-0.03em] text-supaste-black transition-colors duration-300 hover:text-supaste-blue"
          >
            {listing.title}
          </Link>
          <span className="shrink-0 text-lg font-bold text-supaste-black">
            {formatListingPrice(listing.price_cents, listing.currency)}
          </span>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-medium text-supaste-muted">
          {listing.category_path?.length ? <span>{listing.category_path.join(" / ")}</span> : null}
          {listing.city ? <span>{listing.city}</span> : null}
          {listing.views_count > 0 ? <span>{listing.views_count} visualizacoes</span> : null}
        </div>

        <p className="mt-4 line-clamp-2 text-sm leading-6 text-supaste-muted">{listing.description}</p>

        {seller ? (
          <Link
            href={`/perfil/${listing.owner_id}`}
            className="mt-4 flex items-center gap-2 text-xs font-semibold text-supaste-muted transition-colors duration-300 hover:text-supaste-black"
          >
            <UserRound className="h-4 w-4" />
            {seller.display_name}
            {seller.rating.count > 0 ? (
              <span className="rounded-full bg-[#f5f5f7] px-2 py-0.5">
                {seller.rating.average.toFixed(1)} ({seller.rating.count})
              </span>
            ) : null}
          </Link>
        ) : null}

        {isOwner ? (
          <p className="mt-5 text-xs font-semibold text-supaste-muted">O seu anuncio</p>
        ) : (
          <div className="mt-5 grid grid-cols-2 gap-2">
            <button
              onClick={onMessage}
              disabled={busy}
              className="supaste-button flex min-h-[42px] items-center justify-center gap-2 rounded-full border border-black/10 bg-white text-xs font-semibold text-supaste-black disabled:opacity-50"
            >
              <MessageCircle className="h-3.5 w-3.5" /> Mensagem
            </button>
            <button
              onClick={onBuyIntent}
              disabled={busy}
              className="supaste-button flex min-h-[42px] items-center justify-center gap-2 rounded-full bg-supaste-black text-xs font-semibold text-white disabled:opacity-50"
            >
              <ShoppingCart className="h-3.5 w-3.5" /> Comprar
            </button>
          </div>
        )}
      </div>
    </article>
  );
}

function OLXCard({ ad }: { ad: OLXAd }) {
  return (
    <a
      href={ad.url}
      target="_blank"
      rel="noopener noreferrer"
      className="supaste-glass-strong group block overflow-hidden rounded-[28px] transition-transform duration-400 ease-in-out hover:-translate-y-1"
    >
      <div className="relative aspect-[4/3] bg-[#f5f5f7]">
        {ad.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={ad.image_url}
            alt={ad.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="grid h-full w-full place-items-center text-supaste-muted">
            <ExternalLink className="h-8 w-8" />
          </div>
        )}
        <span className="absolute left-4 top-4 rounded-full bg-white/86 px-3 py-1 text-[10px] font-bold text-supaste-black backdrop-blur">
          OLX Portugal
        </span>
        <span className="absolute bottom-4 right-4 rounded-full bg-supaste-black px-3 py-1 text-[10px] font-bold text-white">
          {ad.location.split(",")[0]}
        </span>
      </div>
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <h3 className="line-clamp-2 text-lg font-bold leading-snug tracking-[-0.03em] text-supaste-black">
            {ad.title}
          </h3>
          <span className="shrink-0 text-lg font-bold text-supaste-black">{ad.price_display}</span>
        </div>
        <p className="mt-3 line-clamp-3 text-sm leading-6 text-supaste-muted">{ad.description}</p>
        <div className="mt-5 flex items-center justify-between border-t border-black/10 pt-4 text-xs font-semibold text-supaste-muted">
          <span className="truncate">{ad.seller_name}</span>
          <span className="flex items-center gap-1 text-supaste-blue">
            Abrir <ExternalLink className="h-3.5 w-3.5" />
          </span>
        </div>
      </div>
    </a>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="supaste-glass-strong grid min-h-[260px] place-items-center rounded-[28px] text-center">
      <div>
        <SlidersHorizontal className="mx-auto h-8 w-8 text-supaste-muted" />
        <p className="mt-3 text-sm font-bold text-supaste-black">{title}</p>
        <p className="mt-1 text-xs text-supaste-muted">{body}</p>
      </div>
    </div>
  );
}

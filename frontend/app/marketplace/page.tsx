"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import axios from "axios";
import { useCart } from "@/lib/cart";
import { useAuth } from "@/lib/auth";
import CartDrawer from "@/components/CartDrawer";
import StoreCatalog from "@/components/StoreCatalog";
import AuthHeaderButtons from "@/components/AuthHeaderButtons";
import AnunciarButton from "@/components/AnunciarButton";
import NotificationsBell from "@/components/NotificationsBell";
import { createRoom, sendMessage } from "@/lib/chat";
import { addFavorite, getFavoriteIds, removeFavorite } from "@/lib/favorites";

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

const conditionLabels: Record<Listing["condition"], string> = {
  novo: "Novo",
  usado_como_novo: "Como novo",
  usado_sinais: "Usado",
  pecas: "Para peças"
};

const formatPrice = (cents: number, currency: string) =>
  new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: currency.toUpperCase()
  }).format(cents / 100);

type Tab = "store" | "internal" | "olx";

export default function MarketplacePage() {
  const { count, isHydrated } = useCart();
  const [cartOpen, setCartOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("store");

  // Internal listings state
  const [listings, setListings] = useState<Listing[]>([]);
  const [condition, setCondition] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // OLX listings state
  const [olxListings, setOlxListings] = useState<OLXAd[]>([]);
  const [olxLoading, setOlxLoading] = useState(false);
  const [olxError, setOlxError] = useState<string | null>(null);
  const [searchDistrict, setSearchDistrict] = useState("Portugal");

  // Location coordinates from localStorage
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/$/, "") ?? "";

  const { user } = useAuth();
  const router = useRouter();
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [actionBusy, setActionBusy] = useState<string | null>(null);

  // Retrieve coordinates on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const latStr = localStorage.getItem("reisolari_lat");
      const lonStr = localStorage.getItem("reisolari_lon");
      if (latStr && lonStr) {
        setCoords({ lat: parseFloat(latStr), lon: parseFloat(lonStr) });
      }
    }
  }, []);

  // Fetch Internal listings
  useEffect(() => {
    const loadListings = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = condition ? { condition } : {};
        const response = await axios.get(`${backendUrl || ""}/api/v1/listings/`, { params });
        setListings(response.data);
      } catch {
        setError("Não foi possível carregar os anúncios do mercado interno.");
      } finally {
        setLoading(false);
      }
    };

    loadListings();
  }, [backendUrl, condition]);

  // Load which listings this user has favorited (for the heart state).
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
        prev.map(l => (l.id === listing.id ? { ...l, favorites_count: result.count } : l))
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
          `Olá! Tenho interesse em comprar "${listing.title}". Ainda está disponível?`
        );
      }
      router.push(`/mensagens?room=${room.id}`);
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Não foi possível abrir a conversa.");
    } finally {
      setActionBusy(null);
    }
  };

  // Fetch OLX listings
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
        const response = await axios.get(`${backendUrl || ""}/api/v1/listings/olx`, { params });
        setOlxListings(response.data.ads || []);
        setSearchDistrict(response.data.district || "Portugal");
      } catch {
        setOlxError("Não foi possível carregar os anúncios do OLX.");
      } finally {
        setOlxLoading(false);
      }
    };

    loadOlxListings();
  }, [backendUrl, coords]);

  const tabs: { id: Tab; label: string }[] = [
    { id: "store", label: "Loja Reisolari" },
    { id: "internal", label: "Mercado P2P" },
    { id: "olx", label: "Usados no OLX" }
  ];

  return (
    <main className="min-h-screen bg-bg text-slate-100 p-6 space-y-6">
      <header className="flex flex-col gap-4 border-b border-slate-800 pb-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Marketplace solar</h1>
            <p className="text-sm text-slate-400">Compre painéis solares novos com carrinho e checkout, ou explore o mercado P2P e anúncios do OLX.</p>
          </div>

          <div className="flex items-center gap-2">
            {user ? <NotificationsBell /> : null}
            <AnunciarButton />
            <AuthHeaderButtons />
            <Link
              href="/"
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-slate-300 bg-slate-900 border border-slate-800 hover:border-emerald-700 hover:text-emerald-300 transition-colors"
            >
              ← Voltar para simulador
            </Link>
            <button
              onClick={() => setCartOpen(true)}
              className="relative flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-slate-950 bg-emerald-500 hover:bg-emerald-400 transition-colors"
              aria-label="Abrir carrinho"
            >
              🛒 Carrinho
              {isHydrated && count > 0 ? (
                <span className="absolute -top-2 -right-2 min-w-[18px] h-[18px] px-1 grid place-items-center rounded-full bg-amber-400 text-slate-950 text-[10px] font-bold">
                  {count}
                </span>
              ) : null}
            </button>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-800 self-start">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all ${
                activeTab === tab.id
                  ? "bg-slate-800 text-emerald-400 shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      {activeTab === "store" ? (
        <StoreCatalog />
      ) : activeTab === "internal" ? (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-slate-200">Painéis de Vendedores Reisolari</h2>
            <label className="flex items-center text-sm gap-2 bg-slate-900 border border-slate-800 rounded-md px-3 py-1.5">
              <span className="text-slate-400 text-xs">Estado:</span>
              <select
                value={condition}
                onChange={event => setCondition(event.target.value)}
                className="bg-transparent text-slate-200 outline-none text-xs font-medium cursor-pointer"
              >
                <option value="" className="bg-slate-950">Todos</option>
                <option value="novo" className="bg-slate-950">Novo</option>
                <option value="usado_como_novo" className="bg-slate-950">Como novo</option>
                <option value="usado_sinais" className="bg-slate-950">Usado</option>
                <option value="pecas" className="bg-slate-950">Para peças</option>
              </select>
            </label>
          </div>

          {loading ? <div className="text-sm text-slate-400">A carregar anúncios...</div> : null}
          {error ? <div className="text-sm text-red-300">{error}</div> : null}

          {!loading && listings.length === 0 ? (
            <div className="text-sm text-slate-400 py-12 text-center border border-dashed border-slate-800 rounded-lg">
              Nenhum anúncio disponível no mercado interno.
            </div>
          ) : (
            <section className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
              {listings.map(listing => (
                <article key={listing.id} className="rounded-lg border border-slate-800 bg-card overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-emerald-950/10">
                  <div className="aspect-[4/3] bg-slate-950 relative">
                    {listing.image_urls[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={listing.image_urls[0]} alt={listing.title} className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full grid place-items-center text-xs text-slate-500">Sem imagem</div>
                    )}
                    <span className="absolute top-2 left-2 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      {conditionLabels[listing.condition]}
                    </span>
                    {user && listing.owner_id === user.uid ? null : (
                      <button
                        onClick={() => toggleFavorite(listing)}
                        className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded-full bg-black/50 backdrop-blur hover:bg-black/70 transition-colors"
                        aria-label="Adicionar aos favoritos"
                      >
                        <span aria-hidden>{favoriteIds.has(listing.id) ? "❤️" : "🤍"}</span>
                        {listing.favorites_count > 0 ? (
                          <span className="text-[10px] text-slate-200 font-semibold">{listing.favorites_count}</span>
                        ) : null}
                      </button>
                    )}
                  </div>
                  <div className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="font-semibold text-slate-100 leading-snug line-clamp-1">{listing.title}</h3>
                      <span className="text-sm text-emerald-400 font-bold whitespace-nowrap">
                        {formatPrice(listing.price_cents, listing.currency)}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-500 flex items-center gap-1.5">
                      {listing.listing_type === "premium" ? (
                        <span className="px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-300 font-bold">Premium</span>
                      ) : null}
                      <span className="truncate">
                        {listing.category_path?.length ? listing.category_path.join(" › ") : ""}
                        {listing.city ? ` · ${listing.city}` : ""}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 line-clamp-2">{listing.description}</p>
                    {user && listing.owner_id === user.uid ? (
                      <p className="text-[10px] text-slate-500 pt-1">O seu anúncio</p>
                    ) : (
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          onClick={() => openChat(listing, false)}
                          disabled={actionBusy === listing.id}
                          className="flex-1 px-2 py-1.5 rounded-lg text-xs font-semibold text-slate-200 bg-slate-800 border border-slate-700 hover:border-emerald-700 hover:text-emerald-300 disabled:opacity-50 transition-colors"
                        >
                          💬 Mensagem
                        </button>
                        <button
                          onClick={() => openChat(listing, true)}
                          disabled={actionBusy === listing.id}
                          className="flex-1 px-2 py-1.5 rounded-lg text-xs font-semibold text-slate-950 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 transition-colors"
                        >
                          🛒 Comprar
                        </button>
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </section>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Location status banner */}
          <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-emerald-400 text-sm">📍</span>
              <span className="text-xs text-slate-300">
                Região de busca OLX: <strong className="text-white">{searchDistrict}</strong>
              </span>
            </div>
            {searchDistrict === "Portugal" ? (
              <span className="text-[10px] text-slate-500 italic">
                * Dica: Desenhe a sua casa no simulador para ver anúncios da sua região.
              </span>
            ) : (
              <span className="text-[10px] text-emerald-400/80 font-medium bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                Filtro regional ativo
              </span>
            )}
          </div>

          {olxLoading ? <div className="text-sm text-slate-400">A obter anúncios em tempo real do OLX...</div> : null}
          {olxError ? <div className="text-sm text-red-300">{olxError}</div> : null}

          {!olxLoading && olxListings.length === 0 ? (
            <div className="text-sm text-slate-400 py-12 text-center border border-dashed border-slate-800 rounded-lg">
              Nenhum painel solar usado foi encontrado no OLX nesta região.
            </div>
          ) : (
            <section className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
              {olxListings.map(ad => (
                <a
                  href={ad.url}
                  key={ad.id}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group block rounded-lg border border-slate-800 bg-card overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-emerald-950/20"
                >
                  <div className="aspect-[4/3] bg-slate-950 relative">
                    {ad.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={ad.image_url}
                        alt={ad.title}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="h-full w-full grid place-items-center text-xs text-slate-500">Sem imagem</div>
                    )}
                    <span className="absolute top-2 left-2 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      OLX Portugal
                    </span>
                    <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded text-[9px] bg-slate-950/80 text-slate-300 backdrop-blur-sm">
                      {ad.location.split(",")[0]}
                    </span>
                  </div>
                  <div className="p-4 space-y-2 flex flex-col justify-between h-[160px]">
                    <div className="space-y-1">
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="font-semibold text-slate-100 leading-snug line-clamp-1 text-sm group-hover:text-emerald-400 transition-colors">
                          {ad.title}
                        </h3>
                        <span className="text-sm text-emerald-400 font-bold whitespace-nowrap">
                          {ad.price_display}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed">
                        {ad.description}
                      </p>
                    </div>

                    {/* Seller name + location (real OLX data only) */}
                    <div className="flex justify-between items-center text-xs border-t border-slate-800/80 pt-2.5 mt-auto">
                      <span className="text-slate-300 font-medium truncate max-w-[150px]" title={ad.seller_name}>
                        {ad.seller_name}
                      </span>
                      <span className="text-[10px] text-slate-500 truncate max-w-[120px]" title={ad.location}>
                        {ad.location.split(",")[0]}
                      </span>
                    </div>
                  </div>
                </a>
              ))}
            </section>
          )}
        </div>
      )}

      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
    </main>
  );
}

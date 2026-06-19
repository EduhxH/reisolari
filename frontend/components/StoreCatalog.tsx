"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Minus, PackageCheck, Plus, Search, SlidersHorizontal, Trash2 } from "lucide-react";
import { fetchProducts, formatPrice, type Product } from "@/lib/api";
import { useCart } from "@/lib/cart";
import PanelGraphic from "@/components/PanelGraphic";
import { RevealStagger, RevealItem } from "@/components/Reveal";

const CATEGORIES = ["Custo-benefício", "Alta eficiência", "Premium europeu", "Premium"];

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "price_asc", label: "Preço crescente" },
  { value: "price_desc", label: "Preço decrescente" },
  { value: "power_desc", label: "Maior potência" },
  { value: "efficiency_desc", label: "Maior eficiência" }
];

const formatEfficiency = (efficiency: number) =>
  `${(efficiency * 100).toFixed(1).replace(".", ",")}%`;

function ProductCard({ product }: { product: Product }) {
  const { addItem, setQuantity, removeItem, quantityOf } = useCart();
  const inCart = quantityOf(product.id);
  const soldOut = product.stock <= 0;

  return (
    <article className="supaste-glass-strong group flex min-h-[480px] flex-col overflow-hidden rounded-[28px] transition-transform duration-400 ease-in-out hover:-translate-y-1">
      <Link
        href={`/loja/${product.slug}`}
        className="relative grid aspect-[4/3] place-items-center bg-[linear-gradient(145deg,#f7f7f7,#ffffff)] p-5"
      >
        {product.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.image_url}
            alt={product.name}
            referrerPolicy="no-referrer"
            className="h-full max-h-48 w-auto object-contain transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <PanelGraphic
            widthMm={product.width_mm}
            heightMm={product.height_mm}
            cellCount={product.cell_count}
            powerW={product.power_w}
            className="h-full max-h-48 w-auto drop-shadow-2xl transition-transform duration-500 group-hover:scale-[1.03]"
          />
        )}
        <span className="absolute left-4 top-4 rounded-full border border-black/10 bg-white/80 px-3 py-1 text-[10px] font-bold text-supaste-blue backdrop-blur">
          {product.category}
        </span>
        <span className="absolute right-4 top-4 rounded-full bg-supaste-black px-3 py-1 text-[10px] font-bold text-white">
          {product.power_w} W
        </span>
      </Link>

      <div className="flex flex-1 flex-col p-5">
        <div>
          <p className="font-mono text-[10px] uppercase text-supaste-muted">{product.brand}</p>
          <Link
            href={`/loja/${product.slug}`}
            className="mt-2 block min-h-[3rem] text-lg font-bold leading-snug tracking-[-0.03em] text-supaste-black transition-colors hover:text-supaste-blue"
          >
            {product.name}
          </Link>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <Metric label="Eficiencia" value={formatEfficiency(product.efficiency)} />
          <Metric label="Potencia" value={`${product.power_w} W`} />
          <Metric label="Garantia" value={`${product.warranty_product_years} a`} />
        </div>

        <p className="mt-4 line-clamp-3 flex-1 text-sm leading-6 text-supaste-muted">
          {product.description}
        </p>

        <div className="mt-5 flex items-end justify-between gap-4">
          <div>
            <p className="text-2xl font-bold tracking-[-0.04em] text-supaste-black">
              {formatPrice(product.price_cents, product.currency)}
            </p>
            <p className="mt-1 text-[11px] text-supaste-muted">sem IVA · unidade</p>
          </div>
          <p className={`text-xs font-semibold ${soldOut ? "text-red-600" : "text-supaste-green"}`}>
            {soldOut ? "Esgotado" : `${product.stock} em stock`}
          </p>
        </div>

        {soldOut ? (
          <button
            disabled
            className="mt-5 min-h-[44px] w-full rounded-full bg-black/8 text-sm font-semibold text-supaste-muted"
          >
            Esgotado
          </button>
        ) : inCart === 0 ? (
          <button
            onClick={() => addItem(product)}
            className="supaste-button mt-5 min-h-[44px] w-full rounded-full bg-supaste-black text-sm font-semibold text-white"
          >
            Adicionar ao carrinho
          </button>
        ) : (
          <div className="mt-5 flex items-center gap-2">
            <div className="flex min-h-[44px] flex-1 items-center justify-between rounded-full border border-black/10 bg-white px-2">
              <button
                onClick={() => setQuantity(product.id, inCart - 1)}
                className="grid h-9 w-9 place-items-center rounded-full text-supaste-muted transition-colors duration-300 hover:bg-[#f5f5f7] hover:text-supaste-black"
                aria-label="Diminuir"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="font-mono text-sm font-semibold text-supaste-blue">{inCart}</span>
              <button
                onClick={() => addItem(product, 1)}
                disabled={inCart >= product.stock}
                className="grid h-9 w-9 place-items-center rounded-full text-supaste-muted transition-colors duration-300 hover:bg-[#f5f5f7] hover:text-supaste-black disabled:opacity-30"
                aria-label="Aumentar"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <button
              onClick={() => removeItem(product.id)}
              className="grid h-11 w-11 place-items-center rounded-full border border-black/10 bg-white text-supaste-muted transition-colors duration-300 hover:border-red-200 hover:text-red-600"
              aria-label="Remover"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </article>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-[#f5f5f7] p-2">
      <p className="text-[9px] uppercase text-supaste-muted">{label}</p>
      <p className="mt-1 text-xs font-bold text-supaste-black">{value}</p>
    </div>
  );
}

export default function StoreCatalog() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState("price_asc");
  const [inStockOnly, setInStockOnly] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(handle);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchProducts({
          search: debouncedSearch || undefined,
          category: category || undefined,
          sort,
          in_stock: inStockOnly || undefined
        });
        if (!cancelled) setProducts(data);
      } catch {
        if (!cancelled) setError("Nao foi possivel carregar o catalogo da loja.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [debouncedSearch, category, sort, inStockOnly]);

  const resultLabel = useMemo(() => {
    if (loading) return "A carregar";
    return `${products.length} ${products.length === 1 ? "painel" : "paineis"}`;
  }, [loading, products.length]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="font-mono text-xs uppercase text-supaste-blue">Loja Reisolari</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <h2 className="font-display text-3xl font-bold tracking-[-0.04em] text-supaste-black">
              Paineis solares novos
            </h2>
            <span className="rounded-full bg-[#f5f5f7] px-3 py-1 text-xs font-semibold text-supaste-muted">
              {resultLabel}
            </span>
          </div>
        </div>

        <div className="supaste-glass-strong flex flex-col gap-2 rounded-[26px] p-2 lg:flex-row lg:items-center">
          <label className="relative min-w-0 lg:w-56">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-supaste-muted" />
            <input
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Procurar marca"
              className="w-full rounded-full border border-transparent bg-white px-9 py-2.5 text-xs font-medium text-supaste-black outline-none transition-colors duration-300 focus:border-supaste-blue"
            />
          </label>
          <select
            value={category}
            onChange={event => setCategory(event.target.value)}
            className="rounded-full border border-transparent bg-white px-4 py-2.5 text-xs font-semibold text-supaste-black outline-none transition-colors duration-300 focus:border-supaste-blue"
          >
            <option value="">Todas as gamas</option>
            {CATEGORIES.map(cat => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
          <select
            value={sort}
            onChange={event => setSort(event.target.value)}
            className="rounded-full border border-transparent bg-white px-4 py-2.5 text-xs font-semibold text-supaste-black outline-none transition-colors duration-300 focus:border-supaste-blue"
          >
            {SORT_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-xs font-semibold text-supaste-black">
            <input
              type="checkbox"
              checked={inStockOnly}
              onChange={event => setInStockOnly(event.target.checked)}
              className="accent-supaste-blue"
            />
            Em stock
          </label>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      ) : null}

      {!loading && products.length === 0 && !error ? (
        <div className="supaste-glass-strong grid min-h-[220px] place-items-center rounded-[28px] text-center">
          <div>
            <SlidersHorizontal className="mx-auto h-8 w-8 text-supaste-muted" />
            <p className="mt-3 text-sm font-semibold text-supaste-black">
              Nenhum painel corresponde aos filtros.
            </p>
          </div>
        </div>
      ) : loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-[480px] animate-pulse rounded-[28px] bg-black/5" />
          ))}
        </div>
      ) : (
        <RevealStagger className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {products.map(product => (
            <RevealItem key={product.id}>
              <ProductCard product={product} />
            </RevealItem>
          ))}
        </RevealStagger>
      )}

      <div className="flex items-center gap-2 text-xs font-medium text-supaste-muted">
        <PackageCheck className="h-4 w-4" />
        Stock e preços atualizados em tempo real. Pagamento seguro à saída.
      </div>
    </div>
  );
}

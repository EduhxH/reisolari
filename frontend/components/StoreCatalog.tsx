"use client";

import React, { useEffect, useMemo, useState } from "react";
import { fetchProducts, formatPrice, type Product } from "@/lib/api";
import { useCart } from "@/lib/cart";
import PanelGraphic from "@/components/PanelGraphic";

const CATEGORIES = [
  "Custo-benefício",
  "Alta eficiência",
  "Premium europeu",
  "Premium"
];

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "price_asc", label: "Preço ↑" },
  { value: "price_desc", label: "Preço ↓" },
  { value: "power_desc", label: "Potência" },
  { value: "efficiency_desc", label: "Eficiência" }
];

const formatEfficiency = (efficiency: number) =>
  `${(efficiency * 100).toFixed(1).replace(".", ",")}%`;

function ProductCard({ product }: { product: Product }) {
  const { addItem, setQuantity, removeItem, quantityOf } = useCart();
  const inCart = quantityOf(product.id);
  const soldOut = product.stock <= 0;

  return (
    <article className="rounded-lg border border-slate-800 bg-card overflow-hidden flex flex-col transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-emerald-950/20">
      <div className="aspect-[4/3] bg-gradient-to-br from-slate-900 to-slate-950 relative grid place-items-center p-4">
        <PanelGraphic
          widthMm={product.width_mm}
          heightMm={product.height_mm}
          cellCount={product.cell_count}
          powerW={product.power_w}
          className="h-full w-auto max-h-44 drop-shadow-lg"
        />
        <span className="absolute top-2 left-2 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
          {product.category}
        </span>
        <span className="absolute top-2 right-2 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-950/80 text-amber-300 border border-amber-500/30">
          {product.power_w} W
        </span>
      </div>

      <div className="p-4 space-y-3 flex flex-col flex-1">
        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-wide text-slate-500 font-semibold">
            {product.brand}
          </p>
          <h3 className="font-semibold text-slate-100 leading-snug line-clamp-2 min-h-[2.5rem]">
            {product.name}
          </h3>
        </div>

        <div className="grid grid-cols-3 gap-1 text-center">
          <div className="bg-slate-900/60 rounded p-1.5">
            <p className="text-[9px] text-slate-500 uppercase">Eficiência</p>
            <p className="text-xs font-bold text-slate-200">
              {formatEfficiency(product.efficiency)}
            </p>
          </div>
          <div className="bg-slate-900/60 rounded p-1.5">
            <p className="text-[9px] text-slate-500 uppercase">Potência</p>
            <p className="text-xs font-bold text-slate-200">{product.power_w} W</p>
          </div>
          <div className="bg-slate-900/60 rounded p-1.5">
            <p className="text-[9px] text-slate-500 uppercase">Garantia</p>
            <p className="text-xs font-bold text-slate-200">
              {product.warranty_product_years} a
            </p>
          </div>
        </div>

        <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed flex-1">
          {product.description}
        </p>

        <div className="flex items-end justify-between pt-1">
          <div>
            <p className="text-lg font-bold text-emerald-400 leading-none">
              {formatPrice(product.price_cents, product.currency)}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">
              s/ IVA · unidade
            </p>
          </div>
          <p
            className={`text-[10px] font-medium ${
              soldOut ? "text-red-400" : "text-slate-400"
            }`}
          >
            {soldOut ? "Esgotado" : `${product.stock} em stock`}
          </p>
        </div>

        {soldOut ? (
          <button
            disabled
            className="w-full rounded-lg py-2 text-sm font-semibold bg-slate-800 text-slate-500 cursor-not-allowed"
          >
            Esgotado
          </button>
        ) : inCart === 0 ? (
          <button
            onClick={() => addItem(product)}
            className="w-full rounded-lg py-2 text-sm font-semibold bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-colors"
          >
            Adicionar ao carrinho
          </button>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center border border-slate-700 rounded-lg flex-1 justify-between">
              <button
                onClick={() => setQuantity(product.id, inCart - 1)}
                className="px-3 py-1.5 text-slate-300 hover:text-white"
                aria-label="Diminuir"
              >
                −
              </button>
              <span className="text-sm font-mono text-emerald-400 font-semibold">
                {inCart}
              </span>
              <button
                onClick={() => addItem(product, 1)}
                disabled={inCart >= product.stock}
                className="px-3 py-1.5 text-slate-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                aria-label="Aumentar"
              >
                +
              </button>
            </div>
            <button
              onClick={() => removeItem(product.id)}
              className="text-[11px] text-slate-500 hover:text-red-400 px-1"
            >
              remover
            </button>
          </div>
        )}
      </div>
    </article>
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

  // Debounce the free-text search to avoid a request per keystroke.
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
        if (!cancelled)
          setError("Não foi possível carregar o catálogo da loja.");
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
    if (loading) return "A carregar...";
    return `${products.length} ${products.length === 1 ? "painel" : "painéis"}`;
  }, [loading, products.length]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-slate-200">
            Painéis solares novos
          </h2>
          <span className="text-xs text-slate-500">· {resultLabel}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Procurar marca ou modelo..."
            className="bg-slate-900 border border-slate-800 rounded-md px-3 py-1.5 text-xs text-slate-200 outline-none focus:border-emerald-600 w-44"
          />
          <select
            value={category}
            onChange={event => setCategory(event.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-md px-3 py-1.5 text-xs text-slate-200 outline-none cursor-pointer"
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
            className="bg-slate-900 border border-slate-800 rounded-md px-3 py-1.5 text-xs text-slate-200 outline-none cursor-pointer"
          >
            {SORT_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-1.5 text-xs text-slate-300 bg-slate-900 border border-slate-800 rounded-md px-3 py-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={inStockOnly}
              onChange={event => setInStockOnly(event.target.checked)}
              className="accent-emerald-500"
            />
            Em stock
          </label>
        </div>
      </div>

      {error ? <div className="text-sm text-red-300">{error}</div> : null}

      {!loading && products.length === 0 && !error ? (
        <div className="text-sm text-slate-400 py-12 text-center border border-dashed border-slate-800 rounded-lg">
          Nenhum painel corresponde aos filtros selecionados.
        </div>
      ) : (
        <section className="grid sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
          {products.map(product => (
            <ProductCard key={product.id} product={product} />
          ))}
        </section>
      )}
    </div>
  );
}

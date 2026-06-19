"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";
import { ArrowLeft, Check, Minus, Plus, ShoppingCart } from "lucide-react";
import { fetchProduct, formatPrice, type Product } from "@/lib/api";
import { useCart } from "@/lib/cart";
import PanelGraphic from "@/components/PanelGraphic";
import Reveal from "@/components/Reveal";

const eff = (e: number) => `${(e * 100).toFixed(1).replace(".", ",")}%`;

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-supaste-section p-4">
      <div className="text-[11px] uppercase tracking-wide text-supaste-muted">{label}</div>
      <div className="mt-1 font-display text-base font-semibold text-supaste-ink">{value}</div>
    </div>
  );
}

export default function ProductPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug;
  const { addItem, setQuantity, quantityOf } = useCart();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    setLoading(true);
    fetchProduct(slug)
      .then(p => {
        if (!cancelled) setProduct(p);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  return (
    <main className="min-h-screen bg-supaste-mist text-supaste-ink">
      <header className="px-4 pt-5">
        <nav className="supaste-glass-strong mx-auto flex max-w-5xl items-center justify-between rounded-full px-4 py-2.5">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/images/reisolari-logo.jpeg" alt="Reisolari" width={30} height={30} className="rounded-full" />
            <span className="font-display text-base font-semibold tracking-tight">Reisolari</span>
          </Link>
          <Link
            href="/marketplace"
            className="flex items-center gap-1.5 text-sm font-medium text-supaste-muted transition-colors hover:text-supaste-ink"
          >
            <ArrowLeft className="h-4 w-4" /> Marketplace
          </Link>
        </nav>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-10">
        {loading ? (
          <div className="grid gap-8 md:grid-cols-2">
            <div className="aspect-square animate-pulse rounded-[28px] bg-black/5" />
            <div className="space-y-4">
              <div className="h-8 w-2/3 animate-pulse rounded-full bg-black/5" />
              <div className="h-24 animate-pulse rounded-2xl bg-black/5" />
            </div>
          </div>
        ) : error || !product ? (
          <div className="grid min-h-[40vh] place-items-center text-center">
            <div>
              <p className="text-supaste-muted">Produto não encontrado.</p>
              <Link href="/marketplace" className="mt-2 inline-block font-semibold text-supaste-blue">
                Voltar à loja →
              </Link>
            </div>
          </div>
        ) : (
          <Detail product={product} addItem={addItem} setQuantity={setQuantity} inCart={quantityOf(product.id)} />
        )}
      </div>
    </main>
  );
}

function Detail({
  product,
  addItem,
  setQuantity,
  inCart
}: {
  product: Product;
  addItem: (p: Product, q?: number) => void;
  setQuantity: (id: string, q: number) => void;
  inCart: number;
}) {
  const soldOut = product.stock <= 0;
  return (
    <div className="grid gap-10 md:grid-cols-2">
      <Reveal>
        <div className="relative grid aspect-square place-items-center overflow-hidden rounded-[28px] bg-white p-8 shadow-soft-float">
          {product.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.image_url}
              alt={product.name}
              referrerPolicy="no-referrer"
              className="h-full w-full object-contain"
            />
          ) : (
            <PanelGraphic
              widthMm={product.width_mm}
              heightMm={product.height_mm}
              cellCount={product.cell_count}
              powerW={product.power_w}
              className="h-full max-h-72 w-auto drop-shadow-2xl"
            />
          )}
          <span className="absolute left-5 top-5 rounded-full bg-supaste-black px-3 py-1 text-[11px] font-bold text-white">
            {product.power_w} W
          </span>
        </div>
      </Reveal>

      <Reveal delay={0.08} className="flex flex-col">
        <p className="font-mono text-xs uppercase tracking-wide text-supaste-muted">{product.brand}</p>
        <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">{product.name}</h1>
        <div className="mt-2 flex items-center gap-2">
          <span className="rounded-full bg-supaste-section px-3 py-1 text-xs font-semibold text-supaste-muted">
            {product.category}
          </span>
          <span className="rounded-full bg-supaste-section px-3 py-1 text-xs font-semibold text-supaste-muted">
            {product.panel_type}
          </span>
        </div>

        <p className="mt-4 text-sm leading-relaxed text-supaste-muted">{product.description}</p>

        <div className="mt-6 flex items-end justify-between">
          <div>
            <div className="font-display text-3xl font-semibold tracking-tight">
              {formatPrice(product.price_cents, product.currency)}
            </div>
            <div className="text-xs text-supaste-muted">sem IVA · por unidade</div>
          </div>
          <span className={`text-sm font-semibold ${soldOut ? "text-red-600" : "text-supaste-green"}`}>
            {soldOut ? "Esgotado" : `${product.stock} em stock`}
          </span>
        </div>

        <div className="mt-5">
          {soldOut ? (
            <button disabled className="min-h-[52px] w-full rounded-full bg-black/5 text-sm font-semibold text-supaste-muted">
              Esgotado
            </button>
          ) : inCart === 0 ? (
            <button
              onClick={() => addItem(product)}
              className="supaste-button flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full bg-supaste-black text-sm font-semibold text-white"
            >
              <ShoppingCart className="h-4 w-4" /> Adicionar ao carrinho
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <div className="flex min-h-[52px] flex-1 items-center justify-between rounded-full border border-black/10 bg-white px-3">
                <button onClick={() => setQuantity(product.id, inCart - 1)} className="grid h-10 w-10 place-items-center rounded-full text-supaste-muted hover:bg-supaste-section" aria-label="Diminuir">
                  <Minus className="h-4 w-4" />
                </button>
                <span className="font-mono text-sm font-semibold text-supaste-blue">{inCart} no carrinho</span>
                <button onClick={() => addItem(product, 1)} disabled={inCart >= product.stock} className="grid h-10 w-10 place-items-center rounded-full text-supaste-muted hover:bg-supaste-section disabled:opacity-30" aria-label="Aumentar">
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              <Link href="/marketplace" className="rounded-full bg-supaste-section px-5 py-3 text-sm font-semibold text-supaste-ink">
                Continuar
              </Link>
            </div>
          )}
        </div>

        {/* Especificações reais */}
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Spec label="Potência" value={`${product.power_w} W`} />
          <Spec label="Eficiência" value={eff(product.efficiency)} />
          <Spec label="Células" value={`${product.cell_count}`} />
          <Spec label="Dimensões" value={`${product.width_mm}×${product.height_mm} mm`} />
          <Spec label="Peso" value={`${product.weight_kg} kg`} />
          <Spec label="Garantia" value={`${product.warranty_product_years} anos`} />
        </div>

        <ul className="mt-6 space-y-2 text-sm text-supaste-muted">
          <li className="flex items-center gap-2"><Check className="h-4 w-4 text-supaste-green" /> Garantia de produção até {product.warranty_power_years} anos</li>
          <li className="flex items-center gap-2"><Check className="h-4 w-4 text-supaste-green" /> Envio para todo o Portugal continental e ilhas</li>
        </ul>

        {product.source_url ? (
          <a href={product.source_url} target="_blank" rel="noopener noreferrer" className="mt-4 text-xs text-supaste-muted underline-offset-2 hover:text-supaste-blue hover:underline">
            Ver ficha do fabricante
          </a>
        ) : null}
      </Reveal>
    </div>
  );
}

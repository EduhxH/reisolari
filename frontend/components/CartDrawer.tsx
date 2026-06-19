"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus, ShoppingCart, Trash2, X } from "lucide-react";
import { formatPrice } from "@/lib/api";
import { useCart } from "@/lib/cart";
import PanelGraphic from "@/components/PanelGraphic";

export default function CartDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { items, count, subtotalNetCents, setQuantity, removeItem } = useCart();

  const goToCheckout = () => {
    onClose();
    router.push("/marketplace/checkout");
  };

  return (
    <div className={`fixed inset-0 z-50 ${open ? "" : "pointer-events-none"}`} aria-hidden={!open}>
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-supaste-black/35 backdrop-blur-sm transition-opacity duration-300 ${
          open ? "opacity-100" : "opacity-0"
        }`}
      />

      <aside
        className={`absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-white/60 bg-white/88 shadow-2xl backdrop-blur-2xl transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        role="dialog"
        aria-label="Carrinho de compras"
      >
        <header className="flex items-center justify-between border-b border-black/10 px-5 py-4">
          <h2 className="flex items-center gap-2 text-base font-bold text-supaste-black">
            <ShoppingCart className="h-4 w-4" />
            Carrinho
            <span className="rounded-full bg-[#f5f5f7] px-2 py-0.5 text-xs text-supaste-muted">
              {count}
            </span>
          </h2>
          <button
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-full border border-black/10 bg-white text-supaste-muted transition-colors duration-300 hover:text-supaste-black"
            aria-label="Fechar carrinho"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
          {items.length === 0 ? (
            <div className="grid h-full min-h-[260px] place-items-center text-center">
              <div>
                <ShoppingCart className="mx-auto h-8 w-8 text-supaste-muted" />
                <p className="mt-3 text-sm font-semibold text-supaste-black">O carrinho esta vazio.</p>
                <p className="mt-1 text-xs text-supaste-muted">
                  Adicione paineis solares a partir da loja.
                </p>
              </div>
            </div>
          ) : (
            items.map(({ product, quantity }) => (
              <div key={product.id} className="supaste-glass flex gap-3 rounded-[24px] p-3">
                <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-[#f5f5f7] p-2">
                  <PanelGraphic
                    widthMm={product.width_mm}
                    heightMm={product.height_mm}
                    cellCount={product.cell_count}
                    powerW={product.power_w}
                    className="h-12 w-auto"
                  />
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="line-clamp-2 text-xs font-bold leading-snug text-supaste-black">
                      {product.name}
                    </p>
                    <button
                      onClick={() => removeItem(product.id)}
                      className="text-supaste-muted transition-colors duration-300 hover:text-red-600"
                      aria-label={`Remover ${product.name}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center rounded-full border border-black/10 bg-white">
                      <button
                        onClick={() => setQuantity(product.id, quantity - 1)}
                        className="grid h-8 w-8 place-items-center text-supaste-muted transition-colors duration-300 hover:text-supaste-black"
                        aria-label="Diminuir quantidade"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="min-w-[1.6rem] text-center font-mono text-xs font-semibold text-supaste-blue">
                        {quantity}
                      </span>
                      <button
                        onClick={() => setQuantity(product.id, quantity + 1)}
                        disabled={quantity >= product.stock}
                        className="grid h-8 w-8 place-items-center text-supaste-muted transition-colors duration-300 hover:text-supaste-black disabled:opacity-30"
                        aria-label="Aumentar quantidade"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <span className="text-sm font-bold text-supaste-black">
                      {formatPrice(product.price_cents * quantity, product.currency)}
                    </span>
                  </div>
                  {quantity >= product.stock ? (
                    <p className="text-[10px] font-medium text-amber-700">
                      Stock maximo ({product.stock}) atingido
                    </p>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </div>

        {items.length > 0 ? (
          <footer className="border-t border-black/10 px-5 py-4">
            <div className="flex justify-between text-sm">
              <span className="text-supaste-muted">Subtotal sem IVA</span>
              <span className="font-bold text-supaste-black">{formatPrice(subtotalNetCents)}</span>
            </div>
            <p className="mt-2 text-[11px] leading-5 text-supaste-muted">
              IVA e portes de envio sao calculados no checkout conforme a regiao fiscal.
            </p>
            <button
              onClick={goToCheckout}
              className="supaste-button mt-4 min-h-[46px] w-full rounded-full bg-supaste-black text-sm font-semibold text-white"
            >
              Finalizar compra
            </button>
          </footer>
        ) : null}
      </aside>
    </div>
  );
}

"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart";
import { formatPrice } from "@/lib/api";
import PanelGraphic from "@/components/PanelGraphic";

export default function CartDrawer({
  open,
  onClose
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const { items, count, subtotalNetCents, setQuantity, removeItem } = useCart();

  const goToCheckout = () => {
    onClose();
    router.push("/marketplace/checkout");
  };

  return (
    <div
      className={`fixed inset-0 z-50 ${open ? "" : "pointer-events-none"}`}
      aria-hidden={!open}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-black/60 transition-opacity duration-300 ${
          open ? "opacity-100" : "opacity-0"
        }`}
      />

      {/* Panel */}
      <aside
        className={`absolute right-0 top-0 h-full w-full max-w-md bg-slate-950 border-l border-slate-800 shadow-2xl flex flex-col transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        role="dialog"
        aria-label="Carrinho de compras"
      >
        <header className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <h2 className="text-base font-semibold text-white">
            Carrinho{" "}
            <span className="text-emerald-400">
              ({count} {count === 1 ? "item" : "itens"})
            </span>
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-xl leading-none px-2"
            aria-label="Fechar carrinho"
          >
            ×
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {items.length === 0 ? (
            <div className="text-sm text-slate-400 py-16 text-center">
              O seu carrinho está vazio.
              <br />
              Adicione painéis solares a partir da loja.
            </div>
          ) : (
            items.map(({ product, quantity }) => (
              <div
                key={product.id}
                className="flex gap-3 border border-slate-800 rounded-lg p-3 bg-slate-900/50"
              >
                <div className="w-14 shrink-0 bg-slate-950 rounded grid place-items-center p-1">
                  <PanelGraphic
                    widthMm={product.width_mm}
                    heightMm={product.height_mm}
                    cellCount={product.cell_count}
                    powerW={product.power_w}
                    className="h-12 w-auto"
                  />
                </div>
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-semibold text-slate-100 leading-snug line-clamp-2">
                      {product.name}
                    </p>
                    <button
                      onClick={() => removeItem(product.id)}
                      className="text-slate-500 hover:text-red-400 text-xs shrink-0"
                      aria-label={`Remover ${product.name}`}
                    >
                      remover
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center border border-slate-700 rounded">
                      <button
                        onClick={() => setQuantity(product.id, quantity - 1)}
                        className="px-2 py-0.5 text-slate-300 hover:text-white"
                        aria-label="Diminuir quantidade"
                      >
                        −
                      </button>
                      <span className="px-2 text-xs font-mono text-slate-100 min-w-[1.5rem] text-center">
                        {quantity}
                      </span>
                      <button
                        onClick={() => setQuantity(product.id, quantity + 1)}
                        disabled={quantity >= product.stock}
                        className="px-2 py-0.5 text-slate-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                        aria-label="Aumentar quantidade"
                      >
                        +
                      </button>
                    </div>
                    <span className="text-sm font-bold text-emerald-400">
                      {formatPrice(product.price_cents * quantity, product.currency)}
                    </span>
                  </div>
                  {quantity >= product.stock ? (
                    <p className="text-[10px] text-amber-400/80">
                      Stock máximo ({product.stock}) atingido
                    </p>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </div>

        {items.length > 0 ? (
          <footer className="border-t border-slate-800 px-5 py-4 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Subtotal (sem IVA)</span>
              <span className="text-slate-100 font-semibold">
                {formatPrice(subtotalNetCents)}
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              IVA e portes de envio calculados no checkout conforme a sua região.
            </p>
            <button
              onClick={goToCheckout}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold rounded-lg py-2.5 text-sm transition-colors"
            >
              Finalizar compra
            </button>
          </footer>
        ) : null}
      </aside>
    </div>
  );
}

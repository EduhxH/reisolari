"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useCart } from "@/lib/cart";
import { useAuth } from "@/lib/auth";
import { validateAddressClient } from "@/lib/geocoding";
import {
  createOrder,
  formatPrice,
  type CreateOrderPayload,
  type OrderRegion
} from "@/lib/api";
import PanelGraphic from "@/components/PanelGraphic";

const VAT_RATES: Record<OrderRegion, number> = {
  continent: 0.06,
  madeira: 0.05,
  azores: 0.04
};
const REGION_LABELS: Record<OrderRegion, string> = {
  continent: "Portugal Continental (IVA 6%)",
  madeira: "Madeira (IVA 5%)",
  azores: "Açores (IVA 4%)"
};
const FREE_SHIPPING_THRESHOLD = 75000;
const FLAT_SHIPPING = 3490;

type FormState = {
  full_name: string;
  email: string;
  phone: string;
  address_line: string;
  city: string;
  postal_code: string;
  region: OrderRegion;
};

const initialForm: FormState = {
  full_name: "",
  email: "",
  phone: "",
  address_line: "",
  city: "",
  postal_code: "",
  region: "continent"
};

export default function CheckoutPage() {
  const { items, subtotalNetCents, isHydrated } = useCart();
  const { user, getIdToken } = useAuth();
  const [form, setForm] = useState<FormState>(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Prefill name/email for signed-in (non-anonymous) users, without clobbering edits.
  useEffect(() => {
    if (user && !user.isAnonymous) {
      setForm(prev => ({
        ...prev,
        full_name: prev.full_name || user.displayName || "",
        email: prev.email || user.email || ""
      }));
    }
  }, [user]);

  const totals = useMemo(() => {
    const vatRate = VAT_RATES[form.region];
    let subtotalGross = 0;
    for (const { product, quantity } of items) {
      const grossUnit = Math.round(product.price_cents * (1 + vatRate));
      subtotalGross += grossUnit * quantity;
    }
    const vat = subtotalGross - subtotalNetCents;
    const shipping =
      subtotalNetCents >= FREE_SHIPPING_THRESHOLD ? 0 : FLAT_SHIPPING;
    return {
      vatRate,
      net: subtotalNetCents,
      vat,
      shipping,
      total: subtotalGross + shipping
    };
  }, [items, subtotalNetCents, form.region]);

  const update = (field: keyof FormState) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => setForm(prev => ({ ...prev, [field]: event.target.value }));

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (items.length === 0) return;
    setSubmitting(true);
    setError(null);

    // Validate the address exists before charging anything (server re-checks too).
    const check = await validateAddressClient(
      form.address_line,
      form.city,
      form.postal_code
    );
    if (!check.valid) {
      setError(
        check.reason === "not_found"
          ? "Não encontrámos esta morada. Verifique a rua, o código postal e a cidade."
          : `Não foi possível confirmar a morada${
              check.normalized ? `. Será que quis dizer: ${check.normalized}?` : "."
            }`
      );
      setSubmitting(false);
      return;
    }

    try {
      const idToken = await getIdToken();
      const payload: CreateOrderPayload = {
        items: items.map(({ product, quantity }) => ({
          product_id: product.id,
          quantity
        })),
        customer: { ...form },
        success_url: `${window.location.origin}/marketplace/order`,
        cancel_url: `${window.location.origin}/marketplace/checkout`
      };
      const { checkout_url } = await createOrder(payload, idToken);
      // Cart is cleared on the confirmation page once payment is confirmed, so a
      // cancelled payment returns the buyer here with the cart intact.
      window.location.href = checkout_url;
    } catch (err: any) {
      const detail =
        err?.response?.data?.detail ??
        "Não foi possível iniciar o pagamento. Tente novamente.";
      setError(typeof detail === "string" ? detail : "Erro ao processar o pedido.");
      setSubmitting(false);
    }
  };

  if (isHydrated && items.length === 0) {
    return (
      <main className="min-h-screen bg-supaste-mist text-supaste-ink p-6">
        <div className="max-w-md mx-auto text-center py-24 space-y-4">
          <h1 className="text-xl font-semibold">O seu carrinho está vazio</h1>
          <p className="text-sm text-supaste-muted">
            Adicione painéis solares antes de finalizar a compra.
          </p>
          <Link
            href="/marketplace"
            className="inline-block px-4 py-2 rounded-lg bg-supaste-black hover:opacity-90 text-slate-950 text-sm font-semibold"
          >
            Ir para a loja
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-supaste-mist text-supaste-ink p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="flex items-center justify-between border-b border-black/10 pb-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-supaste-ink">Checkout</h1>
            <p className="text-sm text-supaste-muted">
              Pagamento seguro processado pela Stripe.
            </p>
          </div>
          <Link
            href="/marketplace"
            className="text-xs font-semibold text-supaste-muted hover:text-supaste-blue"
          >
            ← Continuar a comprar
          </Link>
        </header>

        {user && !user.isAnonymous ? (
          <div className="text-xs text-supaste-muted bg-supaste-section/60 border border-black/10 rounded-lg px-4 py-2">
            A comprar como{" "}
            <span className="text-supaste-blue font-medium">
              {user.email || user.displayName}
            </span>{" "}
            — o pedido ficará associado à sua conta.
          </div>
        ) : (
          <div className="text-xs text-supaste-muted bg-supaste-section/60 border border-black/10 rounded-lg px-4 py-2 flex items-center justify-between gap-2">
            <span>A finalizar como convidado.</span>
            <Link
              href="/login?redirect=/marketplace/checkout"
              className="text-supaste-blue hover:text-supaste-blue font-medium whitespace-nowrap"
            >
              Iniciar sessão
            </Link>
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="grid lg:grid-cols-[1.3fr,1fr] gap-6 items-start"
        >
          {/* Customer details */}
          <section className="space-y-4 rounded-xl border border-black/10 bg-white p-5">
            <h2 className="text-sm font-semibold text-supaste-ink uppercase tracking-wide">
              Dados de entrega
            </h2>

            <Field label="Nome completo">
              <input
                required
                minLength={3}
                value={form.full_name}
                onChange={update("full_name")}
                className="form-input"
                placeholder="Maria Silva"
              />
            </Field>

            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Email">
                <input
                  required
                  type="email"
                  value={form.email}
                  onChange={update("email")}
                  className="form-input"
                  placeholder="maria@email.pt"
                />
              </Field>
              <Field label="Telefone">
                <input
                  required
                  minLength={6}
                  value={form.phone}
                  onChange={update("phone")}
                  className="form-input"
                  placeholder="+351 912 345 678"
                />
              </Field>
            </div>

            <Field label="Morada">
              <input
                required
                minLength={4}
                value={form.address_line}
                onChange={update("address_line")}
                className="form-input"
                placeholder="Rua das Flores, 12"
              />
            </Field>

            <div className="grid sm:grid-cols-3 gap-4">
              <Field label="Cidade">
                <input
                  required
                  minLength={2}
                  value={form.city}
                  onChange={update("city")}
                  className="form-input"
                  placeholder="Lisboa"
                />
              </Field>
              <Field label="Código postal">
                <input
                  required
                  minLength={4}
                  value={form.postal_code}
                  onChange={update("postal_code")}
                  className="form-input"
                  placeholder="1000-100"
                />
              </Field>
              <Field label="Região (IVA)">
                <select
                  value={form.region}
                  onChange={update("region")}
                  className="form-input cursor-pointer"
                >
                  {(Object.keys(REGION_LABELS) as OrderRegion[]).map(region => (
                    <option key={region} value={region}>
                      {REGION_LABELS[region]}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <style jsx>{`
              :global(.form-input) {
                width: 100%;
                background: #0f172a;
                border: 1px solid #1e293b;
                border-radius: 0.5rem;
                padding: 0.5rem 0.75rem;
                font-size: 0.875rem;
                color: #e2e8f0;
                outline: none;
              }
              :global(.form-input:focus) {
                border-color: #047857;
              }
            `}</style>
          </section>

          {/* Order summary */}
          <aside className="space-y-4 rounded-xl border border-black/10 bg-white p-5 lg:sticky lg:top-6">
            <h2 className="text-sm font-semibold text-supaste-ink uppercase tracking-wide">
              Resumo do pedido
            </h2>

            <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
              {items.map(({ product, quantity }) => (
                <div key={product.id} className="flex gap-3 items-center">
                  <div className="w-10 shrink-0 bg-white rounded grid place-items-center p-1">
                    <PanelGraphic
                      widthMm={product.width_mm}
                      heightMm={product.height_mm}
                      cellCount={product.cell_count}
                      powerW={product.power_w}
                      className="h-9 w-auto"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-supaste-ink line-clamp-1">
                      {product.name}
                    </p>
                    <p className="text-[10px] text-supaste-muted">
                      {quantity} × {formatPrice(product.price_cents)} (s/ IVA)
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-supaste-ink">
                    {formatPrice(product.price_cents * quantity)}
                  </span>
                </div>
              ))}
            </div>

            <div className="border-t border-black/10 pt-3 space-y-1.5 text-sm">
              <Row label="Subtotal (s/ IVA)" value={formatPrice(totals.net)} />
              <Row
                label={`IVA (${(totals.vatRate * 100).toFixed(0)}%)`}
                value={formatPrice(totals.vat)}
              />
              <Row
                label="Portes de envio"
                value={
                  totals.shipping === 0 ? "Grátis" : formatPrice(totals.shipping)
                }
              />
              <div className="flex justify-between pt-2 border-t border-black/10 mt-2">
                <span className="font-semibold text-supaste-ink">Total</span>
                <span className="font-bold text-supaste-blue text-lg">
                  {formatPrice(totals.total)}
                </span>
              </div>
            </div>

            {totals.shipping > 0 ? (
              <p className="text-[11px] text-supaste-muted">
                Portes grátis em compras acima de{" "}
                {formatPrice(FREE_SHIPPING_THRESHOLD)} (s/ IVA).
              </p>
            ) : null}

            {error ? (
              <div className="text-xs text-red-300 bg-red-950/40 border border-red-900/50 rounded-lg p-2.5">
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={submitting || items.length === 0}
              className="w-full bg-supaste-black hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-semibold rounded-lg py-2.5 text-sm transition-colors"
            >
              {submitting ? "A redirecionar para o pagamento..." : "Pagar com cartão"}
            </button>
            <p className="text-[11px] text-supaste-muted text-center">
              Será redirecionado para o checkout seguro da Stripe.
            </p>
          </aside>
        </form>
      </div>
    </main>
  );
}

function Field({
  label,
  children
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-xs text-supaste-muted">{label}</span>
      {children}
    </label>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-supaste-muted">{label}</span>
      <span className="text-supaste-ink">{value}</span>
    </div>
  );
}

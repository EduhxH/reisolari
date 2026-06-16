"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { fetchOrder, formatPrice, type Order } from "@/lib/api";
import { useCart } from "@/lib/cart";

const STATUS_META: Record<
  Order["status"],
  { label: string; tone: string; icon: string; note: string }
> = {
  paid: {
    label: "Pagamento confirmado",
    tone: "text-emerald-300 bg-emerald-500/10 border-emerald-500/30",
    icon: "✓",
    note: "Obrigado pela sua compra! Receberá um email com os detalhes da entrega."
  },
  pending: {
    label: "A aguardar confirmação do pagamento",
    tone: "text-amber-300 bg-amber-500/10 border-amber-500/30",
    icon: "⏳",
    note: "Estamos a confirmar o seu pagamento com a Stripe. Esta página atualiza automaticamente."
  },
  failed: {
    label: "Pagamento não concluído",
    tone: "text-red-300 bg-red-500/10 border-red-500/30",
    icon: "✕",
    note: "O pagamento não foi concluído. Pode tentar novamente a partir do carrinho."
  },
  cancelled: {
    label: "Pedido cancelado",
    tone: "text-slate-300 bg-slate-500/10 border-slate-500/30",
    icon: "—",
    note: "Este pedido foi cancelado."
  }
};

export default function OrderConfirmationPage() {
  const params = useParams();
  const orderNumber = Array.isArray(params.orderNumber)
    ? params.orderNumber[0]
    : (params.orderNumber as string);

  const { clear } = useCart();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const attempts = useRef(0);
  const cartCleared = useRef(false);

  const load = useCallback(async () => {
    try {
      const data = await fetchOrder(orderNumber);
      setOrder(data);
      setError(null);
      return data;
    } catch {
      setError("Não foi possível encontrar este pedido.");
      return null;
    } finally {
      setLoading(false);
    }
  }, [orderNumber]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const run = async () => {
      const data = await load();
      if (data && data.status === "paid" && !cartCleared.current) {
        cartCleared.current = true;
        clear();
      }
      // Auto-retry while pending (the webhook may arrive slightly after redirect).
      if (data && data.status === "pending" && attempts.current < 5) {
        attempts.current += 1;
        timer = setTimeout(run, 2500);
      }
    };
    run();
    return () => clearTimeout(timer);
  }, [load, clear]);

  if (loading) {
    return (
      <main className="min-h-screen bg-bg text-slate-100 p-6">
        <div className="max-w-2xl mx-auto py-24 text-center text-sm text-slate-400">
          A carregar o seu pedido...
        </div>
      </main>
    );
  }

  if (error || !order) {
    return (
      <main className="min-h-screen bg-bg text-slate-100 p-6">
        <div className="max-w-2xl mx-auto py-24 text-center space-y-4">
          <h1 className="text-xl font-semibold">Pedido não encontrado</h1>
          <p className="text-sm text-slate-400">{error}</p>
          <Link
            href="/marketplace"
            className="inline-block px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-sm font-semibold"
          >
            Voltar à loja
          </Link>
        </div>
      </main>
    );
  }

  const meta = STATUS_META[order.status];

  return (
    <main className="min-h-screen bg-bg text-slate-100 p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <div
          className={`rounded-xl border p-6 text-center space-y-2 ${meta.tone}`}
        >
          <div className="text-3xl">{meta.icon}</div>
          <h1 className="text-xl font-bold">{meta.label}</h1>
          <p className="text-sm opacity-90">{meta.note}</p>
          <p className="text-xs font-mono opacity-70 pt-1">
            Pedido {order.order_number}
          </p>
        </div>

        {order.status === "pending" ? (
          <button
            onClick={() => load()}
            className="w-full text-xs font-semibold text-slate-300 hover:text-emerald-300 border border-slate-800 rounded-lg py-2"
          >
            Atualizar estado do pagamento
          </button>
        ) : null}

        <section className="rounded-xl border border-slate-800 bg-card p-5 space-y-3">
          <h2 className="text-sm font-semibold text-slate-200 uppercase tracking-wide">
            Itens
          </h2>
          <div className="space-y-2">
            {order.items.map(item => (
              <div
                key={item.product_id}
                className="flex justify-between items-center text-sm border-b border-slate-800/60 pb-2 last:border-0"
              >
                <div className="min-w-0">
                  <p className="text-slate-200 line-clamp-1">{item.name}</p>
                  <p className="text-[11px] text-slate-500">
                    {item.quantity} × {formatPrice(item.unit_price_net_cents)} (s/ IVA)
                  </p>
                </div>
                <span className="font-semibold text-slate-200 whitespace-nowrap">
                  {formatPrice(item.line_net_cents)}
                </span>
              </div>
            ))}
          </div>

          <div className="border-t border-slate-800 pt-3 space-y-1.5 text-sm">
            <Row label="Subtotal (s/ IVA)" value={formatPrice(order.subtotal_net_cents)} />
            <Row
              label={`IVA (${(order.vat_rate * 100).toFixed(0)}%)`}
              value={formatPrice(order.vat_cents)}
            />
            <Row
              label="Portes de envio"
              value={
                order.shipping_cents === 0
                  ? "Grátis"
                  : formatPrice(order.shipping_cents)
              }
            />
            <div className="flex justify-between pt-2 border-t border-slate-800 mt-2">
              <span className="font-semibold text-slate-100">Total pago</span>
              <span className="font-bold text-emerald-400 text-lg">
                {formatPrice(order.total_cents)}
              </span>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-slate-800 bg-card p-5 space-y-1.5">
          <h2 className="text-sm font-semibold text-slate-200 uppercase tracking-wide mb-2">
            Entrega
          </h2>
          <p className="text-sm text-slate-200">{order.customer.full_name}</p>
          <p className="text-xs text-slate-400">{order.customer.address_line}</p>
          <p className="text-xs text-slate-400">
            {order.customer.postal_code} {order.customer.city}
          </p>
          <p className="text-xs text-slate-400">{order.customer.email}</p>
          <p className="text-xs text-slate-400">{order.customer.phone}</p>
        </section>

        <div className="flex justify-center gap-3">
          <Link
            href="/marketplace"
            className="px-4 py-2 rounded-lg bg-slate-900 border border-slate-800 hover:border-emerald-700 text-slate-200 text-sm font-semibold"
          >
            Voltar à loja
          </Link>
          <Link
            href="/"
            className="px-4 py-2 rounded-lg bg-slate-900 border border-slate-800 hover:border-emerald-700 text-slate-200 text-sm font-semibold"
          >
            Ir para o simulador
          </Link>
        </div>
      </div>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-slate-400">{label}</span>
      <span className="text-slate-200">{value}</span>
    </div>
  );
}

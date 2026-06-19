"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useRequireAuth, AuthChecking } from "@/lib/useRequireAuth";
import MapSolar from "@/components/MapSolar";
import LocationSearch from "@/components/LocationSearch";
import {
  DEFAULT_QUESTIONNAIRE,
  Questionnaire,
  Region,
  Priority,
  getMyQuestionnaire,
  runSimulation,
  uploadBill
} from "@/lib/questionnaire";

const REGIONS: { value: Region; label: string }[] = [
  { value: "norte", label: "Norte" },
  { value: "centro", label: "Centro" },
  { value: "sul", label: "Sul" },
  { value: "madeira", label: "Madeira" },
  { value: "acores", label: "Açores" }
];

const COVERAGES = [0.25, 0.5, 0.75, 1.0];

const PRIORITIES: { value: Priority; label: string; hint: string }[] = [
  { value: "custo", label: "Custo", hint: "Menor investimento" },
  { value: "equilibrio", label: "Equilíbrio", hint: "Melhor relação preço/produção" },
  { value: "eficiencia", label: "Eficiência", hint: "Mais produção, menos área" }
];

const STEPS = ["Consumo", "Localização e telhado", "Objetivo", "Económico"];

const inputClass =
  "w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-supaste-ink outline-none transition-colors focus:border-supaste-blue";

const pill = (active: boolean) =>
  `rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
    active
      ? "bg-supaste-black text-white"
      : "bg-supaste-section text-supaste-ink hover:bg-[#ececef]"
  }`;

export default function QuestionarioPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { ready } = useRequireAuth();
  const [q, setQ] = useState<Questionnaire>(DEFAULT_QUESTIONNAIRE);
  const [step, setStep] = useState(0);
  const [flyTo, setFlyTo] = useState<{ lon: number; lat: number } | null>(null);
  const [billBusy, setBillBusy] = useState(false);
  const [billNote, setBillNote] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const token = await user.getIdToken();
        const existing = await getMyQuestionnaire(token);
        if (existing && !cancelled) setQ({ ...DEFAULT_QUESTIONNAIRE, ...existing });
      } catch {
        // sem dados anteriores — começa do zero
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const set = <K extends keyof Questionnaire>(key: K, value: Questionnaire[K]) =>
    setQ(prev => ({ ...prev, [key]: value }));

  const handlePolygon = (area: number, centroid: { lat: number; lon: number }) => {
    set("available_area_m2", Math.round(area * 100) / 100);
    if (area > 0) {
      setQ(prev => ({ ...prev, latitude: centroid.lat, longitude: centroid.lon }));
    }
  };

  const handleLocation = (lon: number, lat: number) => {
    setFlyTo({ lon, lat });
    setQ(prev => ({ ...prev, latitude: lat, longitude: lon }));
  };

  const handleBill = async (file: File) => {
    if (!user) return;
    setBillBusy(true);
    setBillNote(null);
    try {
      const token = await user.getIdToken();
      const ex = await uploadBill(token, file);
      setQ(prev => {
        const next = { ...prev, bill_filename: file.name };
        if (ex.annual_consumption_kwh) {
          next.consumption_period = "anual";
          next.consumption_kwh = ex.annual_consumption_kwh;
        } else if (ex.monthly_consumption_kwh) {
          next.consumption_period = "mensal";
          next.consumption_kwh = ex.monthly_consumption_kwh;
        }
        if (ex.price_eur_kwh) next.electricity_price_eur_kwh = ex.price_eur_kwh;
        if (ex.has_social_tariff != null) next.has_social_tariff = ex.has_social_tariff;
        return next;
      });
      setBillNote(
        ex.confidence > 0
          ? `Fatura lida (confiança ${(ex.confidence * 100).toFixed(0)}%). Reveja os valores.`
          : "Não foi possível ler a fatura automaticamente. Introduza os valores."
      );
    } catch {
      setBillNote("Falha ao processar a fatura. Introduza os valores manualmente.");
    } finally {
      setBillBusy(false);
    }
  };

  const submit = async () => {
    if (!user) return;
    setSubmitting(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      await runSimulation(token, q);
      router.push("/ideais");
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setError(typeof detail === "string" ? detail : "Não foi possível calcular. Tente novamente.");
      setSubmitting(false);
    }
  };

  if (!ready) return <AuthChecking />;

  const canNext = step !== 0 || (q.consumption_kwh > 0 && Number.isFinite(q.consumption_kwh));

  return (
    <main className="min-h-screen bg-supaste-mist text-supaste-ink">
      <header className="px-4 pt-5">
        <nav className="supaste-glass-strong mx-auto flex max-w-3xl items-center justify-between rounded-full px-4 py-2.5">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/images/reisolari-logo.jpeg" alt="Reisolari" width={30} height={30} className="rounded-full" />
            <span className="font-display text-base font-semibold tracking-tight">Reisolari</span>
          </Link>
          <Link href="/conta" className="text-sm font-medium text-supaste-muted transition-colors hover:text-supaste-ink">
            A minha conta
          </Link>
        </nav>
      </header>

      <div className="mx-auto max-w-3xl px-6 py-10 space-y-7">
        <div className="space-y-2 text-center">
          <h1 className="font-display text-3xl font-semibold tracking-tight">Simulador solar</h1>
          <p className="text-sm text-supaste-muted">
            Responda a este questionário rápido para receber as suas propostas ideais.
          </p>
        </div>

        {/* Stepper */}
        <ol className="flex flex-wrap justify-center gap-2">
          {STEPS.map((label, i) => (
            <li
              key={label}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                i === step
                  ? "bg-supaste-black text-white"
                  : i < step
                  ? "bg-white text-supaste-blue shadow-soft-float"
                  : "bg-white text-supaste-muted"
              }`}
            >
              {i + 1}. {label}
            </li>
          ))}
        </ol>

        <section className="rounded-[28px] bg-white p-7 shadow-soft-float">
          {/* Step 0 — Consumo + fatura */}
          {step === 0 ? (
            <div className="space-y-5">
              <div className="rounded-2xl border border-dashed border-black/10 bg-supaste-section p-5 space-y-2">
                <div className="text-sm font-semibold">Fatura de luz (opcional)</div>
                <p className="text-xs text-supaste-muted">
                  Envie a sua fatura (PDF ou foto) e tentamos ler o consumo automaticamente.
                </p>
                <label className="inline-flex cursor-pointer items-center rounded-full bg-supaste-black px-4 py-2 text-xs font-semibold text-white">
                  {billBusy ? "A analisar…" : "Carregar fatura"}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,application/pdf"
                    className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) handleBill(file);
                      e.target.value = "";
                    }}
                  />
                </label>
                {billNote ? <p className="text-xs font-medium text-supaste-blue">{billNote}</p> : null}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-1.5 text-sm font-medium">
                  Consumo
                  <input
                    type="number"
                    min={0}
                    value={q.consumption_kwh}
                    onChange={e => set("consumption_kwh", parseFloat(e.target.value) || 0)}
                    className={inputClass}
                  />
                </label>
                <label className="flex flex-col gap-1.5 text-sm font-medium">
                  Período
                  <select
                    value={q.consumption_period}
                    onChange={e => set("consumption_period", e.target.value as "anual" | "mensal")}
                    className={inputClass}
                  >
                    <option value="anual">Anual (kWh/ano)</option>
                    <option value="mensal">Mensal (kWh/mês)</option>
                  </select>
                </label>
              </div>
              <p className="text-xs text-supaste-muted">
                Dica: numa habitação típica em Portugal, o consumo anual ronda 2500–5000 kWh.
              </p>
            </div>
          ) : null}

          {/* Step 1 — Localização e telhado */}
          {step === 1 ? (
            <div className="space-y-4">
              <label className="flex flex-col gap-1.5 text-sm font-medium">
                Região
                <select
                  value={q.region}
                  onChange={e => set("region", e.target.value as Region)}
                  className={inputClass}
                >
                  {REGIONS.map(r => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </label>

              <div className="space-y-1.5">
                <span className="text-sm font-medium">Onde fica a sua casa?</span>
                <LocationSearch onSelect={handleLocation} />
              </div>

              <p className="text-xs text-supaste-muted">
                Pesquise a morada, depois desenhe o contorno do telhado no mapa para calcular a área.
              </p>
              <div className="mapbox-supaste overflow-hidden rounded-[22px]">
                <MapSolar onPolygonChange={handlePolygon} flyTo={flyTo} />
              </div>
              <div className="text-sm text-supaste-ink">
                Área do telhado selecionada:{" "}
                <span className="font-mono text-supaste-blue">{q.available_area_m2.toFixed(1)} m²</span>
                {q.latitude && q.longitude ? (
                  <span className="text-supaste-muted">
                    {" "}
                    · {q.latitude.toFixed(4)}, {q.longitude.toFixed(4)}
                  </span>
                ) : null}
              </div>
            </div>
          ) : null}

          {/* Step 2 — Objetivo */}
          {step === 2 ? (
            <div className="space-y-5">
              <div className="space-y-2">
                <span className="text-sm font-medium">Tipo de utilização</span>
                <div className="flex gap-2">
                  {(["habitacao", "empresa"] as const).map(t => (
                    <button key={t} type="button" onClick={() => set("usage_type", t)} className={pill(q.usage_type === t)}>
                      {t === "habitacao" ? "Habitação" : "Empresa"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-sm font-medium">Autossuficiência pretendida</span>
                <div className="flex flex-wrap gap-2">
                  {COVERAGES.map(c => (
                    <button key={c} type="button" onClick={() => set("coverage", c)} className={pill(q.coverage === c)}>
                      {(c * 100).toFixed(0)}%
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-sm font-medium">O que é mais importante para si?</span>
                <div className="grid gap-2 sm:grid-cols-3">
                  {PRIORITIES.map(p => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => set("priority", p.value)}
                      className={`rounded-2xl border p-4 text-left transition-colors ${
                        q.priority === p.value
                          ? "border-supaste-blue bg-white shadow-soft-float"
                          : "border-black/10 bg-supaste-section"
                      }`}
                    >
                      <div className="text-sm font-semibold">{p.label}</div>
                      <div className="text-xs text-supaste-muted">{p.hint}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {/* Step 3 — Económico */}
          {step === 3 ? (
            <div className="space-y-5">
              <label className="flex flex-col gap-1.5 text-sm font-medium">
                Preço da eletricidade (€/kWh)
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={q.electricity_price_eur_kwh}
                  onChange={e => set("electricity_price_eur_kwh", parseFloat(e.target.value) || 0)}
                  className={inputClass}
                />
              </label>

              <label className="flex items-center gap-2.5 text-sm">
                <input
                  type="checkbox"
                  checked={q.has_social_tariff}
                  onChange={e => set("has_social_tariff", e.target.checked)}
                  className="h-4 w-4 accent-supaste-blue"
                />
                Tenho Tarifa Social de Energia
              </label>

              <label className="flex items-center gap-2.5 text-sm">
                <input
                  type="checkbox"
                  checked={q.wants_battery}
                  onChange={e => set("wants_battery", e.target.checked)}
                  className="h-4 w-4 accent-supaste-blue"
                />
                Pretendo incluir bateria
              </label>

              {q.wants_battery ? (
                <label className="flex flex-col gap-1.5 text-sm font-medium">
                  Custo estimado da bateria (€)
                  <input
                    type="number"
                    min={0}
                    step={100}
                    value={q.battery_cost_eur}
                    onChange={e => set("battery_cost_eur", parseFloat(e.target.value) || 0)}
                    className={inputClass}
                  />
                </label>
              ) : null}

              {error ? (
                <div className="rounded-2xl bg-[#fdecec] px-4 py-3 text-sm text-[#b42318]">{error}</div>
              ) : null}
            </div>
          ) : null}
        </section>

        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setStep(s => Math.max(0, s - 1))}
            disabled={step === 0}
            className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-supaste-ink shadow-soft-float disabled:opacity-40"
          >
            Anterior
          </button>

          {step < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={() => setStep(s => Math.min(STEPS.length - 1, s + 1))}
              disabled={!canNext}
              className="supaste-button rounded-full bg-supaste-black px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              Seguinte
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={submitting}
              className="supaste-button rounded-full bg-supaste-black px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {submitting ? "A calcular…" : "Calcular propostas ideais"}
            </button>
          )}
        </div>
      </div>
    </main>
  );
}

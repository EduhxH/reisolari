"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { useAuth } from "@/lib/auth";
import { fetchCategoryTree, type CategoryNode } from "@/lib/api";
import { deleteDraft, getDraft, saveDraft } from "@/lib/seller";
import {
  CONDITIONS,
  LISTING_TYPES,
  STEPS,
  defaultAdForm,
  stepSchemas,
  validateStep,
  type AdForm
} from "@/lib/adWizard";

const DRAFT_KEY = "reisolari_ad_draft";
const inputClass =
  "w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-600";

type LeafOption = { id: string; root: string; name: string; label: string };

function collectLeaves(node: CategoryNode, root: string): LeafOption[] {
  if (node.leaf) {
    return [{ id: node.id, root, name: node.name, label: `${root} › ${node.name}` }];
  }
  return node.children.flatMap(child => collectLeaves(child, root));
}

export default function AnunciarPage() {
  const { user, loading: authLoading } = useAuth();
  const form = useForm<AdForm>({ defaultValues: defaultAdForm, mode: "onChange" });
  const { register, watch, setValue, reset, getValues } = form;

  const [step, setStep] = useState(0);
  const [showErrors, setShowErrors] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [tree, setTree] = useState<CategoryNode[]>([]);

  const values = watch();
  const serialized = JSON.stringify(values);

  const leafOptions = useMemo<LeafOption[]>(
    () => tree.flatMap(root => collectLeaves(root, root.name)),
    [tree]
  );

  // Load taxonomy for the (skeleton) category picker.
  useEffect(() => {
    fetchCategoryTree().then(setTree).catch(() => setTree([]));
  }, []);

  // Restore draft once auth state is known: prefer server, fall back to localStorage.
  useEffect(() => {
    if (authLoading || loaded) return;
    let cancelled = false;
    (async () => {
      let restored: { step: number; data: AdForm } | null = null;
      if (user) {
        try {
          const token = await user.getIdToken();
          const remote = await getDraft(token);
          if (remote) restored = { step: remote.step, data: { ...defaultAdForm, ...remote.data } };
        } catch {
          // fall through to localStorage
        }
      }
      if (!restored) {
        try {
          const raw = localStorage.getItem(DRAFT_KEY);
          if (raw) {
            const parsed = JSON.parse(raw);
            restored = { step: parsed.step ?? 0, data: { ...defaultAdForm, ...(parsed.data || {}) } };
          }
        } catch {
          // ignore corrupt draft
        }
      }
      if (!cancelled && restored) {
        reset(restored.data);
        setStep(Math.min(Math.max(restored.step, 0), STEPS.length - 1));
      }
      if (!cancelled) setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [authLoading, loaded, user, reset]);

  // Debounced autosave: localStorage always, server when authenticated.
  useEffect(() => {
    if (!loaded) return;
    const handle = setTimeout(async () => {
      const snapshot = getValues();
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ step, data: snapshot }));
      } catch {
        // storage unavailable
      }
      if (user) {
        try {
          const token = await user.getIdToken();
          await saveDraft(token, step, snapshot);
          setSavedAt(new Date().toLocaleTimeString("pt-PT"));
        } catch {
          // keep local copy only
        }
      } else {
        setSavedAt(new Date().toLocaleTimeString("pt-PT") + " (local)");
      }
    }, 800);
    return () => clearTimeout(handle);
  }, [serialized, step, loaded, user, getValues]);

  const goStep = (target: number) => {
    const clamped = Math.max(0, Math.min(target, STEPS.length - 1));
    setStep(clamped);
    setShowErrors(false);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("step", String(clamped));
      window.history.replaceState(null, "", url.toString());
    } catch {
      // ignore
    }
  };

  const { errors: stepErrors } = validateStep(step, values);
  const allValid = stepSchemas.every((_, index) => validateStep(index, values).valid);

  const next = () => {
    const { valid } = validateStep(step, getValues());
    if (!valid) {
      setShowErrors(true);
      return;
    }
    goStep(step + 1);
  };

  const clearDraft = async () => {
    reset(defaultAdForm);
    setStep(0);
    setShowErrors(false);
    setDone(false);
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      // ignore
    }
    if (user) {
      try {
        const token = await user.getIdToken();
        await deleteDraft(token);
      } catch {
        // ignore
      }
    }
  };

  const finish = () => {
    if (!allValid) {
      setShowErrors(true);
      return;
    }
    setDone(true);
  };

  const err = (field: keyof AdForm) =>
    showErrors && stepErrors[field] ? (
      <p className="text-[11px] text-red-300 mt-1">{stepErrors[field]}</p>
    ) : null;

  return (
    <main className="min-h-screen bg-bg text-slate-100 p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <header className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Criar anúncio</h1>
            <p className="text-sm text-slate-400">
              {user
                ? "Rascunho guardado na sua conta."
                : "A guardar rascunho neste dispositivo. Inicie sessão para sincronizar."}
            </p>
          </div>
          <Link href="/marketplace" className="text-xs font-semibold text-slate-300 hover:text-emerald-300">
            ← Marketplace
          </Link>
        </header>

        {/* Step indicator */}
        <ol className="flex items-center justify-between gap-1">
          {STEPS.map((meta, index) => {
            const state = index === step ? "current" : index < step ? "done" : "todo";
            return (
              <li key={meta.key} className="flex-1 flex flex-col items-center gap-1">
                <button
                  onClick={() => index <= step && goStep(index)}
                  className={`h-7 w-7 rounded-full grid place-items-center text-xs font-bold transition-colors ${
                    state === "current"
                      ? "bg-emerald-500 text-slate-950"
                      : state === "done"
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                      : "bg-slate-900 text-slate-500 border border-slate-800"
                  }`}
                >
                  {index < step ? "✓" : index + 1}
                </button>
                <span
                  className={`text-[10px] text-center ${
                    index === step ? "text-emerald-300" : "text-slate-500"
                  }`}
                >
                  {meta.label}
                </span>
              </li>
            );
          })}
        </ol>

        <section className="rounded-xl border border-slate-800 bg-card p-5 space-y-4 min-h-[280px]">
          {/* Step 1 — Categoria */}
          {step === 0 ? (
            <div className="space-y-4">
              <div>
                <label className="text-xs text-slate-400">Título do anúncio</label>
                <input
                  {...register("title")}
                  maxLength={60}
                  className={inputClass}
                  placeholder="Ex.: Painel Jinko 440W monocristalino, como novo"
                />
                <div className="flex justify-between mt-1">
                  {err("title") ?? <span />}
                  <span className="text-[10px] text-slate-500">
                    {(values.title?.length ?? 0)}/60
                  </span>
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-400">Categoria</label>
                <select
                  value={values.category_id}
                  onChange={event => {
                    const option = leafOptions.find(item => item.id === event.target.value);
                    setValue("category_id", event.target.value, { shouldDirty: true });
                    setValue("category_label", option?.label ?? "", { shouldDirty: true });
                  }}
                  className={`${inputClass} cursor-pointer`}
                >
                  <option value="">Selecione…</option>
                  {tree.map(root => (
                    <optgroup key={root.id} label={root.name}>
                      {collectLeaves(root, root.name).map(leaf => (
                        <option key={leaf.id} value={leaf.id}>
                          {leaf.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                {err("category_id")}
                <p className="text-[11px] text-slate-500 mt-1">
                  Fase 3: sugestão automática pelo título + seletor em cascata.
                </p>
              </div>
            </div>
          ) : null}

          {/* Step 2 — Ficha técnica */}
          {step === 1 ? (
            <div className="space-y-4">
              <div>
                <span className="text-xs text-slate-400">Condição do artigo</span>
                <div className="grid sm:grid-cols-2 gap-2 mt-1.5">
                  {CONDITIONS.map(option => (
                    <label
                      key={option.value}
                      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer ${
                        values.condition === option.value
                          ? "border-emerald-600 bg-emerald-500/10 text-emerald-200"
                          : "border-slate-700 text-slate-300"
                      }`}
                    >
                      <input type="radio" value={option.value} {...register("condition")} className="accent-emerald-500" />
                      {option.label}
                    </label>
                  ))}
                </div>
                {err("condition")}
              </div>
              <div>
                <label className="text-xs text-slate-400">Descrição</label>
                <textarea
                  {...register("description")}
                  rows={4}
                  maxLength={4000}
                  className={inputClass}
                  placeholder="Estado, histórico de uso, motivo da venda, garantia restante…"
                />
                {err("description")}
              </div>
              <p className="text-[11px] text-slate-500">
                Fase 3: ficha técnica dinâmica (marca, potência, etc.) conforme a categoria escolhida.
              </p>
            </div>
          ) : null}

          {/* Step 3 — Galeria */}
          {step === 2 ? (
            <div className="space-y-3">
              <div className="rounded-lg border border-dashed border-slate-700 p-8 text-center text-sm text-slate-400">
                Galeria de imagens (drag-and-drop, compressão e reordenação)
                <div className="text-[11px] text-slate-500 mt-1">
                  Pipeline de upload chega na Fase 4. Pode avançar por agora.
                </div>
              </div>
            </div>
          ) : null}

          {/* Step 4 — Preço & plano */}
          {step === 3 ? (
            <div className="space-y-4">
              <div>
                <span className="text-xs text-slate-400">Tipo de anúncio</span>
                <div className="grid sm:grid-cols-2 gap-2 mt-1.5">
                  {LISTING_TYPES.map(option => (
                    <label
                      key={option.value}
                      className={`flex flex-col gap-0.5 rounded-lg border px-3 py-2 cursor-pointer ${
                        values.listing_type === option.value
                          ? "border-emerald-600 bg-emerald-500/10"
                          : "border-slate-700"
                      }`}
                    >
                      <span className="flex items-center gap-2 text-sm text-slate-200">
                        <input type="radio" value={option.value} {...register("listing_type")} className="accent-emerald-500" />
                        {option.label}
                      </span>
                      <span className="text-[10px] text-slate-500 pl-5">{option.hint}</span>
                    </label>
                  ))}
                </div>
                {err("listing_type")}
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-400">Preço (€)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    {...register("price_eur", { valueAsNumber: true })}
                    className={inputClass}
                    placeholder="0,00"
                  />
                  {err("price_eur")}
                </div>
                <div>
                  <label className="text-xs text-slate-400">Quantidade</label>
                  <input
                    type="number"
                    min="1"
                    {...register("stock", { valueAsNumber: true })}
                    className={inputClass}
                  />
                  {err("stock")}
                </div>
              </div>
              <p className="text-[11px] text-slate-500">
                Fase 5: máscara de moeda e regras de exposição por plano.
              </p>
            </div>
          ) : null}

          {/* Step 5 — Logística */}
          {step === 4 ? (
            <div className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-400">Código postal</label>
                  <input {...register("postal_code")} className={inputClass} placeholder="1000-100" />
                  {err("postal_code")}
                </div>
                <div>
                  <label className="text-xs text-slate-400">Localidade</label>
                  <input {...register("city")} className={inputClass} placeholder="Lisboa" />
                  {err("city")}
                </div>
              </div>
              <div className="space-y-2">
                <span className="text-xs text-slate-400">Métodos de entrega</span>
                <label className="flex items-center gap-2 text-sm text-slate-300">
                  <input type="checkbox" {...register("pickup")} className="accent-emerald-500" />
                  Entrega em mãos / ponto de encontro
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-300">
                  <input type="checkbox" {...register("shipping")} className="accent-emerald-500" />
                  Envio por transportadora (CTT)
                </label>
              </div>
              <p className="text-[11px] text-slate-500">
                Fase 5: preenchimento automático do bairro/cidade pelo código postal (Mapbox) e só Bairro/Cidade ficam públicos.
              </p>
            </div>
          ) : null}
        </section>

        {/* Footer / nav */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => goStep(step - 1)}
              disabled={step === 0}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-300 bg-slate-900 border border-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Anterior
            </button>
            <button onClick={clearDraft} className="text-[11px] text-slate-500 hover:text-red-400">
              Limpar rascunho
            </button>
          </div>

          <div className="flex items-center gap-3">
            {savedAt ? (
              <span className="text-[10px] text-slate-500">Guardado às {savedAt}</span>
            ) : null}
            {step < STEPS.length - 1 ? (
              <button
                onClick={next}
                className="px-5 py-2 rounded-lg text-sm font-semibold text-slate-950 bg-emerald-500 hover:bg-emerald-400 transition-colors"
              >
                Próximo
              </button>
            ) : (
              <button
                onClick={finish}
                disabled={!allValid}
                className="px-5 py-2 rounded-lg text-sm font-semibold text-slate-950 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Concluir rascunho
              </button>
            )}
          </div>
        </div>

        {done ? (
          <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm text-emerald-200">
            Rascunho completo e válido. A publicação real do anúncio (POST do anúncio,
            sanitização e exibição no marketplace) chega na Fase 6.
          </div>
        ) : null}
      </div>
    </main>
  );
}

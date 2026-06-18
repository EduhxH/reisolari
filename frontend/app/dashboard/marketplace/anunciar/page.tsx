"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { useAuth } from "@/lib/auth";
import {
  MAX_IMAGES,
  compressToWebp,
  uploadImage,
  deleteImage
} from "@/lib/imageUpload";
import {
  fetchCategoryTree,
  fetchCategorySuggestions,
  fetchCategoryAttributes,
  type CategoryNode,
  type CategorySuggestion,
  type AttributeSchema
} from "@/lib/api";
import { deleteDraft, getDraft, publishListing, saveDraft } from "@/lib/seller";
import {
  CONDITIONS,
  LISTING_TYPES,
  STEPS,
  defaultAdForm,
  stepSchemas,
  validateStep,
  validateAttributes,
  euroToDisplay,
  displayToEuro,
  adFormToListingPayload,
  LISTING_FIELD_STEP,
  type AdForm
} from "@/lib/adWizard";
import { lookupPostalCode } from "@/lib/geocoding";
import { useRequireAuth, AuthChecking } from "@/lib/useRequireAuth";

const DRAFT_KEY = "reisolari_ad_draft";
const inputClass =
  "w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-600";

/** Chain of nodes from a root down to the category with `id` (inclusive). */
function findPath(
  nodes: CategoryNode[],
  id: string,
  trail: CategoryNode[] = []
): CategoryNode[] | null {
  for (const node of nodes) {
    const next = [...trail, node];
    if (node.id === id) return next;
    const found = node.children?.length ? findPath(node.children, id, next) : null;
    if (found) return found;
  }
  return null;
}

/**
 * Turn the selected-id chain into the list of cascading selects to render.
 * Each level exposes its sibling options and the currently-selected value; the
 * next level only appears once a non-leaf is chosen.
 */
function buildCascadeLevels(
  tree: CategoryNode[],
  cascade: string[]
): { options: CategoryNode[]; value: string }[] {
  const levels: { options: CategoryNode[]; value: string }[] = [];
  let nodes = tree;
  let depth = 0;
  while (nodes.length > 0) {
    const value = cascade[depth] ?? "";
    levels.push({ options: nodes, value });
    const selected = nodes.find(node => node.id === value);
    if (!selected || selected.leaf || !selected.children?.length) break;
    nodes = selected.children;
    depth += 1;
  }
  return levels;
}

export default function AnunciarPage() {
  const { user, loading: authLoading } = useAuth();
  const { ready } = useRequireAuth();
  const form = useForm<AdForm>({ defaultValues: defaultAdForm, mode: "onChange" });
  const { register, watch, setValue, reset, getValues } = form;

  const [step, setStep] = useState(0);
  const [showErrors, setShowErrors] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [tree, setTree] = useState<CategoryNode[]>([]);
  const [cascade, setCascade] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<CategorySuggestion[]>([]);
  const [attrSchema, setAttrSchema] = useState<AttributeSchema | null>(null);
  const [attrLoading, setAttrLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const dragIndex = useRef<number | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoInfo, setGeoInfo] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishedId, setPublishedId] = useState<string | null>(null);

  const values = watch();
  const serialized = JSON.stringify(values);

  // Load taxonomy for the cascading category picker.
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

  // Sync the cascade selects from a restored/external category_id (runs once the
  // tree is available and no cascade has been built yet).
  useEffect(() => {
    if (tree.length === 0 || cascade.length > 0) return;
    if (values.category_id) {
      const path = findPath(tree, values.category_id);
      if (path) setCascade(path.map(node => node.id));
    }
  }, [tree, values.category_id, cascade.length]);

  // Etapa 1 — debounced NLP suggestions from the title.
  useEffect(() => {
    if (step !== 0) return;
    const title = (values.title || "").trim();
    if (title.length < 3) {
      setSuggestions([]);
      return;
    }
    const handle = setTimeout(() => {
      fetchCategorySuggestions(title).then(setSuggestions).catch(() => setSuggestions([]));
    }, 400);
    return () => clearTimeout(handle);
  }, [values.title, step]);

  // Etapa 2 — load the dynamic attribute schema for the chosen leaf category.
  useEffect(() => {
    const categoryId = values.category_id;
    if (!categoryId) {
      setAttrSchema(null);
      return;
    }
    let cancelled = false;
    setAttrLoading(true);
    fetchCategoryAttributes(categoryId)
      .then(schema => {
        if (!cancelled) setAttrSchema(schema);
      })
      .finally(() => {
        if (!cancelled) setAttrLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [values.category_id]);

  // Etapa 5 — debounced postal-code -> locality autofill (real Mapbox geocoding).
  useEffect(() => {
    if (step !== 4) return;
    const code = (values.postal_code || "").trim();
    if (!/^\d{4}-\d{3}$/.test(code)) {
      setGeoInfo(null);
      return;
    }
    let cancelled = false;
    setGeoLoading(true);
    setGeoInfo(null);
    const handle = setTimeout(async () => {
      const result = await lookupPostalCode(code);
      if (cancelled) return;
      setGeoLoading(false);
      if (!result) {
        setGeoInfo("Código postal não encontrado — preencha a localidade manualmente.");
        return;
      }
      setValue("city", result.city, { shouldDirty: true });
      if (result.center) {
        setValue("lon", result.center[0], { shouldDirty: true });
        setValue("lat", result.center[1], { shouldDirty: true });
      }
      setGeoInfo(`${result.city}${result.region ? `, ${result.region}` : ""}`);
    }, 600);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [values.postal_code, step, setValue]);

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

  const cascadeLevels = buildCascadeLevels(tree, cascade);
  const attrErrors = attrSchema ? validateAttributes(attrSchema.fields, values.attributes) : {};

  /** Set the category (id + breadcrumb label + cascade) from a leaf id. */
  const applyCategory = (id: string) => {
    const path = findPath(tree, id);
    if (!path) return;
    setCascade(path.map(node => node.id));
    setValue("category_id", id, { shouldDirty: true });
    setValue("category_label", path.map(node => node.name).join(" › "), { shouldDirty: true });
  };

  const onCascadeChange = (level: number, id: string) => {
    const next = cascade.slice(0, level);
    if (id) next[level] = id;
    setCascade(next);
    const levelOptions = buildCascadeLevels(tree, next)[level]?.options ?? [];
    const node = levelOptions.find(item => item.id === id);
    if (node && node.leaf) {
      const labels = (findPath(tree, node.id) ?? [node]).map(item => item.name);
      setValue("category_id", node.id, { shouldDirty: true });
      setValue("category_label", labels.join(" › "), { shouldDirty: true });
    } else {
      setValue("category_id", "", { shouldDirty: true });
      setValue("category_label", "", { shouldDirty: true });
    }
  };

  const setAttr = (key: string, value: string | number | undefined) => {
    setValue(
      "attributes",
      { ...(getValues("attributes") || {}), [key]: value },
      { shouldDirty: true }
    );
  };

  // Etapa 3 — validate + compress (Canvas) + upload each picked image.
  const addFiles = async (files: FileList | File[]) => {
    const incoming = Array.from(files);
    if (incoming.length === 0) return;
    setImageError(null);
    const room = MAX_IMAGES - getValues("images").length;
    if (room <= 0) {
      setImageError(`Máximo de ${MAX_IMAGES} fotos atingido.`);
      return;
    }
    setUploading(true);
    const token = user ? await user.getIdToken().catch(() => null) : null;
    for (const file of incoming.slice(0, room)) {
      try {
        const blob = await compressToWebp(file);
        const uploaded = await uploadImage(blob, token);
        setValue("images", [...getValues("images"), uploaded.url], { shouldDirty: true });
      } catch (error: any) {
        setImageError(
          error?.response?.data?.detail || error?.message || "Falha ao enviar a imagem."
        );
      }
    }
    setUploading(false);
  };

  const removeImage = async (index: number) => {
    const current = getValues("images");
    const url = current[index];
    setValue(
      "images",
      current.filter((_, i) => i !== index),
      { shouldDirty: true }
    );
    if (url) {
      const token = user ? await user.getIdToken().catch(() => null) : null;
      deleteImage(url, token).catch(() => undefined);
    }
  };

  const moveImage = (from: number, to: number) => {
    const images = [...getValues("images")];
    const [moved] = images.splice(from, 1);
    images.splice(to, 0, moved);
    setValue("images", images, { shouldDirty: true });
  };

  // Step validity: Zod per step, plus dynamic required-attribute checks on Etapa 2.
  const stepIsValid = (index: number, snapshot: AdForm): boolean => {
    if (!validateStep(index, snapshot).valid) return false;
    if (index === 1 && attrSchema) {
      return Object.keys(validateAttributes(attrSchema.fields, snapshot.attributes)).length === 0;
    }
    return true;
  };

  const { errors: stepErrors } = validateStep(step, values);
  const allValid = stepSchemas.every((_, index) => stepIsValid(index, values));

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

  const next = () => {
    if (!stepIsValid(step, getValues())) {
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
    setCascade([]);
    setSuggestions([]);
    setAttrSchema(null);
    setImageError(null);
    setGeoInfo(null);
    setPublishError(null);
    setPublishedId(null);
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

  const finish = async () => {
    if (!allValid) {
      setShowErrors(true);
      return;
    }
    if (!user) {
      setPublishError("Inicie sessão para publicar o anúncio.");
      return;
    }
    setPublishing(true);
    setPublishError(null);
    try {
      const token = await user.getIdToken();
      const created = await publishListing(token, adFormToListingPayload(getValues()));
      // Listing is live — drop the draft (local + server).
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {
        // ignore
      }
      await deleteDraft(token).catch(() => undefined);
      setPublishedId(created.id);
      setDone(true);
    } catch (error: any) {
      const status = error?.response?.status;
      const detail = error?.response?.data?.detail;
      if (status === 422 && Array.isArray(detail)) {
        const issue = detail.find((item: any) => {
          const field = item?.loc?.[item.loc.length - 1];
          return typeof field === "string" && field in LISTING_FIELD_STEP;
        });
        if (issue) {
          const field = issue.loc[issue.loc.length - 1] as string;
          goStep(LISTING_FIELD_STEP[field]);
          setShowErrors(true);
          setPublishError(`Campo inválido: ${field} — ${issue.msg}`);
        } else {
          setPublishError("Há campos inválidos. Reveja o formulário.");
        }
      } else if (status === 401) {
        setPublishError("Sessão expirada. Inicie sessão novamente para publicar.");
      } else {
        setPublishError(
          (typeof detail === "string" && detail) ||
            error?.message ||
            "Falha ao publicar o anúncio."
        );
      }
    } finally {
      setPublishing(false);
    }
  };

  const err = (field: keyof AdForm) =>
    showErrors && stepErrors[field] ? (
      <p className="text-[11px] text-red-300 mt-1">{stepErrors[field]}</p>
    ) : null;

  if (!ready) {
    return <AuthChecking />;
  }

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

              {/* Sugestões automáticas pelo título (NLP/keywords) */}
              {suggestions.length > 0 ? (
                <div className="space-y-1.5">
                  <span className="text-[11px] text-slate-400">Sugestões para o seu título</span>
                  <div className="flex flex-wrap gap-2">
                    {suggestions.map(suggestion => {
                      const active = suggestion.category_id === values.category_id;
                      return (
                        <button
                          key={suggestion.category_id}
                          type="button"
                          onClick={() => applyCategory(suggestion.category_id)}
                          className={`text-[11px] rounded-full px-3 py-1 border transition-colors ${
                            active
                              ? "bg-emerald-500 text-slate-950 border-emerald-500"
                              : "border-emerald-500/40 text-emerald-200 hover:bg-emerald-500/10"
                          }`}
                        >
                          {suggestion.path_labels.join(" › ")}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {/* Seletor em cascata */}
              <div className="space-y-2">
                <label className="text-xs text-slate-400">Categoria</label>
                {tree.length === 0 ? (
                  <p className="text-[11px] text-amber-300/80">
                    A carregar taxonomia… (verifique se o backend está acessível)
                  </p>
                ) : (
                  <div className="grid sm:grid-cols-2 gap-2">
                    {cascadeLevels.map((level, index) => (
                      <select
                        key={index}
                        value={level.value}
                        onChange={event => onCascadeChange(index, event.target.value)}
                        className={`${inputClass} cursor-pointer`}
                      >
                        <option value="">
                          {index === 0 ? "Categoria…" : "Subcategoria…"}
                        </option>
                        {level.options.map(option => (
                          <option key={option.id} value={option.id}>
                            {option.name}
                            {option.leaf ? "" : " ›"}
                          </option>
                        ))}
                      </select>
                    ))}
                  </div>
                )}
                {values.category_label ? (
                  <p className="text-[11px] text-emerald-300/80">{values.category_label}</p>
                ) : null}
                {err("category_id")}
              </div>
            </div>
          ) : null}

          {/* Step 2 — Ficha técnica */}
          {step === 1 ? (
            <div className="space-y-4">
              {values.category_label ? (
                <p className="text-[11px] text-slate-400">
                  Ficha técnica · <span className="text-emerald-300">{values.category_label}</span>
                </p>
              ) : null}
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

              {/* Atributos dinâmicos (esquema por categoria) */}
              {attrLoading ? (
                <p className="text-[11px] text-slate-500">A carregar ficha técnica…</p>
              ) : attrSchema && attrSchema.fields.length > 0 ? (
                <div className="grid sm:grid-cols-2 gap-3">
                  {attrSchema.fields.map(field => {
                    const value = values.attributes?.[field.key] ?? "";
                    const fieldError = showErrors ? attrErrors[field.key] : undefined;
                    return (
                      <div key={field.key} className={field.type === "select" ? "sm:col-span-1" : ""}>
                        <label className="text-xs text-slate-400">
                          {field.label}
                          {field.required ? <span className="text-red-300"> *</span> : null}
                          {field.unit ? <span className="text-slate-500"> ({field.unit})</span> : null}
                        </label>
                        {field.type === "select" ? (
                          <select
                            value={String(value)}
                            onChange={event => setAttr(field.key, event.target.value || undefined)}
                            className={`${inputClass} cursor-pointer`}
                          >
                            <option value="">Selecione…</option>
                            {(field.options ?? []).map(option => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        ) : field.type === "number" ? (
                          <input
                            type="number"
                            value={value === undefined || value === null ? "" : String(value)}
                            placeholder={field.placeholder ?? ""}
                            onChange={event =>
                              setAttr(
                                field.key,
                                event.target.value === "" ? undefined : Number(event.target.value)
                              )
                            }
                            className={inputClass}
                          />
                        ) : (
                          <input
                            type="text"
                            value={String(value)}
                            placeholder={field.placeholder ?? ""}
                            onChange={event => setAttr(field.key, event.target.value)}
                            className={inputClass}
                          />
                        )}
                        {fieldError ? (
                          <p className="text-[11px] text-red-300 mt-1">{fieldError}</p>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : !values.category_id ? (
                <p className="text-[11px] text-amber-300/80">
                  Escolha uma categoria na etapa anterior para ver a ficha técnica.
                </p>
              ) : null}

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
            </div>
          ) : null}

          {/* Step 3 — Galeria */}
          {step === 2 ? (
            <div className="space-y-3">
              <div
                onDragOver={event => {
                  event.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={event => {
                  event.preventDefault();
                  setDragOver(false);
                  addFiles(event.dataTransfer.files);
                }}
                className={`rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
                  dragOver ? "border-emerald-500 bg-emerald-500/5" : "border-slate-700"
                }`}
              >
                <p className="text-sm text-slate-300">
                  Arraste fotos para aqui ou{" "}
                  <label className="cursor-pointer text-emerald-300 hover:text-emerald-200 font-semibold">
                    escolha ficheiros
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      multiple
                      className="hidden"
                      onChange={event => {
                        if (event.target.files) addFiles(event.target.files);
                        event.target.value = "";
                      }}
                    />
                  </label>
                </p>
                <p className="text-[11px] text-slate-500 mt-2">
                  Até {MAX_IMAGES} fotos · WebP/PNG/JPEG · máx. 5MB · mín. 800×600px
                </p>
              </div>

              {uploading ? (
                <p className="text-[11px] text-emerald-300">A processar e enviar imagens…</p>
              ) : null}
              {imageError ? <p className="text-[11px] text-red-300">{imageError}</p> : null}
              {err("images")}

              {values.images.length > 0 ? (
                <>
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                    {values.images.map((url, index) => (
                      <div
                        key={url}
                        draggable
                        onDragStart={() => {
                          dragIndex.current = index;
                        }}
                        onDragOver={event => event.preventDefault()}
                        onDrop={() => {
                          if (dragIndex.current !== null && dragIndex.current !== index) {
                            moveImage(dragIndex.current, index);
                          }
                          dragIndex.current = null;
                        }}
                        className="relative group aspect-square rounded-lg overflow-hidden border border-slate-700 cursor-move"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt="" className="w-full h-full object-cover" />
                        {index === 0 ? (
                          <span className="absolute top-1 left-1 text-[9px] font-bold bg-emerald-500 text-slate-950 px-1.5 py-0.5 rounded">
                            Capa
                          </span>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => removeImage(index)}
                          className="absolute top-1 right-1 h-5 w-5 grid place-items-center rounded-full bg-black/60 text-white text-xs leading-none opacity-0 group-hover:opacity-100 transition-opacity"
                          aria-label="Remover foto"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Arraste as miniaturas para reordenar. A primeira foto é a capa do anúncio.
                  </p>
                </>
              ) : null}
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
                  <label className="text-xs text-slate-400">Preço</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">€</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={euroToDisplay(values.price_eur)}
                      onChange={event =>
                        setValue("price_eur", displayToEuro(event.target.value), { shouldDirty: true })
                      }
                      className={`${inputClass} pl-7 text-right`}
                      placeholder="0,00"
                    />
                  </div>
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
                Para venda casual entre particulares, mantenha a quantidade em 1.
              </p>
            </div>
          ) : null}

          {/* Step 5 — Logística */}
          {step === 4 ? (
            <div className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-400">Código postal</label>
                  <input
                    {...register("postal_code")}
                    className={inputClass}
                    placeholder="1000-100"
                    maxLength={8}
                  />
                  {geoLoading ? (
                    <p className="text-[11px] text-slate-500 mt-1">A localizar…</p>
                  ) : geoInfo ? (
                    <p className="text-[11px] text-emerald-300/80 mt-1">📍 {geoInfo}</p>
                  ) : null}
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
                🔒 Por privacidade, o anúncio público mostra apenas a localidade (
                {values.city || "ex.: Lisboa"}) — nunca a rua ou o número.
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
                disabled={!allValid || publishing}
                className="px-5 py-2 rounded-lg text-sm font-semibold text-slate-950 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {publishing ? "A publicar…" : "Publicar anúncio"}
              </button>
            )}
          </div>
        </div>

        {publishError ? (
          <div className="rounded-lg border border-red-500/40 bg-red-950/30 p-4 text-sm text-red-200">
            {publishError}
          </div>
        ) : null}

        {done && publishedId ? (
          <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm text-emerald-200 flex items-center justify-between gap-3">
            <span>Anúncio publicado com sucesso! 🎉</span>
            <Link
              href="/marketplace"
              className="font-semibold text-emerald-300 hover:text-emerald-200 whitespace-nowrap"
            >
              Ver no marketplace →
            </Link>
          </div>
        ) : null}
      </div>
    </main>
  );
}

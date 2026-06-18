"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { fetchCategoryAttributes, type AttributeField } from "@/lib/api";
import { CONDITIONS, euroToDisplay, displayToEuro } from "@/lib/adWizard";
import { compressToWebp, uploadImage, MAX_IMAGES } from "@/lib/imageUpload";
import { getListing, updateListing, type ListingDetail } from "@/lib/listings";
import { useRequireAuth, AuthChecking } from "@/lib/useRequireAuth";

const inputClass =
  "w-full mt-1 rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-600";

export default function EditarAnuncioPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const { user, loading: authLoading } = useAuth();
  const { ready } = useRequireAuth();
  const router = useRouter();

  const [listing, setListing] = useState<ListingDetail | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [fields, setFields] = useState<AttributeField[] | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [condition, setCondition] = useState("");
  const [priceEur, setPriceEur] = useState<number | null>(null);
  const [stock, setStock] = useState(1);
  const [pickup, setPickup] = useState(true);
  const [shipping, setShipping] = useState(false);
  const [attributes, setAttributes] = useState<Record<string, any>>({});
  const [images, setImages] = useState<string[]>([]);

  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getListing(id)
      .then(data => {
        if (cancelled) return;
        setListing(data);
        setTitle(data.title);
        setDescription(data.description);
        setCondition(data.condition);
        setPriceEur(data.price_cents / 100);
        setStock(data.stock);
        setPickup(data.delivery_pickup);
        setShipping(data.delivery_shipping);
        setAttributes(data.attributes || {});
        setImages(data.image_urls || []);
      })
      .catch(() => {
        if (!cancelled) setNotFound(true);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!listing?.category_id) return;
    let cancelled = false;
    fetchCategoryAttributes(listing.category_id)
      .then(schema => {
        if (!cancelled) setFields(schema?.fields ?? null);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [listing?.category_id]);

  const isOwner = !!user && !!listing && listing.owner_id === user.uid;

  const setAttr = (key: string, value: string | number | undefined) =>
    setAttributes(prev => ({ ...prev, [key]: value }));

  const addImage = async (file: File) => {
    if (images.length >= MAX_IMAGES) return;
    setUploading(true);
    setError(null);
    try {
      const token = await user!.getIdToken();
      const blob = await compressToWebp(file);
      const { url } = await uploadImage(blob, token);
      setImages(prev => [...prev, url]);
    } catch (err: any) {
      setError(err?.message || "Falha ao carregar a imagem.");
    } finally {
      setUploading(false);
    }
  };

  const valid = title.trim().length >= 3 && description.trim().length >= 10 && (priceEur ?? 0) > 0 && stock >= 1;

  const save = async () => {
    if (!user || !listing || !valid) return;
    setSaving(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      await updateListing(token, id, {
        title: title.trim(),
        description: description.trim(),
        condition,
        price_cents: Math.round((priceEur ?? 0) * 100),
        stock,
        delivery_pickup: pickup,
        delivery_shipping: shipping,
        attributes,
        image_urls: images
      });
      router.push(`/anuncio/${id}`);
    } catch (error: any) {
      const detail = error?.response?.data?.detail;
      setError(typeof detail === "string" ? detail : "Não foi possível guardar as alterações.");
      setSaving(false);
    }
  };

  if (notFound) {
    return (
      <main className="min-h-screen bg-bg text-slate-100 grid place-items-center p-6">
        <div className="text-center space-y-3">
          <p className="text-slate-300">Anúncio não encontrado.</p>
          <Link href="/marketplace" className="text-emerald-400 font-semibold">← Marketplace</Link>
        </div>
      </main>
    );
  }

  if (!ready) {
    return <AuthChecking />;
  }

  if (!listing || authLoading) {
    return (
      <main className="min-h-screen bg-bg text-slate-100 grid place-items-center p-6">
        <p className="text-sm text-slate-400">A carregar…</p>
      </main>
    );
  }

  if (!isOwner) {
    return (
      <main className="min-h-screen bg-bg text-slate-100 grid place-items-center p-6">
        <div className="text-center space-y-3">
          <p className="text-slate-300">Só o autor do anúncio o pode editar.</p>
          <Link href={`/anuncio/${id}`} className="text-emerald-400 font-semibold">Ver anúncio</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-bg text-slate-100 p-6">
      <div className="max-w-2xl mx-auto space-y-5">
        <header className="flex items-center justify-between border-b border-slate-800 pb-4">
          <h1 className="text-2xl font-bold text-white">Editar anúncio</h1>
          <Link href={`/anuncio/${id}`} className="text-xs font-semibold text-slate-300 hover:text-emerald-300">
            Cancelar
          </Link>
        </header>

        <div>
          <label className="text-xs text-slate-400">Título</label>
          <input value={title} onChange={e => setTitle(e.target.value)} maxLength={120} className={inputClass} />
        </div>

        <div>
          <label className="text-xs text-slate-400">Descrição</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={4} maxLength={4000} className={inputClass} />
        </div>

        <div>
          <span className="text-xs text-slate-400">Condição</span>
          <div className="grid sm:grid-cols-2 gap-2 mt-1.5">
            {CONDITIONS.map(option => (
              <label
                key={option.value}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer ${
                  condition === option.value ? "border-emerald-600 bg-emerald-500/10 text-emerald-200" : "border-slate-700 text-slate-300"
                }`}
              >
                <input type="radio" checked={condition === option.value} onChange={() => setCondition(option.value)} className="accent-emerald-500" />
                {option.label}
              </label>
            ))}
          </div>
        </div>

        {fields && fields.length > 0 ? (
          <div>
            <span className="text-xs text-slate-400">Ficha técnica</span>
            <div className="grid sm:grid-cols-2 gap-3 mt-1.5">
              {fields.map(field => {
                const value = attributes?.[field.key] ?? "";
                return (
                  <div key={field.key}>
                    <label className="text-[11px] text-slate-400">
                      {field.label}
                      {field.unit ? <span className="text-slate-500"> ({field.unit})</span> : null}
                    </label>
                    {field.type === "select" ? (
                      <select value={String(value)} onChange={e => setAttr(field.key, e.target.value || undefined)} className={inputClass}>
                        <option value="">Selecione…</option>
                        {(field.options ?? []).map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : field.type === "number" ? (
                      <input
                        type="number"
                        value={value === undefined || value === null ? "" : String(value)}
                        onChange={e => setAttr(field.key, e.target.value === "" ? undefined : Number(e.target.value))}
                        className={inputClass}
                      />
                    ) : (
                      <input type="text" value={String(value)} onChange={e => setAttr(field.key, e.target.value)} className={inputClass} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-slate-400">Preço</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">€</span>
              <input
                type="text"
                inputMode="numeric"
                value={euroToDisplay(priceEur)}
                onChange={e => setPriceEur(displayToEuro(e.target.value))}
                className={`${inputClass} pl-7 text-right`}
                placeholder="0,00"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-400">Quantidade</label>
            <input type="number" min={1} value={stock} onChange={e => setStock(Math.max(1, Number(e.target.value) || 1))} className={inputClass} />
          </div>
        </div>

        <div className="space-y-2">
          <span className="text-xs text-slate-400">Métodos de entrega</span>
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" checked={pickup} onChange={e => setPickup(e.target.checked)} className="accent-emerald-500" />
            Entrega em mãos / ponto de encontro
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" checked={shipping} onChange={e => setShipping(e.target.checked)} className="accent-emerald-500" />
            Envio por transportadora (CTT)
          </label>
        </div>

        <div>
          <span className="text-xs text-slate-400">Imagens ({images.length}/{MAX_IMAGES})</span>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-1.5">
            {images.map((url, index) => (
              <div key={url} className="relative aspect-square rounded-lg overflow-hidden border border-slate-800 group">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="h-full w-full object-cover" />
                {index === 0 ? (
                  <span className="absolute top-1 left-1 text-[9px] font-bold bg-emerald-500 text-slate-950 rounded px-1">Capa</span>
                ) : (
                  <button
                    onClick={() => setImages(prev => [url, ...prev.filter(u => u !== url)])}
                    className="absolute top-1 left-1 text-[9px] font-semibold bg-black/60 text-white rounded px-1 opacity-0 group-hover:opacity-100"
                  >
                    Capa
                  </button>
                )}
                <button
                  onClick={() => setImages(prev => prev.filter(u => u !== url))}
                  className="absolute top-1 right-1 h-5 w-5 grid place-items-center text-xs bg-black/60 text-white rounded"
                  aria-label="Remover imagem"
                >
                  ×
                </button>
              </div>
            ))}
            {images.length < MAX_IMAGES ? (
              <label className="aspect-square rounded-lg border border-dashed border-slate-700 grid place-items-center text-xs text-slate-500 cursor-pointer hover:border-emerald-700">
                {uploading ? "…" : "+ Imagem"}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) addImage(file);
                    e.target.value = "";
                  }}
                />
              </label>
            ) : null}
          </div>
        </div>

        {error ? (
          <div className="rounded-lg border border-red-500/40 bg-red-950/30 p-3 text-sm text-red-200">{error}</div>
        ) : null}

        <div className="flex items-center gap-3 border-t border-slate-800 pt-4">
          <button
            onClick={save}
            disabled={saving || !valid}
            className="px-5 py-2 rounded-lg text-sm font-semibold text-slate-950 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "A guardar…" : "Guardar alterações"}
          </button>
          <Link href={`/anuncio/${id}`} className="text-xs text-slate-400 hover:text-emerald-300">
            Cancelar
          </Link>
          {!valid ? (
            <span className="text-[11px] text-slate-500">Preencha título, descrição e preço válidos.</span>
          ) : null}
        </div>
      </div>
    </main>
  );
}

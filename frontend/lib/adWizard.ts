import { z } from "zod";

export const CONDITIONS = [
  { value: "novo", label: "Novo" },
  { value: "usado_como_novo", label: "Usado — Como novo" },
  { value: "usado_sinais", label: "Usado — Sinais de uso" },
  { value: "pecas", label: "Para retirada de peças" }
] as const;

export const LISTING_TYPES = [
  { value: "classico", label: "Clássico", hint: "Gratuito · exposição normal (estilo OLX)" },
  { value: "premium", label: "Premium", hint: "Comissão por venda · alta exposição" }
] as const;

export const STEPS = [
  { key: "categoria", label: "Categoria" },
  { key: "ficha", label: "Ficha técnica" },
  { key: "galeria", label: "Galeria" },
  { key: "preco", label: "Preço & plano" },
  { key: "logistica", label: "Logística" }
] as const;

export type AdForm = {
  title: string;
  category_id: string;
  category_label: string;
  condition: string;
  description: string;
  attributes: Record<string, any>;
  images: string[];
  listing_type: string;
  price_eur: number | null;
  stock: number;
  postal_code: string;
  city: string;
  lat: number | null;
  lon: number | null;
  pickup: boolean;
  shipping: boolean;
};

export const defaultAdForm: AdForm = {
  title: "",
  category_id: "",
  category_label: "",
  condition: "",
  description: "",
  attributes: {},
  images: [],
  listing_type: "",
  price_eur: null,
  stock: 1,
  postal_code: "",
  city: "",
  lat: null,
  lon: null,
  pickup: true,
  shipping: false
};

// Per-step Zod schemas (skeleton-level requirements; tightened in later phases).
export const stepSchemas = [
  z.object({
    title: z.string().min(3, "Mínimo 3 caracteres").max(60, "Máximo 60 caracteres"),
    category_id: z.string().min(1, "Selecione uma categoria")
  }),
  z.object({
    condition: z.enum(["novo", "usado_como_novo", "usado_sinais", "pecas"], {
      errorMap: () => ({ message: "Selecione a condição do artigo" })
    }),
    description: z
      .string()
      .min(10, "Descreva o artigo (mín. 10 caracteres)")
      .max(4000, "Máximo 4000 caracteres")
  }),
  z.object({
    images: z
      .array(z.string())
      .min(1, "Adicione pelo menos uma foto")
      .max(10, "Máximo de 10 fotos")
  }),
  z.object({
    listing_type: z.enum(["classico", "premium"], {
      errorMap: () => ({ message: "Escolha o tipo de anúncio" })
    }),
    price_eur: z
      .number({ invalid_type_error: "Indique o preço" })
      .positive("O preço deve ser maior que zero"),
    stock: z.number().int().min(1, "Mínimo 1 unidade")
  }),
  z.object({
    postal_code: z
      .string()
      .regex(/^\d{4}-\d{3}$/, "Código postal inválido (ex.: 1000-100)"),
    city: z.string().min(2, "Indique a localidade")
  })
] as const;

export type StepErrors = Partial<Record<keyof AdForm, string>>;
export type AttributeErrors = Record<string, string>;

/**
 * Validate the dynamic technical-sheet attributes (Etapa 2) against the schema
 * fetched for the chosen leaf category. Only `required` fields are enforced;
 * the schema is dynamic so this lives outside the static Zod step schemas.
 */
export function validateAttributes(
  fields: { key: string; label: string; required?: boolean }[],
  attributes: Record<string, any> | undefined
): AttributeErrors {
  const errors: AttributeErrors = {};
  for (const field of fields) {
    if (!field.required) continue;
    const value = attributes?.[field.key];
    const empty =
      value === undefined ||
      value === null ||
      (typeof value === "string" && value.trim() === "") ||
      (typeof value === "number" && Number.isNaN(value));
    if (empty) errors[field.key] = `${field.label} é obrigatório`;
  }
  return errors;
}

/** Validate one step against its schema; returns validity + field error map. */
export function validateStep(step: number, values: AdForm): {
  valid: boolean;
  errors: StepErrors;
} {
  const result = stepSchemas[step].safeParse(values);
  if (result.success) return { valid: true, errors: {} };
  const errors: StepErrors = {};
  for (const issue of result.error.issues) {
    const key = issue.path[0] as keyof AdForm;
    if (key && !errors[key]) errors[key] = issue.message;
  }
  return { valid: false, errors };
}

// --- Currency mask (Etapa 4), pt-PT / EUR ---------------------------------

/** Format a euro amount as the masked display string (e.g. 1234.5 -> "1 234,50"). */
export function euroToDisplay(amount: number | null): string {
  if (amount === null || Number.isNaN(amount)) return "";
  return new Intl.NumberFormat("pt-PT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}

/** Parse masked input back to a euro number: digits fill from the right as cents. */
export function displayToEuro(raw: string): number | null {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  return parseInt(digits, 10) / 100;
}

// --- Publish mapping (Fase 6): AdForm -> backend ListingCreate ------------

export type ListingPayload = {
  title: string;
  description: string;
  category_id: string | null;
  category_path: string[];
  condition: string;
  attributes: Record<string, any>;
  price_cents: number;
  currency: string;
  listing_type: string;
  stock: number;
  postal_code: string | null;
  city: string | null;
  delivery_pickup: boolean;
  delivery_shipping: boolean;
  image_urls: string[];
  location?: { type: "Point"; coordinates: [number, number] };
};

/** Translate the wizard form into the canonical listing payload the API expects. */
export function adFormToListingPayload(form: AdForm): ListingPayload {
  const payload: ListingPayload = {
    title: form.title.trim(),
    description: form.description.trim(),
    category_id: form.category_id || null,
    category_path: form.category_label
      ? form.category_label.split(" › ").map(part => part.trim()).filter(Boolean)
      : [],
    condition: form.condition,
    attributes: form.attributes || {},
    price_cents: Math.round((form.price_eur ?? 0) * 100),
    currency: "eur",
    listing_type: form.listing_type,
    stock: form.stock,
    postal_code: form.postal_code || null,
    city: form.city || null,
    delivery_pickup: form.pickup,
    delivery_shipping: form.shipping,
    image_urls: form.images
  };
  if (form.lon !== null && form.lat !== null) {
    payload.location = { type: "Point", coordinates: [form.lon, form.lat] };
  }
  return payload;
}

/** Maps a backend (ListingCreate) field name to the wizard step that owns it,
 *  so a 422 can be shown on the right step/input. */
export const LISTING_FIELD_STEP: Record<string, number> = {
  title: 0,
  category_id: 0,
  category_path: 0,
  condition: 1,
  description: 1,
  attributes: 1,
  image_urls: 2,
  price_cents: 3,
  listing_type: 3,
  stock: 3,
  postal_code: 4,
  city: 4,
  location: 4
};

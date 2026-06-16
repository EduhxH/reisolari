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
  z.object({}), // Galeria — pipeline de imagens chega na Fase 4
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
    postal_code: z.string().min(4, "Código postal inválido"),
    city: z.string().min(2, "Indique a localidade")
  })
] as const;

export type StepErrors = Partial<Record<keyof AdForm, string>>;

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

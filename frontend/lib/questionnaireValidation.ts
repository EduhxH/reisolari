/**
 * Validação de realismo dos dados do questionário (Reisolari).
 *
 * Espelha, no cliente, os mesmos limites do backend
 * (`app/services/questionnaire_validation.py`) para dar resposta imediata:
 *
 *  - `hardErrors`  → valores impossíveis (negativos / absurdos). Bloqueiam o
 *    avanço e aparecem a vermelho junto ao campo. O backend aplica os mesmos
 *    tetos e devolve 422 a qualquer payload que escape ao cliente.
 *  - `softWarnings` → valores possíveis mas fora do normal para um telhado em
 *    Portugal. Não bloqueiam; perguntamos ao utilizador "Tens a certeza?", com a
 *    explicação do porquê e o convite a rever o dado.
 *
 * O texto está na voz Reisolari (tratamento informal), distinto do Easy Solar.
 */

import { Questionnaire } from "@/lib/questionnaire";

export const LIMITS = {
  CONSUMPTION_ANNUAL_HARD_MAX: 1_000_000,
  CONSUMPTION_ANNUAL_SOFT_LOW: 600,
  CONSUMPTION_ANNUAL_SOFT_HIGH_HOME: 15_000,
  CONSUMPTION_ANNUAL_SOFT_HIGH_BIZ: 150_000,
  AREA_HARD_MAX: 100_000,
  AREA_SOFT_HIGH_HOME: 500,
  AREA_SOFT_HIGH_BIZ: 5_000,
  AREA_MIN_PANEL_M2: 2,
  PRICE_HARD_MAX: 10,
  PRICE_SOFT_HIGH: 0.6,
  PRICE_SOFT_LOW: 0.05,
  BATTERY_HARD_MAX: 200_000,
  BATTERY_SOFT_HIGH: 30_000,
  BUDGET_HARD_MAX: 10_000_000,
  BUDGET_SOFT_LOW: 1_000,
  BUDGET_SOFT_HIGH: 500_000
} as const;

export type FieldKey =
  | "consumption_kwh"
  | "available_area_m2"
  | "electricity_price_eur_kwh"
  | "battery_cost_eur"
  | "budget_eur";

export type FieldErrors = Partial<Record<FieldKey, string>>;
export type Warning = { field: FieldKey; label: string; message: string };

/** Que passo (0-indexado) é dono de cada campo, para gating e navegação. */
export const FIELD_STEP: Record<FieldKey, number> = {
  consumption_kwh: 0,
  available_area_m2: 1,
  electricity_price_eur_kwh: 3,
  battery_cost_eur: 3,
  budget_eur: 3
};

const FIELD_LABEL: Record<FieldKey, string> = {
  consumption_kwh: "Consumo",
  available_area_m2: "Área do telhado",
  electricity_price_eur_kwh: "Preço da eletricidade",
  battery_cost_eur: "Custo da bateria",
  budget_eur: "Orçamento"
};

const isNum = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);

/** Inteiro com separador de milhares por espaço (ex.: 84000 -> "84 000"). */
function fmt(n: number): string {
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

export function annualEquivalent(q: Questionnaire): number {
  return q.consumption_kwh * (q.consumption_period === "mensal" ? 12 : 1);
}

/** Erros bloqueantes (impossíveis): sinal, finitude e tetos absolutos. */
export function hardErrors(q: Questionnaire): FieldErrors {
  const e: FieldErrors = {};
  const annual = annualEquivalent(q);

  if (!isNum(q.consumption_kwh) || q.consumption_kwh <= 0) {
    e.consumption_kwh = "O consumo é obrigatório e tem de ser maior que zero.";
  } else if (annual > LIMITS.CONSUMPTION_ANNUAL_HARD_MAX) {
    e.consumption_kwh = "Consumo fora do alcance do simulador. Confirma os kWh na tua fatura.";
  }

  if (!isNum(q.available_area_m2) || q.available_area_m2 < 0) {
    e.available_area_m2 = "A área do telhado não pode ser um valor negativo.";
  } else if (q.available_area_m2 > LIMITS.AREA_HARD_MAX) {
    e.available_area_m2 = "Área de telhado irreal — demasiado grande. Desenha de novo só o teu telhado.";
  }

  if (!isNum(q.electricity_price_eur_kwh) || q.electricity_price_eur_kwh < 0) {
    e.electricity_price_eur_kwh = "O preço da eletricidade não pode ser negativo.";
  } else if (q.electricity_price_eur_kwh > LIMITS.PRICE_HARD_MAX) {
    e.electricity_price_eur_kwh = "Preço por kWh impossível. Corrige o valor (€/kWh).";
  }

  if (q.wants_battery) {
    if (!isNum(q.battery_cost_eur) || q.battery_cost_eur < 0) {
      e.battery_cost_eur = "O custo da bateria não pode ser negativo.";
    } else if (q.battery_cost_eur > LIMITS.BATTERY_HARD_MAX) {
      e.battery_cost_eur = "Custo da bateria fora do razoável. Corrige o valor.";
    }
  }

  if (q.budget_eur != null) {
    if (!isNum(q.budget_eur) || q.budget_eur < 0) {
      e.budget_eur = "O orçamento não pode ser negativo.";
    } else if (q.budget_eur > LIMITS.BUDGET_HARD_MAX) {
      e.budget_eur = "Orçamento fora do razoável. Corrige o valor.";
    }
  }

  return e;
}

/** Avisos "Tens a certeza?" para valores possíveis mas fora do normal. */
export function softWarnings(q: Questionnaire): Warning[] {
  const out: Warning[] = [];
  const push = (field: FieldKey, message: string) =>
    out.push({ field, label: FIELD_LABEL[field], message });

  const errs = hardErrors(q);
  const annual = annualEquivalent(q);

  // --- Consumo ---
  if (!errs.consumption_kwh) {
    const softHigh =
      q.usage_type === "empresa"
        ? LIMITS.CONSUMPTION_ANNUAL_SOFT_HIGH_BIZ
        : LIMITS.CONSUMPTION_ANNUAL_SOFT_HIGH_HOME;
    if (annual > 0 && annual < LIMITS.CONSUMPTION_ANNUAL_SOFT_LOW) {
      push(
        "consumption_kwh",
        `Indicaste ${fmt(annual)} kWh/ano — é muito pouco. Tens a certeza? Confirma se escolheste o período certo (mensal ou anual).`
      );
    } else if (annual > softHigh) {
      const ref =
        q.usage_type === "empresa"
          ? "o de uma empresa comum"
          : "o de uma casa normal (cerca de 2 500–5 000 kWh/ano)";
      push(
        "consumption_kwh",
        `Indicaste ${fmt(annual)} kWh/ano — bem acima d${ref}. Tens a certeza? Se calhar trocaste o valor mensal pelo anual; senão, dá uma vista de olhos na fatura.`
      );
    }
  }

  // --- Área ---
  if (!errs.available_area_m2) {
    const areaHigh =
      q.usage_type === "empresa" ? LIMITS.AREA_SOFT_HIGH_BIZ : LIMITS.AREA_SOFT_HIGH_HOME;
    if (q.available_area_m2 > 0 && q.available_area_m2 < LIMITS.AREA_MIN_PANEL_M2) {
      push(
        "available_area_m2",
        `Com ${q.available_area_m2.toFixed(1)} m² não cabe um painel inteiro. Tens a certeza do contorno? Volta a desenhar o telhado.`
      );
    } else if (q.available_area_m2 > areaHigh) {
      push(
        "available_area_m2",
        `${fmt(q.available_area_m2)} m² é um telhado enorme. Tens a certeza? Confirma que o contorno no mapa é só o teu telhado.`
      );
    }
  }

  // --- Preço ---
  if (!errs.electricity_price_eur_kwh) {
    if (q.electricity_price_eur_kwh >= 0 && q.electricity_price_eur_kwh < LIMITS.PRICE_SOFT_LOW) {
      push(
        "electricity_price_eur_kwh",
        `${q.electricity_price_eur_kwh.toFixed(2)} €/kWh é muito baixo. Tens a certeza? Vê o preço na fatura.`
      );
    } else if (q.electricity_price_eur_kwh > LIMITS.PRICE_SOFT_HIGH) {
      push(
        "electricity_price_eur_kwh",
        `${q.electricity_price_eur_kwh.toFixed(2)} €/kWh está acima do normal em Portugal (à volta de 0,15–0,25 €/kWh). Tens a certeza? Confere a fatura.`
      );
    }
  }

  // --- Bateria ---
  if (!errs.battery_cost_eur && q.wants_battery && q.battery_cost_eur > LIMITS.BATTERY_SOFT_HIGH) {
    push(
      "battery_cost_eur",
      `${fmt(q.battery_cost_eur)} € de bateria é muito dinheiro. Tens a certeza? Revê o orçamento da bateria.`
    );
  }

  // --- Orçamento ---
  if (!errs.budget_eur && q.budget_eur != null) {
    if (q.budget_eur > 0 && q.budget_eur < LIMITS.BUDGET_SOFT_LOW) {
      push(
        "budget_eur",
        `${fmt(q.budget_eur)} € dá para pouco num sistema solar completo. Podes continuar, mas as propostas podem ultrapassar este valor.`
      );
    } else if (q.budget_eur > LIMITS.BUDGET_SOFT_HIGH) {
      push(
        "budget_eur",
        `${fmt(q.budget_eur)} € é um orçamento muito acima do normal para uma casa. Tens a certeza?`
      );
    }
  }

  return out;
}

/** Erros bloqueantes só dos campos de um dado passo (gating do "Seguinte"). */
export function stepErrors(q: Questionnaire, step: number): FieldErrors {
  const all = hardErrors(q);
  const out: FieldErrors = {};
  (Object.keys(all) as FieldKey[]).forEach((f) => {
    if (FIELD_STEP[f] === step) out[f] = all[f];
  });
  return out;
}

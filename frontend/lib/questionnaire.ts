import axios from "axios";
import { backendUrl } from "@/lib/api";

const base = `${backendUrl}/api/v1/questionnaire`;
const authHeaders = (token: string) => ({ headers: { Authorization: `Bearer ${token}` } });

export type Region = "norte" | "centro" | "sul" | "madeira" | "acores";
export type Priority = "custo" | "equilibrio" | "eficiencia";
export type Archetype = "economica" | "equilibrada" | "premium";

export type Questionnaire = {
  consumption_period: "anual" | "mensal";
  consumption_kwh: number;
  region: Region;
  usage_type: "habitacao" | "empresa";
  available_area_m2: number;
  latitude: number | null;
  longitude: number | null;
  tilt_degrees: number;
  aspect_degrees: number;
  coverage: number;
  priority: Priority;
  electricity_price_eur_kwh: number;
  has_social_tariff: boolean;
  wants_battery: boolean;
  battery_cost_eur: number;
  bill_filename?: string | null;
};

export const DEFAULT_QUESTIONNAIRE: Questionnaire = {
  consumption_period: "anual",
  consumption_kwh: 3500,
  region: "centro",
  usage_type: "habitacao",
  available_area_m2: 0,
  latitude: null,
  longitude: null,
  tilt_degrees: 35,
  aspect_degrees: 0,
  coverage: 0.75,
  priority: "equilibrio",
  electricity_price_eur_kwh: 0.2,
  has_social_tariff: false,
  wants_battery: false,
  battery_cost_eur: 0
};

export type PanelSpec = {
  code: string;
  name: string;
  power_w: number;
  width_mm: number;
  height_mm: number;
  efficiency: number;
  avg_price_eur: number;
  category: string;
  source_note: string;
};

export type FiscalResult = {
  scenario: string;
  scenario_label: string;
  vat_panels_rate: number;
  vat_battery_rate: number;
  total_cost_with_vat: number;
  effective_electricity_price_eur_kwh: number;
  annual_savings_eur: number;
  payback_years: number;
  lifetime_savings_eur: number;
  npv_eur: number;
  irr_percent: number | null;
};

export type SolutionArchetype = {
  archetype: Archetype;
  archetype_label: string;
  panel: PanelSpec;
  panels_required: number;
  panels_feasible: number;
  fits_in_area: boolean;
  installed_power_kwp: number;
  used_area_m2: number;
  achievable_coverage: number;
  annual_production_kwh: number;
  net_system_cost_eur: number;
  fiscal_real: FiscalResult;
  fiscal_guiao: FiscalResult;
  co2_annual_kg: number;
  co2_lifetime_kg: number;
};

export type IdealPanel = {
  source: "p2p" | "olx" | "loja";
  source_label: string;
  title: string;
  price_eur: number | null;
  price_display: string;
  url: string;
  image_url: string | null;
  power_w: number | null;
  location: string | null;
  match_score: number;
  match_reason: string;
};

export type FormulaStep = { label: string; expression: string; value: number; unit: string };

export type StructuredAnalysis = {
  physics: {
    panel_efficiency: number;
    temperature_coefficient_per_c: number;
    estimated_cell_temp_c: number;
    thermal_derating_factor: number;
    consistency_ok: boolean;
  };
  finance: {
    recommended_scenario: string;
    payback_years_real: number;
    payback_years_guiao: number;
    npv_eur_real: number;
    irr_percent_real: number | null;
    total_cost_real_eur: number;
    total_cost_guiao_eur: number;
    annual_savings_eur: number;
  };
  sustainability: {
    co2_annual_kg: number;
    co2_lifetime_kg: number;
    equivalent_trees: number;
    equivalent_car_km: number;
  };
  analyst: { recommended_archetype: Archetype; confidence: number; fits_questionnaire: boolean };
};

export type QuestionnaireResult = {
  annual_consumption_kwh: number;
  region: string;
  region_yield_kwh_kwp_year: number;
  pvgis_yield_kwh_kwp_year: number | null;
  recommended_archetype: Archetype;
  formula_steps: FormulaStep[];
  solutions: SolutionArchetype[];
  analysis: StructuredAnalysis;
  ideal_panels: IdealPanel[];
  created_at: string | null;
};

export type BillExtraction = {
  annual_consumption_kwh: number | null;
  monthly_consumption_kwh: number | null;
  contracted_power_kva: number | null;
  price_eur_kwh: number | null;
  supplier: string | null;
  has_social_tariff: boolean | null;
  confidence: number;
  raw_note: string;
};

export async function getQuestionnaireStatus(token: string): Promise<boolean> {
  const res = await axios.get<{ completed: boolean }>(`${base}/status`, authHeaders(token));
  return res.data.completed;
}

export async function getMyQuestionnaire(token: string): Promise<Questionnaire | null> {
  const res = await axios.get<Questionnaire | null>(`${base}/`, authHeaders(token));
  return res.data;
}

export async function saveQuestionnaire(token: string, q: Questionnaire): Promise<void> {
  await axios.put(`${base}/`, q, authHeaders(token));
}

export async function uploadBill(token: string, file: File): Promise<BillExtraction> {
  const form = new FormData();
  form.append("file", file);
  const res = await axios.post<BillExtraction>(`${base}/bill`, form, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "multipart/form-data" }
  });
  return res.data;
}

export async function runSimulation(token: string, q: Questionnaire): Promise<QuestionnaireResult> {
  const res = await axios.post<QuestionnaireResult>(`${base}/simulate`, q, authHeaders(token));
  return res.data;
}

export async function getLatestResult(token: string): Promise<QuestionnaireResult | null> {
  try {
    const res = await axios.get<QuestionnaireResult>(`${base}/result`, authHeaders(token));
    return res.data;
  } catch {
    return null;
  }
}

/** Fetch the orçamento PDF (auth header required) and trigger a browser download. */
export async function downloadOrcamento(token: string): Promise<void> {
  const res = await axios.get(`${base}/orcamento.pdf`, {
    ...authHeaders(token),
    responseType: "blob"
  });
  const url = URL.createObjectURL(res.data as Blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "orcamento-reisolari.pdf";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

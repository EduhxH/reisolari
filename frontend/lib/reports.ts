import axios from "axios";
import { backendUrl } from "@/lib/api";

const auth = (idToken: string) => ({ headers: { Authorization: `Bearer ${idToken}` } });

export type ReportReason =
  | "fraude"
  | "proibido"
  | "ofensivo"
  | "spam"
  | "categoria_errada"
  | "ja_vendido"
  | "outro";

export const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: "fraude", label: "Fraude / pagamento fora da plataforma" },
  { value: "proibido", label: "Artigo proibido ou ilegal" },
  { value: "spam", label: "Spam ou anúncio duplicado" },
  { value: "categoria_errada", label: "Categoria errada" },
  { value: "ja_vendido", label: "Já vendido / indisponível" },
  { value: "ofensivo", label: "Conteúdo ofensivo" },
  { value: "outro", label: "Outro" }
];

export const REASON_LABELS: Record<string, string> = Object.fromEntries(
  REPORT_REASONS.map(r => [r.value, r.label])
);

export async function createReport(
  idToken: string,
  targetType: "listing" | "user",
  targetId: string,
  reason: ReportReason,
  detail?: string
): Promise<void> {
  await axios.post(
    `${backendUrl}/api/v1/reports/`,
    { target_type: targetType, target_id: targetId, reason, detail },
    auth(idToken)
  );
}

export async function getMyReportedIds(idToken: string): Promise<string[]> {
  const res = await axios.get(`${backendUrl}/api/v1/reports/mine`, auth(idToken));
  return res.data;
}

export async function checkAdmin(idToken: string): Promise<boolean> {
  const res = await axios.get(`${backendUrl}/api/v1/reports/admin/check`, auth(idToken));
  return res.data.is_admin;
}

export type ReportGroup = {
  key: string;
  target_type: "listing" | "user";
  target_id: string;
  count: number;
  reasons: string[];
  details: string[];
  last_at: string;
  info: { title?: string | null; active?: boolean; name?: string };
};

export async function listOpenReports(idToken: string): Promise<ReportGroup[]> {
  const res = await axios.get(`${backendUrl}/api/v1/reports/admin`, auth(idToken));
  return res.data;
}

export async function resolveReport(
  idToken: string,
  targetType: "listing" | "user",
  targetId: string,
  action: "dismiss" | "remove"
): Promise<void> {
  await axios.post(
    `${backendUrl}/api/v1/reports/admin/resolve`,
    { target_type: targetType, target_id: targetId, action },
    auth(idToken)
  );
}

"""Generate the "Orçamento Reisolari" PDF for a stored simulation.

Numbers only — the three formulas, the recommended solution, the three proposals
and the structured agent RESULTS. No agent prose (it stays in the backend). Built
with reportlab; if reportlab is not installed the caller gets a clear 503.

Note: reportlab's base-14 fonts have no Unicode subscript glyphs, so we use plain
ASCII units ("CO2", "m2") rather than "CO₂"/"m²".
"""

from __future__ import annotations

from io import BytesIO
from typing import Any, Dict

ARCHETYPE_PT = {"economica": "Económica", "equilibrada": "Equilibrada", "premium": "Premium"}
REGION_PT = {
    "norte": "Norte", "centro": "Centro", "sul": "Sul", "madeira": "Madeira", "acores": "Açores",
}


def _money(value: float | None) -> str:
    if value is None:
        return "—"
    return f"{value:,.0f}".replace(",", " ") + " €"


def _years(value: float | None) -> str:
    if value is None or value == float("inf"):
        return "—"
    return f"{value:.1f} anos"


def build_quote_pdf(record: Dict[str, Any]) -> bytes:
    try:
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import mm
        from reportlab.platypus import (
            SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
        )
    except ImportError as exc:  # dep opcional
        raise RuntimeError(
            "Geração de PDF indisponível: instale 'reportlab' (pip install reportlab)."
        ) from exc

    result = record.get("result", {})
    questionnaire = record.get("questionnaire", {})
    analysis = result.get("analysis", {})
    solutions = result.get("solutions", [])
    recommended_key = result.get("recommended_archetype", "equilibrada")
    recommended = next(
        (s for s in solutions if s.get("archetype") == recommended_key),
        solutions[0] if solutions else {},
    )

    styles = getSampleStyleSheet()
    h1 = ParagraphStyle("h1", parent=styles["Heading1"], textColor=colors.HexColor("#0f766e"))
    h2 = ParagraphStyle("h2", parent=styles["Heading2"], textColor=colors.HexColor("#115e59"))
    body = styles["BodyText"]
    small = ParagraphStyle("small", parent=body, fontSize=8, textColor=colors.grey)

    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4, topMargin=18 * mm, bottomMargin=16 * mm,
        leftMargin=16 * mm, rightMargin=16 * mm, title="Orçamento Reisolari",
    )
    story: list = []

    story.append(Paragraph("Orçamento Reisolari", h1))
    story.append(Paragraph("Dimensionamento de sistema fotovoltaico para autoconsumo", body))
    story.append(Spacer(1, 8))

    # --- Dados introduzidos ---
    story.append(Paragraph("Dados introduzidos", h2))
    region = REGION_PT.get(result.get("region"), result.get("region", ""))
    dados = [
        ["Consumo anual", f"{result.get('annual_consumption_kwh', 0):,.0f} kWh".replace(",", " ")],
        ["Região", region],
        ["Tipo", "Habitação" if questionnaire.get("usage_type") == "habitacao" else "Empresa"],
        ["Área disponível", f"{questionnaire.get('available_area_m2', 0):.0f} m2"],
        ["Autossuficiência pretendida", f"{questionnaire.get('coverage', 0) * 100:.0f} %"],
        ["Preço eletricidade", f"{questionnaire.get('electricity_price_eur_kwh', 0):.3f} €/kWh"],
        ["Tarifa Social", "Sim" if questionnaire.get("has_social_tariff") else "Não"],
        ["Bateria", "Sim" if questionnaire.get("wants_battery") else "Não"],
    ]
    story.append(_kv_table(dados, Table, TableStyle, colors, mm))
    story.append(Spacer(1, 8))

    # --- Cálculo (fórmulas do guião) ---
    story.append(Paragraph("Cálculo (guião)", h2))
    for step in result.get("formula_steps", []):
        story.append(
            Paragraph(
                f"<b>{step.get('label')}:</b> {step.get('expression')} = "
                f"<b>{step.get('value'):.2f} {step.get('unit')}</b>",
                body,
            )
        )
    yld = result.get("region_yield_kwh_kwp_year")
    pv = result.get("pvgis_yield_kwh_kwp_year")
    story.append(Spacer(1, 2))
    line = f"Produção específica regional (guião): {yld:.0f} kWh/kWp/ano"
    if pv:
        line += f" · PVGIS (localização): {pv:.0f} kWh/kWp/ano"
    story.append(Paragraph(line, small))
    story.append(Spacer(1, 8))

    # --- Solução recomendada ---
    story.append(
        Paragraph(f"Solução recomendada — {ARCHETYPE_PT.get(recommended_key, recommended_key)}", h2)
    )
    if recommended:
        fr = recommended.get("fiscal_real", {})
        fg = recommended.get("fiscal_guiao", {})
        rec_rows = [
            ["Módulo", recommended.get("panel", {}).get("name", "")],
            ["Nº de painéis", str(recommended.get("panels_feasible"))],
            ["Potência instalada", f"{recommended.get('installed_power_kwp', 0):.2f} kWp"],
            ["Área ocupada", f"{recommended.get('used_area_m2', 0):.1f} m2"],
            ["Produção anual", f"{recommended.get('annual_production_kwh', 0):,.0f} kWh".replace(",", " ")],
            ["Custo c/ IVA (real 6/5/4%)", _money(fr.get("total_cost_with_vat"))],
            ["Custo c/ IVA (guião 23/22/16%)", _money(fg.get("total_cost_with_vat"))],
            ["Poupança anual", _money(fr.get("annual_savings_eur"))],
            ["Retorno (real / guião)", f"{_years(fr.get('payback_years'))} / {_years(fg.get('payback_years'))}"],
            ["VAL (real)", _money(fr.get("npv_eur"))],
        ]
        story.append(_kv_table(rec_rows, Table, TableStyle, colors, mm))
    story.append(Spacer(1, 8))

    # --- As três propostas ---
    story.append(Paragraph("As três propostas", h2))
    header = ["Proposta", "Painéis", "kWp", "Produção/ano", "Custo (real)", "Custo (guião)", "Retorno"]
    table_data = [header]
    for s in solutions:
        fr = s.get("fiscal_real", {})
        fg = s.get("fiscal_guiao", {})
        table_data.append([
            ARCHETYPE_PT.get(s.get("archetype"), s.get("archetype")),
            str(s.get("panels_feasible")),
            f"{s.get('installed_power_kwp', 0):.2f}",
            f"{s.get('annual_production_kwh', 0):,.0f}".replace(",", " "),
            _money(fr.get("total_cost_with_vat")),
            _money(fg.get("total_cost_with_vat")),
            _years(fr.get("payback_years")),
        ])
    proposals = Table(table_data, repeatRows=1)
    proposals.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0f766e")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#cbd5e1")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f1f5f9")]),
        ("ALIGN", (1, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    story.append(proposals)
    story.append(Spacer(1, 8))

    # --- Resultados da análise (números, sem texto dos agentes) ---
    story.append(Paragraph("Resultados da análise", h2))
    physics = analysis.get("physics", {})
    finance = analysis.get("finance", {})
    sust = analysis.get("sustainability", {})
    analysis_rows = [
        ["Eficiência do módulo", f"{physics.get('panel_efficiency', 0) * 100:.1f} %"],
        ["Fator térmico (vs STC)", f"{physics.get('thermal_derating_factor', 0):.3f}"],
        ["Retorno (real)", _years(finance.get("payback_years_real"))],
        ["VAL / TIR (real)", f"{_money(finance.get('npv_eur_real'))} / "
            + (f"{finance.get('irr_percent_real'):.1f} %" if finance.get("irr_percent_real") is not None else "—")],
        ["CO2 evitado / ano", f"{sust.get('co2_annual_kg', 0):,.0f} kg".replace(",", " ")],
        ["CO2 evitado em 25 anos", f"{sust.get('co2_lifetime_kg', 0):,.0f} kg".replace(",", " ")],
        ["Equivale a plantar", f"{sust.get('equivalent_trees', 0):,.0f} árvores".replace(",", " ")],
    ]
    story.append(_kv_table(analysis_rows, Table, TableStyle, colors, mm))
    story.append(Spacer(1, 10))

    story.append(Paragraph(
        "Pressupostos: produção específica regional do guião; IVA real reduzido para painéis "
        "(6/5/4%, Verba 2.34 da Lista I do CIVA) vs IVA normal do guião (23/22/16%); análise a "
        "25 anos com degradação 0,5%/ano e taxa de desconto 4%. Valores indicativos.",
        small,
    ))

    doc.build(story)
    return buf.getvalue()


def _kv_table(rows, Table, TableStyle, colors, mm):
    table = Table(rows, colWidths=[70 * mm, 100 * mm])
    table.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("TEXTCOLOR", (0, 0), (0, -1), colors.HexColor("#475569")),
        ("LINEBELOW", (0, 0), (-1, -1), 0.3, colors.HexColor("#e2e8f0")),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    return table

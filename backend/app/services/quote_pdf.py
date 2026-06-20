"""Generate the professional "Orçamento Reisolari" PDF for a stored simulation.

Numbers only — the three formulas, the recommended solution (with the real panel's
photo, description and price), the three proposals and the structured agent RESULTS.
No agent prose (it stays in the backend). Built with reportlab; if reportlab is not
installed the caller gets a clear 503.

The recommended panel's photo, when available, is fetched by the async API layer and
injected as ``record["panel_image_bytes"]`` so this builder stays pure (no network).

Note: reportlab's base-14 fonts have no Unicode subscript glyphs, so we use plain
ASCII units ("CO2", "m2") rather than "CO₂"/"m²".
"""

from __future__ import annotations

import hashlib
from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path
from typing import Any, Dict, Optional

from app.core.config import settings

ARCHETYPE_PT = {"economica": "Económica", "equilibrada": "Equilibrada", "premium": "Premium"}
REGION_PT = {
    "norte": "Norte", "centro": "Centro", "sul": "Sul", "madeira": "Madeira", "acores": "Açores",
}

LOGO_PATH = Path(__file__).resolve().parents[1] / "assets" / "reisolari-logo.jpeg"

# Paleta da marca (alinhada com o frontend).
BRAND = "#006fff"
INK = "#1d1d1f"
MUTED = "#7c7f87"
LINE = "#e2e8f0"
SECTION = "#eef1f6"
GREEN = "#1f9d57"


def _money(value: float | None) -> str:
    if value is None:
        return "—"
    return f"{value:,.0f}".replace(",", " ") + " €"


def _years(value: float | None) -> str:
    if value is None or value == float("inf"):
        return "—"
    return f"{value:.1f} anos"


def _quote_meta(record: Dict[str, Any]) -> tuple[str, str]:
    """Devolve (número do orçamento, data formatada)."""
    result = record.get("result", {})
    created = result.get("created_at") or record.get("created_at")
    dt: Optional[datetime] = None
    if isinstance(created, datetime):
        dt = created
    elif isinstance(created, str):
        try:
            dt = datetime.fromisoformat(created)
        except ValueError:
            dt = None
    dt = dt or datetime.now(timezone.utc)
    uid = str(record.get("uid", "")) or "anon"
    # Hash determinístico (hashlib) — `hash()` é aleatório por processo, o que
    # faria o nº do orçamento mudar a cada geração para o mesmo utilizador.
    digest = int(hashlib.sha1(uid.encode("utf-8")).hexdigest(), 16)
    number = f"RSL-{dt.strftime('%Y%m%d')}-{digest % 10000:04d}"
    return number, dt.strftime("%d/%m/%Y")


def build_quote_pdf(record: Dict[str, Any]) -> bytes:
    try:
        from reportlab.lib import colors
        from reportlab.lib.enums import TA_RIGHT
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import mm
        from reportlab.lib.utils import ImageReader
        from reportlab.platypus import (
            SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image, HRFlowable,
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
    quote_number, quote_date = _quote_meta(record)

    brand = colors.HexColor(BRAND)
    ink = colors.HexColor(INK)
    muted = colors.HexColor(MUTED)
    line = colors.HexColor(LINE)
    section_bg = colors.HexColor(SECTION)

    styles = getSampleStyleSheet()
    h2 = ParagraphStyle("h2", parent=styles["Heading2"], textColor=ink, fontSize=12, spaceAfter=4)
    body = ParagraphStyle("body", parent=styles["BodyText"], fontSize=9, textColor=ink, leading=13)
    small = ParagraphStyle("small", parent=body, fontSize=7.5, textColor=muted, leading=10)
    company = ParagraphStyle("company", parent=body, fontSize=8.5, textColor=muted, leading=12)
    meta = ParagraphStyle("meta", parent=body, fontSize=8.5, textColor=ink, leading=12, alignment=TA_RIGHT)
    title = ParagraphStyle("title", parent=styles["Title"], fontSize=20, textColor=ink, spaceAfter=0, leading=22)
    panel_name = ParagraphStyle("pname", parent=body, fontSize=12, textColor=ink, leading=15, spaceAfter=1)
    price_big = ParagraphStyle("price", parent=body, fontSize=15, textColor=brand, leading=17)

    def _footer(canvas, doc):
        canvas.saveState()
        canvas.setStrokeColor(line)
        canvas.setLineWidth(0.5)
        canvas.line(16 * mm, 14 * mm, A4[0] - 16 * mm, 14 * mm)
        canvas.setFont("Helvetica", 7.5)
        canvas.setFillColor(muted)
        canvas.drawString(16 * mm, 9.5 * mm, "Reisolari · Energia solar para autoconsumo · reisolari.pt")
        canvas.drawRightString(A4[0] - 16 * mm, 9.5 * mm, f"Orçamento {quote_number} · pág. {doc.page}")
        canvas.restoreState()

    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4, topMargin=16 * mm, bottomMargin=20 * mm,
        leftMargin=16 * mm, rightMargin=16 * mm, title=f"Orçamento Reisolari {quote_number}",
        author="Reisolari",
    )
    content_width = doc.width
    story: list = []

    # --- Cabeçalho: logótipo + empresa | meta do orçamento ---
    if LOGO_PATH.exists():
        logo = Image(str(LOGO_PATH), width=18 * mm, height=18 * mm)
        brand_cell = Table(
            [[logo, Paragraph(
                "<b><font size=14 color='%s'>Reisolari</font></b><br/>"
                "<font size=8 color='%s'>Energia solar para autoconsumo</font>" % (INK, MUTED),
                company,
            )]],
            colWidths=[20 * mm, 60 * mm],
        )
        brand_cell.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("TOPPADDING", (0, 0), (-1, -1), 0),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ]))
    else:
        brand_cell = Paragraph("<b><font size=14>Reisolari</font></b>", company)

    meta_cell = Paragraph(
        f"<b>ORÇAMENTO</b><br/>Nº {quote_number}<br/>Data: {quote_date}", meta
    )
    header = Table([[brand_cell, meta_cell]], colWidths=[content_width - 55 * mm, 55 * mm])
    header.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
    ]))
    story.append(header)
    story.append(Spacer(1, 6))
    story.append(HRFlowable(width="100%", thickness=2, color=brand, spaceAfter=10))

    story.append(Paragraph("Orçamento de sistema fotovoltaico", title))
    story.append(Paragraph("Dimensionamento para autoconsumo · valores indicativos", small))
    story.append(Spacer(1, 10))

    # --- Dados introduzidos ---
    story.append(Paragraph("Dados do cliente", h2))
    region = REGION_PT.get(result.get("region"), result.get("region", ""))
    budget = questionnaire.get("budget_eur")
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
    if budget:
        dados.append(["Orçamento máximo", _money(budget)])
    story.append(_kv_table(dados, Table, TableStyle, colors, mm, content_width))
    story.append(Spacer(1, 10))

    # --- Solução recomendada (com foto, descrição, preço e os 4 valores de IVA) ---
    story.append(
        Paragraph(f"Solução recomendada — {ARCHETYPE_PT.get(recommended_key, recommended_key)}", h2)
    )
    if recommended:
        panel = recommended.get("panel", {})
        fred = recommended.get("fiscal_reduzido", {})
        fr = recommended.get("fiscal_real", {})
        fg = recommended.get("fiscal_guiao", {})
        slug = panel.get("code", "")
        store_url = f"{settings.FRONTEND_PUBLIC_URL.rstrip('/')}/loja/{slug}" if slug else ""

        # Coluna esquerda: foto real do painel (se disponível).
        img_bytes = record.get("panel_image_bytes")
        photo_flowable = None
        if img_bytes:
            try:
                reader = ImageReader(BytesIO(img_bytes))
                iw, ih = reader.getSize()
                max_w, max_h = 46 * mm, 46 * mm
                ratio = min(max_w / iw, max_h / ih)
                photo_flowable = Image(BytesIO(img_bytes), width=iw * ratio, height=ih * ratio)
            except Exception:
                photo_flowable = None

        # Coluna direita: nome, descrição, preço unitário e nº de painéis.
        details = [
            Paragraph(panel.get("name", ""), panel_name),
            Paragraph(
                f"{panel.get('brand', '')} · {panel.get('power_w', 0)} Wp · "
                f"eficiência {panel.get('efficiency', 0) * 100:.1f}%",
                small,
            ),
            Spacer(1, 3),
            Paragraph(panel.get("description", "") or "", small),
            Spacer(1, 4),
            Paragraph(
                f"<b>{_money(panel.get('avg_price_eur'))}</b> "
                f"<font size=8 color='{MUTED}'>/ painel (sem IVA)</font>",
                price_big,
            ),
            Paragraph(
                f"Sistema: {recommended.get('panels_feasible')} painéis · "
                f"{recommended.get('installed_power_kwp', 0):.2f} kWp · "
                f"{recommended.get('annual_production_kwh', 0):,.0f} kWh/ano".replace(",", " "),
                small,
            ),
        ]
        if store_url:
            details.append(Spacer(1, 3))
            details.append(Paragraph(
                f"<a href='{store_url}'><font color='{BRAND}'><b>Comprar na loja Reisolari →</b></font></a>",
                small,
            ))

        left = photo_flowable or Paragraph(
            f"<font color='{MUTED}'>Foto indisponível</font>", small
        )
        rec_card = Table([[left, details]], colWidths=[50 * mm, content_width - 50 * mm])
        rec_card.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("BACKGROUND", (0, 0), (-1, -1), section_bg),
            ("BOX", (0, 0), (-1, -1), 0.5, line),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ("RIGHTPADDING", (0, 0), (-1, -1), 8),
            ("TOPPADDING", (0, 0), (-1, -1), 8),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ]))
        story.append(rec_card)
        story.append(Spacer(1, 8))

        # Os 4 valores de IVA pedidos pelo guião.
        story.append(Paragraph("Preço e IVA (sistema completo)", h2))
        vat_header = ["", "Sem IVA", "IVA reduzido<br/>(6/5/4%)", "IVA real<br/>(painéis red.)", "IVA guião<br/>(23/22/16%)"]
        vat_rows = [
            [Paragraph(f"<b>{c}</b>", small) if isinstance(c, str) else c for c in vat_header],
            [
                Paragraph("Total a pagar", small),
                Paragraph(f"<b>{_money(fr.get('net_cost_eur'))}</b>", body),
                Paragraph(f"<b>{_money(fred.get('total_cost_with_vat'))}</b>", body),
                Paragraph(f"<b><font color='{BRAND}'>{_money(fr.get('total_cost_with_vat'))}</font></b>", body),
                Paragraph(f"<b>{_money(fg.get('total_cost_with_vat'))}</b>", body),
            ],
            [
                Paragraph("IVA incluído", small),
                Paragraph("—", small),
                Paragraph(_money(fred.get("vat_amount_eur")), small),
                Paragraph(_money(fr.get("vat_amount_eur")), small),
                Paragraph(_money(fg.get("vat_amount_eur")), small),
            ],
        ]
        col = (content_width - 32 * mm) / 4
        vat_table = Table(vat_rows, colWidths=[32 * mm, col, col, col, col])
        vat_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), section_bg),
            ("BACKGROUND", (3, 1), (3, 1), colors.HexColor("#eaf2ff")),
            ("GRID", (0, 0), (-1, -1), 0.4, line),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("ALIGN", (1, 0), (-1, -1), "CENTER"),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ]))
        story.append(vat_table)
        story.append(Paragraph(
            "O valor de referência é o <b>IVA real</b> (painéis à taxa reduzida da Verba 2.34 da Lista I "
            "do CIVA; bateria, quando aplicável, à taxa normal).",
            small,
        ))
        story.append(Spacer(1, 6))
        rec_rows = [
            ["Retorno (real / guião)", f"{_years(fr.get('payback_years'))} / {_years(fg.get('payback_years'))}"],
            ["Poupança anual", _money(fr.get("annual_savings_eur"))],
            ["VAL a 25 anos (real)", _money(fr.get("npv_eur"))],
        ]
        story.append(_kv_table(rec_rows, Table, TableStyle, colors, mm, content_width))
    story.append(Spacer(1, 10))

    # --- Cálculo (fórmulas do guião) ---
    story.append(Paragraph("Como foi calculado (fórmulas do guião)", h2))
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
    if yld is not None:
        line_txt = f"Produção específica regional (guião): {yld:.0f} kWh/kWp/ano"
        if pv:
            line_txt += f" · PVGIS (localização): {pv:.0f} kWh/kWp/ano"
        story.append(Spacer(1, 2))
        story.append(Paragraph(line_txt, small))
    story.append(Spacer(1, 10))

    # --- As três propostas (com os 4 valores de IVA) ---
    story.append(Paragraph("As três propostas", h2))
    header_cells = [
        "Proposta", "Painéis", "kWp", "Sem IVA", "IVA red.", "IVA real", "IVA guião", "Retorno",
    ]
    table_data = [[Paragraph(f"<b><font color='white' size=7>{c}</font></b>", small) for c in header_cells]]
    for s in solutions:
        fred = s.get("fiscal_reduzido", {})
        fr = s.get("fiscal_real", {})
        fg = s.get("fiscal_guiao", {})
        table_data.append([
            Paragraph(f"<b>{ARCHETYPE_PT.get(s.get('archetype'), s.get('archetype'))}</b><br/>"
                      f"<font size=6 color='{MUTED}'>{s.get('panel', {}).get('name', '')}</font>", small),
            str(s.get("panels_feasible")),
            f"{s.get('installed_power_kwp', 0):.2f}",
            _money(fr.get("net_cost_eur")),
            _money(fred.get("total_cost_with_vat")),
            _money(fr.get("total_cost_with_vat")),
            _money(fg.get("total_cost_with_vat")),
            _years(fr.get("payback_years")),
        ])
    w = content_width
    proposals = Table(
        table_data, repeatRows=1,
        colWidths=[w - 134 * mm, 14 * mm, 14 * mm, 24 * mm, 22 * mm, 24 * mm, 22 * mm, 14 * mm],
    )
    proposals.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), brand),
        ("FONTSIZE", (0, 0), (-1, -1), 7.5),
        ("TEXTCOLOR", (0, 1), (-1, -1), ink),
        ("GRID", (0, 0), (-1, -1), 0.4, line),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, section_bg]),
        ("ALIGN", (1, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(proposals)
    story.append(Spacer(1, 10))

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
    story.append(_kv_table(analysis_rows, Table, TableStyle, colors, mm, content_width))
    story.append(Spacer(1, 10))

    story.append(Paragraph(
        "Pressupostos: produção específica regional do guião; IVA real reduzido para painéis "
        "(6/5/4%, Verba 2.34 da Lista I do CIVA) vs IVA normal do guião (23/22/16%); análise a "
        "25 anos com degradação 0,5%/ano e taxa de desconto 4%. Valores indicativos, não vinculativos.",
        small,
    ))

    doc.build(story, onFirstPage=_footer, onLaterPages=_footer)
    return buf.getvalue()


def _kv_table(rows, Table, TableStyle, colors, mm, content_width):
    label_w = 70 * mm
    table = Table(rows, colWidths=[label_w, content_width - label_w])
    table.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("TEXTCOLOR", (0, 0), (0, -1), colors.HexColor(MUTED)),
        ("TEXTCOLOR", (1, 0), (1, -1), colors.HexColor(INK)),
        ("LINEBELOW", (0, 0), (-1, -1), 0.3, colors.HexColor(LINE)),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    return table

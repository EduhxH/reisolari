"""Real solar-panel product catalog for the Reisolari store.

Each entry is a real, commercially available residential PV module class with its
published nameplate specifications. Prices are net unit prices (ex-VAT) in euro
cents, reflecting typical Portuguese retail pricing per module. The catalog is
seeded idempotently into the ``products`` MongoDB collection: descriptive fields
and prices are refreshed on every startup, while live ``stock`` is preserved so
that inventory consumed by real orders is never reset.
"""

from datetime import datetime, timezone

from app.db.mongo import get_db_client
from app.schemas.panel import PanelSpec

# slug, name, brand, model, category, panel_type, power_w, efficiency,
# cell_count, width_mm, height_mm, depth_mm, weight_kg,
# warranty_product_years, warranty_power_years, price_cents (net, ex-VAT),
# stock, description
CATALOG: list[dict] = [
    {
        "slug": "jinko-tiger-neo-440",
        "name": "Jinko Solar Tiger Neo N-type 440 W",
        "brand": "Jinko Solar",
        "model": "JKM440N-54HL4R-B",
        "category": "Custo-benefício",
        "panel_type": "Monocristalino N-TOPCon",
        "power_w": 440,
        "efficiency": 0.2253,
        "cell_count": 108,
        "width_mm": 1134,
        "height_mm": 1762,
        "depth_mm": 30,
        "weight_kg": 21.5,
        "warranty_product_years": 25,
        "warranty_power_years": 30,
        "price_cents": 10500,
        "stock": 64,
        "description": (
            "Módulo N-TOPCon de 440 Wp com 108 meias-células, excelente relação "
            "qualidade/preço e baixo coeficiente de temperatura. Ideal para "
            "instalações residenciais que procuram máximo retorno por euro."
        ),
    },
    {
        "slug": "trina-vertex-s-plus-445",
        "name": "Trina Solar Vertex S+ 445 W",
        "brand": "Trina Solar",
        "model": "TSM-445NEG9R.28",
        "category": "Alta eficiência",
        "panel_type": "Monocristalino N-TOPCon",
        "power_w": 445,
        "efficiency": 0.2280,
        "cell_count": 108,
        "width_mm": 1134,
        "height_mm": 1762,
        "depth_mm": 30,
        "weight_kg": 21.0,
        "warranty_product_years": 25,
        "warranty_power_years": 30,
        "price_cents": 11200,
        "stock": 48,
        "description": (
            "Painel all-black compacto de 445 Wp com tecnologia N-TOPCon e moldura "
            "preta. Alta densidade de potência num formato reduzido, perfeito para "
            "telhados com área limitada."
        ),
    },
    {
        "slug": "canadian-solar-tophiku6-450",
        "name": "Canadian Solar TOPHiKu6 450 W",
        "brand": "Canadian Solar",
        "model": "CS6.1-54TD-450",
        "category": "Alta eficiência",
        "panel_type": "Monocristalino N-TOPCon bifacial",
        "power_w": 450,
        "efficiency": 0.2270,
        "cell_count": 108,
        "width_mm": 1134,
        "height_mm": 1762,
        "depth_mm": 30,
        "weight_kg": 21.3,
        "warranty_product_years": 25,
        "warranty_power_years": 30,
        "price_cents": 11900,
        "stock": 40,
        "description": (
            "Módulo bifacial N-TOPCon de 450 Wp que aproveita também a luz "
            "refletida na face traseira, aumentando a produção anual em telhados "
            "claros ou montagens elevadas."
        ),
    },
    {
        "slug": "ja-solar-deepblue-4-430",
        "name": "JA Solar DeepBlue 4.0 Pro 430 W",
        "brand": "JA Solar",
        "model": "JAM54D40-430/LB",
        "category": "Custo-benefício",
        "panel_type": "Monocristalino N-TOPCon bifacial",
        "power_w": 430,
        "efficiency": 0.2204,
        "cell_count": 108,
        "width_mm": 1134,
        "height_mm": 1762,
        "depth_mm": 30,
        "weight_kg": 21.5,
        "warranty_product_years": 25,
        "warranty_power_years": 30,
        "price_cents": 9900,
        "stock": 72,
        "description": (
            "Painel N-TOPCon de 430 Wp da gama DeepBlue 4.0, robusto e fiável, "
            "com ótima resistência a cargas de vento e neve. Uma escolha segura "
            "para o mercado residencial português."
        ),
    },
    {
        "slug": "longi-himo-6-435",
        "name": "LONGi Hi-MO 6 Explorer 435 W",
        "brand": "LONGi",
        "model": "LR5-54HTH-435M",
        "category": "Alta eficiência",
        "panel_type": "Monocristalino HPBC",
        "power_w": 435,
        "efficiency": 0.2230,
        "cell_count": 108,
        "width_mm": 1134,
        "height_mm": 1722,
        "depth_mm": 30,
        "weight_kg": 21.2,
        "warranty_product_years": 25,
        "warranty_power_years": 30,
        "price_cents": 11500,
        "stock": 36,
        "description": (
            "Módulo Hi-MO 6 com células HPBC sem barramentos frontais, oferecendo "
            "um aspeto totalmente preto e maior produção em condições de luz "
            "difusa, comum nos invernos portugueses."
        ),
    },
    {
        "slug": "qcells-qtron-430",
        "name": "Q CELLS Q.TRON BLK M-G2+ 430 W",
        "brand": "Q CELLS",
        "model": "Q.TRON BLK M-G2+ 430",
        "category": "Premium europeu",
        "panel_type": "Monocristalino N-TOPCon (Q.ANTUM NEO)",
        "power_w": 430,
        "efficiency": 0.2200,
        "cell_count": 108,
        "width_mm": 1134,
        "height_mm": 1722,
        "depth_mm": 30,
        "weight_kg": 21.5,
        "warranty_product_years": 25,
        "warranty_power_years": 30,
        "price_cents": 12900,
        "stock": 30,
        "description": (
            "Painel premium de engenharia alemã com tecnologia Q.ANTUM NEO "
            "(N-TOPCon), 430 Wp e garantia de produto de 25 anos. Excelente "
            "desempenho a temperaturas elevadas."
        ),
    },
    {
        "slug": "rec-alpha-pure-rx-430",
        "name": "REC Alpha Pure-RX 430 W",
        "brand": "REC",
        "model": "REC430AA Pure-RX",
        "category": "Premium",
        "panel_type": "Heterojunção (HJT) sem chumbo",
        "power_w": 430,
        "efficiency": 0.2230,
        "cell_count": 120,
        "width_mm": 1118,
        "height_mm": 1730,
        "depth_mm": 30,
        "weight_kg": 19.5,
        "warranty_product_years": 25,
        "warranty_power_years": 25,
        "price_cents": 17500,
        "stock": 18,
        "description": (
            "Tecnologia de heterojunção (HJT) sem chumbo, altíssima densidade de "
            "potência e baixíssima degradação. Construção leve com elevada "
            "tolerância a sombreamento parcial."
        ),
    },
    {
        "slug": "sunpower-maxeon-6-440",
        "name": "SunPower Maxeon 6 440 W",
        "brand": "SunPower",
        "model": "SPR-MAX6-440",
        "category": "Premium",
        "panel_type": "Monocristalino IBC Maxeon",
        "power_w": 440,
        "efficiency": 0.2280,
        "cell_count": 104,
        "width_mm": 1032,
        "height_mm": 1872,
        "depth_mm": 40,
        "weight_kg": 21.0,
        "warranty_product_years": 40,
        "warranty_power_years": 40,
        "price_cents": 23500,
        "stock": 14,
        "description": (
            "Célula de contacto traseiro (IBC) Maxeon, a referência em "
            "durabilidade, com 40 anos de garantia de produto e potência. A maior "
            "produção a longo prazo do catálogo."
        ),
    },
    {
        "slug": "risen-titan-s-410",
        "name": "Risen Energy Titan S 410 W",
        "brand": "Risen Energy",
        "model": "RSM40-8-410M",
        "category": "Custo-benefício",
        "panel_type": "Monocristalino PERC",
        "power_w": 410,
        "efficiency": 0.2133,
        "cell_count": 108,
        "width_mm": 1096,
        "height_mm": 1754,
        "depth_mm": 30,
        "weight_kg": 21.0,
        "warranty_product_years": 12,
        "warranty_power_years": 25,
        "price_cents": 8500,
        "stock": 80,
        "description": (
            "Módulo PERC de 410 Wp com 108 meias-células, a opção mais acessível "
            "do catálogo. Fiável e amplamente testado, é ideal para ampliar uma "
            "instalação ou para orçamentos contidos."
        ),
    },
]


async def seed_catalog() -> int:
    """Idempotently upsert the catalog into MongoDB.

    Descriptive fields and prices are refreshed; ``stock`` and ``created_at`` are
    only set on first insert so live inventory is preserved across restarts.
    Returns the number of products in the catalog.
    """
    db = get_db_client().solar_p2p
    now = datetime.now(timezone.utc)
    for item in CATALOG:
        descriptive = {k: v for k, v in item.items() if k not in ("stock",)}
        descriptive.update({"active": True, "currency": "eur", "updated_at": now})
        await db.products.update_one(
            {"slug": item["slug"]},
            {
                "$set": descriptive,
                "$setOnInsert": {"stock": item["stock"], "created_at": now},
            },
            upsert=True,
        )
    return len(CATALOG)


async def get_panel_specs_from_products() -> list[PanelSpec]:
    """Build the simulator's recommendation catalog from the real store products.

    The simulator and the store share one source of truth, so recommendations
    map directly to panels the user can actually buy.
    """
    db = get_db_client().solar_p2p
    specs: list[PanelSpec] = []
    async for doc in db.products.find({"active": True}):
        if not doc.get("power_w") or not doc.get("width_mm") or not doc.get("height_mm"):
            continue
        specs.append(
            PanelSpec(
                code=doc["slug"],
                name=doc["name"],
                power_w=doc["power_w"],
                width_mm=doc["width_mm"],
                height_mm=doc["height_mm"],
                efficiency=doc["efficiency"],
                avg_price_eur=doc["price_cents"] / 100,
                category=doc.get("category", ""),
                source_note=f"{doc.get('brand', '')} {doc.get('model', '')} — catálogo Reisolari".strip(),
            )
        )
    return specs

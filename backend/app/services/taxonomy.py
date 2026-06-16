"""Solar-equipment taxonomy: category tree + per-family attribute schemas.

The marketplace ad engine is generic and taxonomy-driven (Mercado Livre / OLX
style): the selected category decides which technical-sheet fields are rendered
and validated. Here we seed the Reisolari (Portugal, solar) vertical. Categories
use their slug as the deterministic ``_id`` so seeding is idempotent and
``parent_id`` references stay stable.
"""

from __future__ import annotations

from app.db.mongo import get_db_client

_TEMPO_USO = {
    "key": "tempo_uso",
    "label": "Tempo de uso",
    "type": "select",
    "options": [
        "Novo (nunca usado)",
        "Menos de 1 ano",
        "1 a 3 anos",
        "3 a 5 anos",
        "Mais de 5 anos",
    ],
}

# Attribute schemas keyed by family. Leaves reference one of these.
ATTRIBUTE_SCHEMAS: dict[str, list[dict]] = {
    "paineis": [
        {"key": "marca", "label": "Marca", "type": "text", "required": True,
         "placeholder": "Ex.: Jinko Solar"},
        {"key": "modelo", "label": "Modelo", "type": "text",
         "placeholder": "Ex.: Tiger Neo 440W"},
        {"key": "potencia_w", "label": "Potência", "type": "number",
         "required": True, "unit": "W"},
        {"key": "eficiencia_pct", "label": "Eficiência", "type": "number", "unit": "%"},
        {"key": "tecnologia", "label": "Tecnologia", "type": "select",
         "options": ["Mono PERC", "Mono TOPCon", "Mono HJT", "IBC", "Policristalino"]},
        {"key": "num_celulas", "label": "Nº de células", "type": "number"},
        _TEMPO_USO,
    ],
    "inversores": [
        {"key": "marca", "label": "Marca", "type": "text", "required": True},
        {"key": "modelo", "label": "Modelo", "type": "text"},
        {"key": "potencia_kw", "label": "Potência", "type": "number", "required": True, "unit": "kW"},
        {"key": "fases", "label": "Fases", "type": "select",
         "options": ["Monofásico", "Trifásico"]},
        {"key": "num_mppt", "label": "Nº de MPPT", "type": "number"},
        {"key": "tensao_v", "label": "Tensão", "type": "number", "unit": "V"},
        _TEMPO_USO,
    ],
    "baterias": [
        {"key": "marca", "label": "Marca", "type": "text", "required": True},
        {"key": "modelo", "label": "Modelo", "type": "text"},
        {"key": "capacidade_kwh", "label": "Capacidade", "type": "number", "required": True, "unit": "kWh"},
        {"key": "quimica", "label": "Química", "type": "select",
         "options": ["LiFePO4", "Li-ion", "Chumbo-ácido", "Gel", "AGM"]},
        {"key": "tensao_v", "label": "Tensão", "type": "number", "unit": "V"},
        {"key": "ciclos", "label": "Ciclos de vida", "type": "number"},
        _TEMPO_USO,
    ],
    "estruturas": [
        {"key": "marca", "label": "Marca", "type": "text"},
        {"key": "material", "label": "Material", "type": "select", "required": True,
         "options": ["Alumínio", "Aço inox", "Aço galvanizado"]},
        {"key": "tipo_montagem", "label": "Tipo de montagem", "type": "select",
         "options": ["Telha cerâmica", "Chapa/sandwich", "Fibrocimento", "Solo", "Coberto plano"]},
        {"key": "num_paineis", "label": "Painéis suportados", "type": "number"},
        _TEMPO_USO,
    ],
    "carregadores": [
        {"key": "marca", "label": "Marca", "type": "text", "required": True},
        {"key": "modelo", "label": "Modelo", "type": "text"},
        {"key": "potencia_kw", "label": "Potência", "type": "number", "required": True, "unit": "kW"},
        {"key": "conector", "label": "Conector", "type": "select",
         "options": ["Type 2", "CCS", "CHAdeMO", "Schuko"]},
        {"key": "fases", "label": "Fases", "type": "select", "options": ["Monofásico", "Trifásico"]},
        _TEMPO_USO,
    ],
    "cabos": [
        {"key": "marca", "label": "Marca", "type": "text"},
        {"key": "seccao_mm2", "label": "Secção", "type": "select",
         "options": ["4 mm²", "6 mm²", "10 mm²", "16 mm²"]},
        {"key": "comprimento_m", "label": "Comprimento", "type": "number", "unit": "m"},
    ],
    "controladores": [
        {"key": "marca", "label": "Marca", "type": "text", "required": True},
        {"key": "modelo", "label": "Modelo", "type": "text"},
        {"key": "corrente_a", "label": "Corrente", "type": "number", "required": True, "unit": "A"},
        {"key": "tensao_max_v", "label": "Tensão máx.", "type": "number", "unit": "V"},
        _TEMPO_USO,
    ],
    "acessorios": [
        {"key": "marca", "label": "Marca", "type": "text"},
        {"key": "modelo", "label": "Modelo", "type": "text"},
        {"key": "tipo", "label": "Tipo", "type": "text"},
        _TEMPO_USO,
    ],
}

# Category tree. Leaves carry "schema"; branches carry "children".
TAXONOMY: list[dict] = [
    {
        "slug": "paineis-solares",
        "name": "Painéis solares",
        "keywords": ["painel", "paineis", "painél", "painéis", "fotovoltaico", "módulo", "modulo",
                     "placa solar", "jinko", "trina", "canadian", "longi", "ja solar", "sunpower", "qcells"],
        "children": [
            {"slug": "paineis-monocristalinos", "name": "Monocristalinos", "schema": "paineis",
             "keywords": ["monocristalino", "mono", "perc", "topcon", "hjt"]},
            {"slug": "paineis-policristalinos", "name": "Policristalinos", "schema": "paineis",
             "keywords": ["policristalino", "poli"]},
            {"slug": "paineis-bifaciais", "name": "Bifaciais", "schema": "paineis",
             "keywords": ["bifacial", "bifaciais"]},
            {"slug": "kits-paineis", "name": "Kits de painéis", "schema": "paineis",
             "keywords": ["kit", "conjunto", "lote"]},
        ],
    },
    {
        "slug": "inversores",
        "name": "Inversores",
        "keywords": ["inversor", "inversores", "huawei", "sma", "fronius", "growatt", "goodwe", "solis", "sungrow"],
        "children": [
            {"slug": "inversores-string", "name": "Inversores string", "schema": "inversores",
             "keywords": ["string", "on-grid", "ongrid", "ligado à rede"]},
            {"slug": "microinversores", "name": "Microinversores", "schema": "inversores",
             "keywords": ["microinversor", "micro", "enphase", "iq"]},
            {"slug": "inversores-hibridos", "name": "Inversores híbridos", "schema": "inversores",
             "keywords": ["híbrido", "hibrido", "hybrid", "off-grid", "offgrid"]},
        ],
    },
    {
        "slug": "baterias",
        "name": "Baterias e armazenamento",
        "keywords": ["bateria", "baterias", "armazenamento", "powerwall", "pylontech", "byd", "lifepo4", "lítio", "litio"],
        "children": [
            {"slug": "baterias-litio", "name": "Baterias de lítio", "schema": "baterias",
             "keywords": ["lítio", "litio", "lifepo4", "li-ion"]},
            {"slug": "baterias-chumbo", "name": "Baterias chumbo-ácido", "schema": "baterias",
             "keywords": ["chumbo", "gel", "agm", "estacionária"]},
        ],
    },
    {
        "slug": "estruturas",
        "name": "Estruturas e suportes",
        "keywords": ["estrutura", "suporte", "fixação", "fixacao", "calha", "perfil", "telhado"],
        "children": [
            {"slug": "estruturas-telhado", "name": "Estruturas de telhado", "schema": "estruturas",
             "keywords": ["telhado", "telha", "coberto"]},
            {"slug": "estruturas-solo", "name": "Estruturas de solo", "schema": "estruturas",
             "keywords": ["solo", "chão", "ground"]},
        ],
    },
    {
        "slug": "carregadores-ev",
        "name": "Carregadores para veículos elétricos",
        "keywords": ["carregador", "wallbox", "veículo elétrico", "veiculo eletrico", "ev", "carro elétrico"],
        "children": [
            {"slug": "wallbox", "name": "Wallbox", "schema": "carregadores",
             "keywords": ["wallbox", "parede", "fixo"]},
            {"slug": "carregadores-portateis", "name": "Carregadores portáteis", "schema": "carregadores",
             "keywords": ["portátil", "portatil", "móvel"]},
        ],
    },
    {
        "slug": "acessorios",
        "name": "Acessórios e cabos",
        "keywords": ["acessório", "acessorio", "cabo", "conector", "mc4", "mppt", "monitor"],
        "children": [
            {"slug": "cabos-solares", "name": "Cabos solares", "schema": "cabos",
             "keywords": ["cabo", "cabos", "fio"]},
            {"slug": "controladores-mppt", "name": "Controladores MPPT", "schema": "controladores",
             "keywords": ["mppt", "controlador", "regulador de carga"]},
            {"slug": "conectores-mc4", "name": "Conectores MC4", "schema": "acessorios",
             "keywords": ["mc4", "conector", "ficha"]},
            {"slug": "monitorizacao", "name": "Monitorização", "schema": "acessorios",
             "keywords": ["monitor", "monitorização", "medidor", "smart meter", "datalogger"]},
        ],
    },
]


def _flatten(nodes: list[dict], parent: dict | None = None, order_start: int = 0):
    """Yield category docs (slug as _id) with resolved parent/path/level/leaf."""
    for order, node in enumerate(nodes, start=order_start):
        parent_path = parent["path"] if parent else []
        parent_labels = parent["path_labels"] if parent else []
        path = parent_path + [node["slug"]]
        path_labels = parent_labels + [node["name"]]
        children = node.get("children", [])
        leaf = not children
        doc = {
            "_id": node["slug"],
            "slug": node["slug"],
            "name": node["name"],
            "parent_id": parent["slug"] if parent else None,
            "path": path,
            "path_labels": path_labels,
            "level": len(path) - 1,
            "leaf": leaf,
            "order": order,
            "keywords": node.get("keywords", []),
            "attribute_schema_key": node.get("schema") if leaf else None,
        }
        yield doc
        if children:
            yield from _flatten(children, doc)


def all_category_docs() -> list[dict]:
    return list(_flatten(TAXONOMY))


def _leaf_index() -> list[dict]:
    """Leaves with keywords inherited from ancestors, for title-based suggestion."""
    docs = all_category_docs()
    by_slug = {d["slug"]: d for d in docs}
    leaves = []
    for doc in docs:
        if not doc["leaf"]:
            continue
        keywords: list[str] = []
        for slug in doc["path"]:
            keywords.extend(by_slug[slug].get("keywords", []))
        leaves.append({**doc, "all_keywords": [k.lower() for k in keywords]})
    return leaves


_LEAVES = _leaf_index()


def suggest_categories(title: str, limit: int = 3) -> list[dict]:
    """Score leaf categories by keyword hits in the title (deterministic, real)."""
    text = (title or "").lower()
    if not text.strip():
        return []
    scored: list[tuple[float, dict]] = []
    for leaf in _LEAVES:
        hits = sum(1 for kw in leaf["all_keywords"] if kw and kw in text)
        if hits:
            scored.append((float(hits), leaf))
    scored.sort(key=lambda item: (-item[0], item[1]["level"]))
    return [
        {
            "category_id": leaf["_id"],
            "name": leaf["name"],
            "path": leaf["path"],
            "path_labels": leaf["path_labels"],
            "score": score,
        }
        for score, leaf in scored[:limit]
    ]


async def seed_taxonomy() -> int:
    """Idempotently upsert categories and attribute schemas. Returns category count."""
    db = get_db_client().solar_p2p
    docs = all_category_docs()
    for doc in docs:
        await db.categories.update_one({"_id": doc["_id"]}, {"$set": doc}, upsert=True)
    for schema_key, fields in ATTRIBUTE_SCHEMAS.items():
        await db.attribute_schemas.update_one(
            {"_id": schema_key},
            {"$set": {"_id": schema_key, "schema_key": schema_key, "fields": fields, "version": 1}},
            upsert=True,
        )
    return len(docs)

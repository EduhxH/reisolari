from typing import Optional

from fastapi import APIRouter, HTTPException, Query, status

from app.api.deps import get_database
from app.schemas.category import (
    AttributeField,
    AttributeSchemaPublic,
    CategoryNode,
    CategoryPublic,
    CategorySuggestion,
    serialize_category,
)
from app.services.taxonomy import suggest_categories

router = APIRouter()


@router.get("/suggest", response_model=list[CategorySuggestion])
async def suggest(title: str = Query(..., min_length=1, max_length=120)):
    """Suggest category paths from a free-text title (keyword/NLP matching)."""
    return suggest_categories(title)


@router.get("/children", response_model=list[CategoryPublic])
async def list_children(parent: Optional[str] = Query(default=None)):
    """Direct children of a category (cascading dropdowns). Omit ``parent`` for roots."""
    db = get_database()
    parent_id = None if parent in (None, "", "root") else parent
    result: list[CategoryPublic] = []
    async for doc in db.categories.find({"parent_id": parent_id}).sort("order", 1):
        has_children = await db.categories.count_documents({"parent_id": doc["_id"]}) > 0
        result.append(serialize_category(doc, has_children))
    return result


@router.get("/", response_model=list[CategoryNode])
async def get_tree():
    """Full taxonomy as a nested tree."""
    db = get_database()
    docs = [doc async for doc in db.categories.find().sort([("level", 1), ("order", 1)])]

    children_of: dict[Optional[str], list[dict]] = {}
    for doc in docs:
        children_of.setdefault(doc.get("parent_id"), []).append(doc)

    def build(parent_id: Optional[str]) -> list[CategoryNode]:
        nodes: list[CategoryNode] = []
        for doc in children_of.get(parent_id, []):
            children = build(doc["_id"])
            base = serialize_category(doc, bool(children)).model_dump()
            nodes.append(CategoryNode(**base, children=children))
        return nodes

    return build(None)


@router.get("/{identifier}/attributes", response_model=AttributeSchemaPublic)
async def get_attributes(identifier: str):
    """Return the dynamic attribute schema (technical sheet) for a leaf category."""
    db = get_database()
    category = await db.categories.find_one({"_id": identifier})
    if category is None:
        category = await db.categories.find_one({"slug": identifier})
    if category is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Categoria não encontrada")

    schema_key = category.get("attribute_schema_key")
    if not schema_key:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Categoria não-folha: selecione uma subcategoria para ver a ficha técnica.",
        )

    schema = await db.attribute_schemas.find_one({"_id": schema_key})
    if schema is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ficha técnica não encontrada")

    return AttributeSchemaPublic(
        schema_key=schema["schema_key"],
        fields=[AttributeField(**field) for field in schema["fields"]],
        version=schema.get("version", 1),
    )

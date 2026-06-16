from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel

AttributeType = Literal["text", "number", "select"]


class AttributeField(BaseModel):
    key: str
    label: str
    type: AttributeType
    required: bool = False
    options: Optional[list[str]] = None
    unit: Optional[str] = None
    placeholder: Optional[str] = None


class AttributeSchemaPublic(BaseModel):
    schema_key: str
    fields: list[AttributeField]
    version: int = 1


class CategoryPublic(BaseModel):
    id: str
    slug: str
    name: str
    parent_id: Optional[str] = None
    path: list[str]
    level: int
    leaf: bool
    order: int = 0
    has_children: bool = False
    attribute_schema_key: Optional[str] = None


class CategoryNode(CategoryPublic):
    children: list["CategoryNode"] = []


class CategorySuggestion(BaseModel):
    category_id: str
    name: str
    path: list[str]
    path_labels: list[str]
    score: float


def serialize_category(doc: dict, has_children: bool = False) -> CategoryPublic:
    return CategoryPublic(
        id=str(doc["_id"]),
        slug=doc["slug"],
        name=doc["name"],
        parent_id=doc.get("parent_id"),
        path=doc.get("path", []),
        level=doc.get("level", 0),
        leaf=doc.get("leaf", False),
        order=doc.get("order", 0),
        has_children=has_children,
        attribute_schema_key=doc.get("attribute_schema_key"),
    )

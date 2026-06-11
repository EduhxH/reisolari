from typing import List, Literal
from pydantic import BaseModel, Field
from bson import ObjectId


class PyObjectId(ObjectId):
    @classmethod
    def __get_pydantic_core_schema__(cls, source, handler):
        from pydantic_core import core_schema

        return core_schema.no_info_after_validator_function(
            cls.validate,
            core_schema.str_schema(),
        )

    @classmethod
    def validate(cls, v: str) -> "PyObjectId":
        return cls(v)


class GeoJSONPoint(BaseModel):
    type: Literal["Point"] = "Point"
    coordinates: List[float] = Field(..., min_length=2, max_length=2)  # [lon, lat]


class GeoJSONPolygon(BaseModel):
    type: Literal["Polygon"] = "Polygon"
    coordinates: List[List[List[float]]]  # [[[lon, lat], ...]]


class ListingBase(BaseModel):
    title: str
    description: str
    price_cents: int
    currency: str = "eur"
    active: bool = True
    location: GeoJSONPoint
    roof_polygon: GeoJSONPolygon
    panel_efficiency: float = 0.205  # 20.5%
    performance_ratio: float = 0.75  # 75%
    installed_power_kwp: float


class ListingCreate(ListingBase):
    owner_id: str


class ListingDB(ListingBase):
    id: PyObjectId = Field(alias="_id")
    owner_id: PyObjectId

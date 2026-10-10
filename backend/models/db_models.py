from datetime import datetime
from typing import Any, Dict, Optional
import uuid as uuid_pkg


class Assessment:
    """Assessment record stored in the MongoDB `assessments` collection."""

    FIELDS = (
        "site_name", "latitude", "longitude", "roof_area", "roof_material",
        "roof_condition", "soil_type", "annual_rainfall", "water_demand",
        "site_photos", "assessment_data", "recommendations",
        "created_at", "updated_at", "is_synced",
    )

    def __init__(self, id: Optional[str] = None, **kwargs: Any):
        now = datetime.now()
        self.id = str(id) if id else str(uuid_pkg.uuid4())
        self.site_name = kwargs.get("site_name")
        self.latitude = kwargs.get("latitude")
        self.longitude = kwargs.get("longitude")
        self.roof_area = kwargs.get("roof_area")
        self.roof_material = kwargs.get("roof_material")
        self.roof_condition = kwargs.get("roof_condition", "good")
        self.soil_type = kwargs.get("soil_type")
        self.annual_rainfall = kwargs.get("annual_rainfall")
        self.water_demand = kwargs.get("water_demand")
        self.site_photos = kwargs.get("site_photos")
        self.assessment_data = kwargs.get("assessment_data") or {}
        self.recommendations = kwargs.get("recommendations") or {}
        self.created_at = kwargs.get("created_at") or now
        self.updated_at = kwargs.get("updated_at") or now
        self.is_synced = kwargs.get("is_synced", True)

    def to_doc(self) -> Dict[str, Any]:
        doc = {field: getattr(self, field) for field in self.FIELDS}
        doc["_id"] = self.id
        return doc

    def to_dict(self) -> Dict[str, Any]:
        data = {field: getattr(self, field) for field in self.FIELDS}
        data["id"] = self.id
        return data

    @classmethod
    def from_doc(cls, doc: Dict[str, Any]) -> "Assessment":
        doc = dict(doc)
        return cls(id=doc.pop("_id"), **{k: v for k, v in doc.items() if k in cls.FIELDS})


class LocalConfig:
    """Regional configuration stored in the MongoDB `local_configs` collection."""

    def __init__(self, region: str, rainfall_data=None, soil_data=None, cost_data=None, tariff_data=None):
        self.id = str(uuid_pkg.uuid4())
        self.region = region
        self.rainfall_data = rainfall_data or {}
        self.soil_data = soil_data or {}
        self.cost_data = cost_data or {}
        self.tariff_data = tariff_data or {}
        self.created_at = datetime.now()

    def to_doc(self) -> Dict[str, Any]:
        return {
            "_id": self.id, "region": self.region, "rainfall_data": self.rainfall_data,
            "soil_data": self.soil_data, "cost_data": self.cost_data,
            "tariff_data": self.tariff_data, "created_at": self.created_at,
        }

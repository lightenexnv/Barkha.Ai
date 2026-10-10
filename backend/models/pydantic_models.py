from pydantic import BaseModel, field_validator
from typing import Optional, List, Dict, Any, Literal

class SiteDetailsInput(BaseModel):
    site_name: str
    latitude: float
    longitude: float
    roof_area: float
    roof_material: str
    roof_condition: str = "good"
    soil_type: str
    annual_rainfall: float
    water_demand: float = 0
    # Optional user preferences from the Settings page
    water_tariff: Optional[float] = None
    first_flush_mm: Optional[float] = None
    # Location-derived climate data (filled automatically by the frontend)
    monthly_rainfall: Optional[List[float]] = None
    rainfall_source: Optional[str] = None
    rainfall_period: Optional[str] = None
    city: Optional[str] = None
    district: Optional[str] = None
    state: Optional[str] = None
    # Roof boundary from pin-to-roof detection, as [[lat, lon], ...]
    roof_polygon: Optional[List[List[float]]] = None

    @field_validator('roof_area')
    def validate_roof_area(cls, v):
        if v <= 0:
            raise ValueError('Roof area must be positive')
        return v
    
    @field_validator('annual_rainfall')
    def validate_rainfall(cls, v):
        if v < 0:
            raise ValueError('Rainfall cannot be negative')
        return v

    @field_validator('water_demand')
    def validate_demand(cls, v):
        if v < 0:
            raise ValueError('Water demand cannot be negative')
        return v

class AssessmentResult(BaseModel):
    assessment_id: str
    harvestable_volume: float
    recommended_option: str
    storage_recommendation: Dict[str, Any]
    recharge_recommendation: Dict[str, Any]
    cost_analysis: Dict[str, Any]
    savings_analysis: Dict[str, Any]
    safety_checks: List[str]
    bill_of_quantities: Dict[str, Any]
    payback_period: Optional[str] = None
    additional_info: Optional[Dict[str, Any]] = None
    financial_statement: Optional[Dict[str, Any]] = None
    subsidies: Optional[Dict[str, Any]] = None
    dossiers: Optional[List[Dict[str, Any]]] = None
    hydrology: Optional[Dict[str, Any]] = None


class RoofDetectionRequest(BaseModel):
    latitude: float
    longitude: float

    @field_validator('latitude')
    def validate_lat(cls, v):
        if not -85 <= v <= 85:
            raise ValueError('Latitude out of range')
        return v

    @field_validator('longitude')
    def validate_lon(cls, v):
        if not -180 <= v <= 180:
            raise ValueError('Longitude out of range')
        return v


class DirectReportRequest(BaseModel):
    """Assessment data sent by the client when the server has no stored record."""
    site: Dict[str, Any]
    result: Dict[str, Any]
    format: Literal["pdf", "txt", "zip"] = "pdf"

class ConfigData(BaseModel):
    region: str
    rainfall_data: Dict[str, float]
    soil_data: Dict[str, Any]
    cost_data: Dict[str, float]
    tariff_data: Dict[str, float]
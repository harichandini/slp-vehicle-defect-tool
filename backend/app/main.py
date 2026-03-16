from __future__ import annotations

import os
from typing import Optional

import requests
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from .geography import build_state_data, fetch_complaints_for_geography
from .nhtsa import NHTSAClient, analyze_complaints, build_geography_analysis, build_yearly_trend
from .search import ComplaintSearcher

app = FastAPI(title="SLP Vehicle Defect Tool", version="0.1.0")
client = NHTSAClient()
cors_origins = [origin.strip() for origin in os.getenv("CORS_ORIGINS", "").split(",") if origin.strip()]
cors_origin_regex = os.getenv("CORS_ORIGIN_REGEX", r"https?://(localhost|127\.0\.0\.1)(:\d+)?$")
EMPTY_SEVERITY = {
    "crash": 0,
    "fire": 0,
    "injury": 0,
    "stall": 0,
    "transmission": 0,
}
EMPTY_DATA_MESSAGE = "No complaints or recalls were found for this model in the selected year."

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_origin_regex=None if cors_origins else cors_origin_regex,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/metadata/years")
def metadata_years():
    try:
        return {"years": client.get_metadata_years()}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/metadata/makes")
def metadata_makes(year: str):
    try:
        return {"makes": client.get_metadata_makes(year=year)}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/metadata/models")
def metadata_models(year: str, make: str):
    try:
        return {"models": client.get_metadata_models(year=year, make=make)}
    except requests.RequestException:
        return {"models": []}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


def empty_vehicle_response(vehicle: dict[str, Optional[str]]) -> dict[str, object]:
    return {
        "vehicle": vehicle,
        "recall_count": 0,
        "complaint_count": 0,
        "recalls": [],
        "defect_patterns": {},
        "severity": EMPTY_SEVERITY,
        "trend": {},
        "geography": build_geography_analysis([]),
        "complaints": [],
        "message": EMPTY_DATA_MESSAGE,
    }


def build_vehicle_response(make: str, model: str, year: str, vin: Optional[str] = None, decoded: Optional[dict] = None):
    vehicle = {
        "vin": vin,
        "make": make,
        "model": model,
        "year": year,
        "trim": decoded.get("Trim") if decoded else None,
        "engine": decoded.get("EngineCylinders") if decoded else None,
    }

    try:
        recalls = client.get_recalls(make=make, model=model, year=year)
        complaints = client.get_complaints(make=make, model=model, year=year)
    except requests.RequestException:
        return empty_vehicle_response(vehicle)

    if not recalls and not complaints:
        return empty_vehicle_response(vehicle)

    analysis = analyze_complaints(complaints)
    yearly_trend = build_yearly_trend(complaints=complaints, recalls=recalls)

    return {
        "vehicle": vehicle,
        "recall_count": len(recalls),
        "complaint_count": analysis["complaint_count"],
        "recalls": recalls[:20],
        "defect_patterns": analysis["top_components"],
        "severity": analysis["severity"],
        "trend": yearly_trend,
        "geography": analysis["geography"],
        "complaints": analysis["enriched_complaints"][:100],
    }


@app.get("/api/vehicle")
def vehicle_lookup(vin: str = Query(...)):
    try:
        decoded = client.decode_vin(vin)
        make = decoded.get("Make")
        model = decoded.get("Model")
        year = decoded.get("ModelYear")
        if not all([make, model, year]):
            raise HTTPException(status_code=400, detail="VIN decode did not return make, model, and year")
        return build_vehicle_response(make=make, model=model, year=year, vin=vin, decoded=decoded)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/vehicle-search")
@app.get("/api/vehicle-search")
def vehicle_search(make: str, model: str, year: str):
    try:
        return build_vehicle_response(make=make, model=model, year=year)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/api/search")
def semantic_search(
    query: str,
    make: str,
    model: str,
    year: str,
    limit: int = 5,
):
    try:
        complaints = client.get_complaints(make=make, model=model, year=year)
        searcher = ComplaintSearcher(complaints)
        return {
            "query": query,
            "results": searcher.search(query, k=limit),
        }
    except requests.RequestException:
        return {
            "query": query,
            "results": [],
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.get("/complaints/geography")
def complaints_geography(make: str, model: str, year: str | None = Query(default=None)):
    try:
        complaints = fetch_complaints_for_geography(client=client, make=make, model=model, year=year)
        return {
            "stateData": build_state_data(complaints),
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

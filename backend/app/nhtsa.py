from __future__ import annotations

import re
from collections import Counter, defaultdict
from typing import Any

import requests

BASE_API = "https://api.nhtsa.gov"
PRODUCTS_API = "https://api.nhtsa.gov/products/vehicle"
VIN_API = "https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/{vin}?format=json"
TIMEOUT = 30


class NHTSAClient:
    def __init__(self) -> None:
        self.session = requests.Session()

    def get_metadata_years(self) -> list[str]:
        response = self.session.get(f"{PRODUCTS_API}/modelYears", params={"issueType": "c"}, timeout=TIMEOUT)
        response.raise_for_status()
        results = response.json().get("results", [])
        years = {
            str(item.get("modelYear", "")).strip()
            for item in results
            if str(item.get("modelYear", "")).strip()
        }
        return sorted(years, reverse=True)

    def get_metadata_makes(self, year: str | int) -> list[str]:
        response = self.session.get(
            f"{PRODUCTS_API}/makes",
            params={"modelYear": str(year), "issueType": "c"},
            timeout=TIMEOUT,
        )
        response.raise_for_status()
        results = response.json().get("results", [])
        makes = {
            str(item.get("make", "")).strip()
            for item in results
            if str(item.get("make", "")).strip()
        }
        return sorted(makes)

    def get_metadata_models(self, year: str | int, make: str) -> list[str]:
        response = self.session.get(
            f"{PRODUCTS_API}/models",
            params={"modelYear": str(year), "make": make, "issueType": "c"},
            timeout=TIMEOUT,
        )
        response.raise_for_status()
        results = response.json().get("results", [])
        models = {
            str(item.get("model", "")).strip()
            for item in results
            if str(item.get("model", "")).strip()
        }
        return sorted(models)

    def decode_vin(self, vin: str) -> dict[str, Any]:
        response = self.session.get(VIN_API.format(vin=vin), timeout=TIMEOUT)
        response.raise_for_status()
        data = response.json().get("Results", [])
        if not data:
            raise ValueError("VIN decode returned no results")
        return data[0]

    def get_recalls(self, make: str, model: str, year: str | int) -> list[dict[str, Any]]:
        params = {"make": make, "model": model, "modelYear": str(year)}
        response = self.session.get(f"{BASE_API}/recalls/recallsByVehicle", params=params, timeout=TIMEOUT)
        response.raise_for_status()
        return response.json().get("results", [])

    def get_complaints(self, make: str, model: str, year: str | int) -> list[dict[str, Any]]:
        params = {"make": make, "model": model, "modelYear": str(year)}
        response = self.session.get(f"{BASE_API}/complaints/complaintsByVehicle", params=params, timeout=TIMEOUT)
        response.raise_for_status()
        return response.json().get("results", [])


SEVERITY_TERMS = {
    "crash": ["crash", "collision", "rear-ended", "hit", "accident"],
    "fire": ["fire", "smoke", "burn", "burning", "flames"],
    "injury": ["injury", "injured", "hospital", "hurt", "bleeding"],
    "stall": ["stall", "stalled", "lost power", "shut off"],
    "transmission": ["transmission", "gear", "shift", "slip", "jerk"],
}

STATE_PATTERN = re.compile(r"\b([A-Z]{2})\b")
YEAR_PATTERN = re.compile(r"(19|20)\d{2}")
COMPLAINT_DATE_KEYS = ("dateComplaintFiled", "date", "incidentDate")
RECALL_DATE_KEYS = ("ReportReceivedDate", "reportReceivedDate", "reportreceiveddate")
INJURY_KEYS = ("numberOfInjuries", "NumberOfInjuries", "injuryCount", "injuries")
FIRE_KEYS = ("fire", "Fire", "fireOccurred", "fireOccured", "FireOccurred")
CRASH_KEYS = ("crash", "Crash", "crashOccurred", "crashOccured", "CrashOccurred")
STATE_TO_REGION = {
    "CT": "Northeast",
    "ME": "Northeast",
    "MA": "Northeast",
    "NH": "Northeast",
    "RI": "Northeast",
    "VT": "Northeast",
    "NJ": "Northeast",
    "NY": "Northeast",
    "PA": "Northeast",
    "IL": "Midwest",
    "IN": "Midwest",
    "MI": "Midwest",
    "OH": "Midwest",
    "WI": "Midwest",
    "IA": "Midwest",
    "KS": "Midwest",
    "MN": "Midwest",
    "MO": "Midwest",
    "NE": "Midwest",
    "ND": "Midwest",
    "SD": "Midwest",
    "DE": "South",
    "DC": "South",
    "FL": "South",
    "GA": "South",
    "MD": "South",
    "NC": "South",
    "SC": "South",
    "VA": "South",
    "WV": "South",
    "AL": "South",
    "KY": "South",
    "MS": "South",
    "TN": "South",
    "AR": "South",
    "LA": "South",
    "OK": "South",
    "TX": "South",
    "AZ": "West",
    "CO": "West",
    "ID": "West",
    "MT": "West",
    "NV": "West",
    "NM": "West",
    "UT": "West",
    "WY": "West",
    "AK": "West",
    "CA": "West",
    "HI": "West",
    "OR": "West",
    "WA": "West",
}
GEOGRAPHY_UNAVAILABLE = "Geographic complaint detail is not available for this vehicle in the current dataset."


def complaint_text(complaint: dict[str, Any]) -> str:
    parts = [
        complaint.get("summary", ""),
        complaint.get("complaintSummary", ""),
        complaint.get("component", ""),
    ]
    return " ".join(p for p in parts if p).strip()


def normalize_component(complaint: dict[str, Any]) -> str:
    component = (
        complaint.get("components")
        or complaint.get("component")
        or complaint.get("Component")
        or "UNKNOWN"
    )
    if isinstance(component, list):
        component = component[0] if component else "UNKNOWN"
    return str(component).strip() or "UNKNOWN"


def extract_state(complaint: dict[str, Any]) -> str | None:
    for key in ["state", "State", "consumerLocation", "cityState", "location"]:
        value = complaint.get(key)
        if not value:
            continue
        if isinstance(value, str):
            match = STATE_PATTERN.search(value.upper())
            if match:
                return match.group(1)
    return None


def first_present(item: dict[str, Any], keys: tuple[str, ...]) -> Any:
    for key in keys:
        value = item.get(key)
        if value not in (None, ""):
            return value
    return None


def extract_year(value: Any) -> str | None:
    if value in (None, ""):
        return None
    match = YEAR_PATTERN.search(str(value))
    if not match:
        return None
    return match.group(0)


def coerce_int(value: Any) -> int:
    if value in (None, ""):
        return 0
    if isinstance(value, bool):
        return int(value)
    if isinstance(value, (int, float)):
        return int(value)
    match = re.search(r"-?\d+", str(value).replace(",", ""))
    if not match:
        return 0
    return int(match.group(0))


def is_yes(value: Any) -> bool:
    if value in (None, ""):
        return False
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return value > 0
    return str(value).strip().lower() in {"y", "yes", "true", "1"}


def build_yearly_trend(complaints: list[dict[str, Any]], recalls: list[dict[str, Any]]) -> dict[str, dict[str, int]]:
    yearly = defaultdict(
        lambda: {
            "complaints": 0,
            "recalls": 0,
            "injuries": 0,
            "fires": 0,
            "crashes": 0,
        }
    )

    for complaint in complaints:
        year = extract_year(first_present(complaint, COMPLAINT_DATE_KEYS))
        if not year:
            continue
        bucket = yearly[year]
        bucket["complaints"] += 1
        bucket["injuries"] += max(0, coerce_int(first_present(complaint, INJURY_KEYS)))
        if is_yes(first_present(complaint, FIRE_KEYS)):
            bucket["fires"] += 1
        if is_yes(first_present(complaint, CRASH_KEYS)):
            bucket["crashes"] += 1

    for recall in recalls:
        year = extract_year(first_present(recall, RECALL_DATE_KEYS))
        if not year:
            continue
        yearly[year]["recalls"] += 1

    return {year: yearly[year] for year in sorted(yearly)}


def build_geography_distribution(complaints: list[dict[str, Any]]) -> dict[str, int]:
    state_counts = Counter()

    for complaint in complaints:
        state = extract_state(complaint)
        if state:
            state_counts[state] += 1

    return dict(state_counts.most_common())


def build_geography_analysis(complaints: list[dict[str, Any]]) -> dict[str, Any]:
    state_counts = build_geography_distribution(complaints)
    if not state_counts:
        return {
            "state_counts": {},
            "region_counts": {},
            "classification": "Unknown",
            "summary": GEOGRAPHY_UNAVAILABLE,
        }

    total = sum(state_counts.values())
    states = list(state_counts.items())
    top_state, top_state_count = states[0]
    top_state_share = top_state_count / total
    top_three_share = sum(count for _, count in states[:3]) / total
    distinct_states = len(state_counts)

    region_counts = Counter()
    for state, count in state_counts.items():
        region = STATE_TO_REGION.get(state)
        if region:
            region_counts[region] += count

    if distinct_states < 3 or top_state_share > 0.60:
        classification = "Localized"
        summary = (
            f"Complaint locations appear localized, with usable state data concentrated in {distinct_states} "
            f"states and led by {top_state} at {round(top_state_share * 100)}% of complaints."
        )
    elif distinct_states >= 9 and top_three_share < 0.70:
        classification = "Nationwide"
        summary = (
            f"Complaint locations appear nationwide, spanning {distinct_states} states across "
            f"{len(region_counts) or 1} regions, with the top three states accounting for "
            f"{round(top_three_share * 100)}% of complaints."
        )
    else:
        classification = "Regional"
        summary = (
            f"Complaint locations appear regional, spanning {distinct_states} states across "
            f"{len(region_counts) or 1} regions and led by {top_state} at {round(top_state_share * 100)}% of complaints."
        )

    return {
        "state_counts": state_counts,
        "region_counts": dict(region_counts.most_common()),
        "classification": classification,
        "summary": summary,
    }


def analyze_complaints(complaints: list[dict[str, Any]]) -> dict[str, Any]:
    component_counts = Counter()
    year_counts = Counter()
    severity = Counter()

    enriched: list[dict[str, Any]] = []

    for item in complaints:
        text = complaint_text(item).lower()
        component = normalize_component(item)
        component_counts[component] += 1

        state = extract_state(item)

        date = first_present(item, COMPLAINT_DATE_KEYS) or ""
        year = extract_year(date)
        if year:
            year_counts[year] += 1

        tags = []
        for label, keywords in SEVERITY_TERMS.items():
            if any(k in text for k in keywords):
                severity[label] += 1
                tags.append(label)

        enriched.append(
            {
                "id": item.get("odiNumber") or item.get("ODINumber") or item.get("complaintNumber"),
                "component": component,
                "summary": complaint_text(item),
                "date": date,
                "state": state,
                "tags": tags,
                "raw": item,
            }
        )

    return {
        "complaint_count": len(complaints),
        "top_components": component_counts.most_common(10),
        "severity": dict(severity),
        "geography": build_geography_analysis(complaints),
        "year_counts": dict(sorted(year_counts.items())),
        "enriched_complaints": enriched,
    }

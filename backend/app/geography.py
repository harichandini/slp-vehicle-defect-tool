from __future__ import annotations

import re
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from typing import Any

from .nhtsa import NHTSAClient

STATE_NAME_TO_CODE = {
    "Alabama": "AL",
    "Alaska": "AK",
    "Arizona": "AZ",
    "Arkansas": "AR",
    "California": "CA",
    "Colorado": "CO",
    "Connecticut": "CT",
    "Delaware": "DE",
    "Florida": "FL",
    "Georgia": "GA",
    "Hawaii": "HI",
    "Idaho": "ID",
    "Illinois": "IL",
    "Indiana": "IN",
    "Iowa": "IA",
    "Kansas": "KS",
    "Kentucky": "KY",
    "Louisiana": "LA",
    "Maine": "ME",
    "Maryland": "MD",
    "Massachusetts": "MA",
    "Michigan": "MI",
    "Minnesota": "MN",
    "Mississippi": "MS",
    "Missouri": "MO",
    "Montana": "MT",
    "Nebraska": "NE",
    "Nevada": "NV",
    "New Hampshire": "NH",
    "New Jersey": "NJ",
    "New Mexico": "NM",
    "New York": "NY",
    "North Carolina": "NC",
    "North Dakota": "ND",
    "Ohio": "OH",
    "Oklahoma": "OK",
    "Oregon": "OR",
    "Pennsylvania": "PA",
    "Rhode Island": "RI",
    "South Carolina": "SC",
    "South Dakota": "SD",
    "Tennessee": "TN",
    "Texas": "TX",
    "Utah": "UT",
    "Vermont": "VT",
    "Virginia": "VA",
    "Washington": "WA",
    "West Virginia": "WV",
    "Wisconsin": "WI",
    "Wyoming": "WY",
}
STATE_CODE_TO_NAME = {code: name for name, code in STATE_NAME_TO_CODE.items()}
STATE_NAME_PATTERN = re.compile(
    r"\b(" + "|".join(re.escape(name) for name in sorted(STATE_NAME_TO_CODE, key=len, reverse=True)) + r")\b",
    re.IGNORECASE,
)
STATE_CODE_PATTERN = re.compile(r"\b(" + "|".join(sorted(STATE_CODE_TO_NAME)) + r")\b")
MIN_YEAR = 2000
YEAR_BATCH_SIZE = 8


def extract_state_from_summary(summary: str) -> str | None:
    if not summary:
        return None

    name_match = STATE_NAME_PATTERN.search(summary)
    if name_match:
        matched_name = name_match.group(1).lower()
        for name, code in STATE_NAME_TO_CODE.items():
            if name.lower() == matched_name:
                return code

    code_match = STATE_CODE_PATTERN.search(summary)
    if code_match:
        return code_match.group(1)

    return None


def build_state_data(complaints: list[dict[str, Any]]) -> list[dict[str, Any]]:
    counts = Counter()

    for complaint in complaints:
        summary = str(complaint.get("summary") or complaint.get("complaintSummary") or "")
        state_code = extract_state_from_summary(summary)
        if state_code:
            counts[state_code] += 1

    return [
        {
            "state": STATE_CODE_TO_NAME[state_code],
            "stateCode": state_code,
            "count": count,
        }
        for state_code, count in counts.most_common()
        if state_code in STATE_CODE_TO_NAME
    ]


def fetch_complaints_for_geography(
    client: NHTSAClient,
    make: str,
    model: str,
    year: str | int | None = None,
) -> list[dict[str, Any]]:
    if year not in (None, ""):
        return client.get_complaints(make=make, model=model, year=str(year))

    current_year = datetime.now().year
    years = [str(value) for value in range(MIN_YEAR, current_year + 1)]
    complaints: list[dict[str, Any]] = []

    for start in range(0, len(years), YEAR_BATCH_SIZE):
        batch = years[start : start + YEAR_BATCH_SIZE]
        with ThreadPoolExecutor(max_workers=YEAR_BATCH_SIZE) as executor:
            futures = [executor.submit(client.get_complaints, make, model, batch_year) for batch_year in batch]
            for future in futures:
                try:
                    complaints.extend(future.result())
                except Exception:
                    continue

    return complaints

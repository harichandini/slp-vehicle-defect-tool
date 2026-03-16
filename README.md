# SLP Vehicle Defect Tool

## Project Overview

This project is a take-home MVP for an attorney intake workflow focused on vehicle defect screening.

The app helps an intake coordinator or attorney answer a practical first question: does a caller's vehicle issue look isolated, or does it show signs of a broader defect pattern? To support that workflow, the app pulls live NHTSA data, summarizes recalls and complaints, surfaces severity indicators, and presents the results in a compact review interface.

The current MVP supports:

- Search by VIN
- Search by vehicle make, year, and model
- Recall lookup
- Complaint lookup
- Defect pattern and top-component summaries
- Severity indicators for crashes, injuries, fires, stalls, and transmission issues
- A case strength score
- Yearly defect trend visualization
- Complaint geography when state-like data is available
- Symptom-based complaint search

## Screenshots

### Home Page
<img width="1440" height="900" alt="Home Page" src="https://github.com/user-attachments/assets/fefe7a36-6869-4c0a-bb15-7484c5c3d750" />

### Vechile Search Result
<img width="1440" height="900" alt="Example Vehicle Search Result" src="https://github.com/user-attachments/assets/4e0cdf3c-1953-49c9-859f-a1471e8c175f" />

### VIN Lookup Result
<img width="1440" height="900" alt="VIN Lookup Result" src="https://github.com/user-attachments/assets/171202f8-79c3-4628-a912-034aba1e98ea" />

### Detailed Review
<img width="1440" height="900" alt="Detailed Review- Trends Recall " src="https://github.com/user-attachments/assets/198248b9-e012-4573-a7a4-45eb0c899254" />

## User Workflow

1. Open the app and choose either `Search by VIN` or `Search by Vehicle`.
2. Enter a VIN, or select a make, year, and model.
3. Submit the search.
4. Review the returned vehicle snapshot, recall count, complaint count, case strength score, and severity indicators.
5. Review top defect components, recall campaigns, yearly trend data, and complaint geography.
6. Optionally run a symptom search to find complaint narratives similar to a caller's description.

The intended use is fast intake triage, not final case evaluation.

## Architecture

### Frontend

- React + Vite single-page application
- Recharts for trend and geography visualizations
- One primary results page that renders search, scoring, charts, and complaint excerpts

### Backend

- FastAPI API service
- `requests` for live NHTSA API calls
- Lightweight analysis helpers for:
  - complaint severity tagging
  - top-component aggregation
  - yearly trend aggregation
  - geography distribution
- TF-IDF + cosine similarity for symptom search

### Data Flow

1. The frontend sends either:
   - `GET /api/vehicle?vin=...`, or
   - `GET /vehicle-search?make=...&model=...&year=...`
2. The backend fetches live recall and complaint data from NHTSA.
3. The backend transforms the raw response into a normalized result payload:
   - vehicle metadata
   - recalls
   - complaints
   - defect patterns
   - severity metrics
   - yearly trend data
   - geography distribution
4. The frontend renders the results.
5. If the user runs symptom search, the frontend calls `GET /api/search` and the backend returns the most similar complaint summaries.

## Repository Structure

```text
slp-vehicle-defect-tool/
|-- backend/
|   |-- app/
|   |   |-- main.py
|   |   |-- nhtsa.py
|   |   `-- search.py
|   `-- requirements.txt
|-- frontend/
|   |-- src/
|   |   |-- App.jsx
|   |   |-- main.jsx
|   |   `-- styles.css
|   |-- index.html
|   `-- package.json
`-- README.md
```

## Setup Instructions

Run the backend and frontend in separate terminals from the repository root.

### Backend

Windows PowerShell:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

macOS/Linux:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend defaults to `http://127.0.0.1:8000` for the backend.

If the backend runs on another port, set `VITE_API_BASE_URL` before starting the frontend:

PowerShell:

```powershell
$env:VITE_API_BASE_URL="http://127.0.0.1:8001"
npm run dev
```

Bash:

```bash
export VITE_API_BASE_URL="http://127.0.0.1:8001"
npm run dev
```

## APIs Used

This project uses live NHTSA data.

- NHTSA vPIC VIN Decode API
  - used to decode VINs into make, model, and year
- NHTSA Recalls API
  - used to retrieve recalls by vehicle
- NHTSA Complaints API
  - used to retrieve complaints by vehicle
- NHTSA Products Vehicle Models API
  - used to retrieve model metadata for the selected make and year

## Backend Endpoints

### `GET /api/vehicle`

Inputs:

- `vin`

Returns a normalized vehicle defect response using VIN decode plus recall and complaint lookup.

### `GET /vehicle-search`

Inputs:

- `make`
- `model`
- `year`

Returns the same normalized response shape as VIN search, without VIN decode.

### `GET /metadata/models`

Inputs:

- `make`
- `year`

Returns the supported model list for the vehicle search dropdown.

### `GET /api/search`

Inputs:

- `query`
- `make`
- `model`
- `year`
- `limit`

Returns the most similar complaint narratives for a symptom phrase.

## Assumptions

- The app is intended for local demo or take-home review, not deployment-grade production use.
- Live NHTSA APIs are available during use.
- Complaint text and metadata are incomplete or inconsistent across vehicle records, so the UI should degrade gracefully.
- The case strength score is a screening heuristic, not a legal conclusion or predictive model.
- State-level geography is sufficient for this MVP when location detail exists.

## Tradeoffs

- Live API calls keep the system simple and easy to review, but external latency and response variability are outside the app's control.
- Keyword-based severity detection is transparent and fast, but less precise than a trained NLP pipeline.
- TF-IDF symptom search is lightweight and explainable, but less semantically capable than embeddings-based retrieval.
- A single-page UI keeps the workflow compact, but it limits deeper drill-down and filtering.
- The score is deterministic and easy to inspect, but not calibrated against case outcomes.

## Limitations

- The app depends on NHTSA uptime and response quality.
- Some vehicles return sparse or missing complaint geography data.
- Complaint records are not fully normalized, so certain injury, fire, or crash fields may vary by source record.
- The current search experience is optimized for clarity over completeness; it does not include advanced filters, saved searches, or exports.
- There is no persistence, caching, authentication, or background ingestion pipeline.
- Testing coverage is limited; this submission focuses on the working end-to-end product flow.

## AI Tools Used

AI tools were used as implementation accelerators, not as a substitute for product judgment or code review.

- ChatGPT
  - used for early brainstorming, structure exploration, and rough drafting
- Codex
  - used for repository-local implementation, debugging, UI refinement, and documentation cleanup

All generated code and documentation were manually reviewed and adjusted.

## Future Improvements

Given more time, I would prioritize the following next steps:

1. Add caching or persistence to reduce repeated live API calls.
2. Add automated tests around backend transforms and frontend rendering edge cases.
3. Improve complaint search with embeddings or hybrid retrieval.
4. Expand filtering by component, severity, year range, and geography.
5. Add intake-summary export for internal case review.
6. Improve recall presentation with stronger manufacturer-remedy summaries.
7. Add richer analytics around repeat defect themes and model-year comparisons.
8. Add deployment configuration and environment-specific settings.

## Submission Notes

This solution is intentionally pragmatic. The focus was to deliver a clear end-to-end intake workflow that works locally, uses real public data, and makes engineering tradeoffs that are easy for a reviewer to inspect.

For a take-home submission, that felt more defensible than overbuilding infrastructure or adding speculative complexity that would not materially improve the review experience.

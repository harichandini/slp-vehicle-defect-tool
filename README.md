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
#### Vehicle Defect Trends by Year
<img width="1440" height="900" alt="Vehicle Defect Trends by Year" src="https://github.com/user-attachments/assets/8ff6b86f-cbc4-4101-a06b-36a17629943c" />

#### Geographic Distribution
<img width="1440" height="900" alt="Geographic Distribution" src="https://github.com/user-attachments/assets/e19d636b-aac4-43ea-b304-29c3b2934cca" />

## User Workflow

1. Open the app and choose either `Search by VIN` or `Search by Vehicle`.
2. Enter a VIN, or select a make, year, and model.
3. Submit the search.
4. Review the returned vehicle snapshot, recall count, complaint count, case strength score, and severity indicators.
5. Review top defect components, recall campaigns, yearly trend data, and complaint geography.
6. Optionally run a symptom search to find complaint narratives similar to a caller's description.

The intended use is fast intake triage, not final case evaluation.

## Architecture

The application is intentionally small and reviewable. It is split into a thin frontend presentation layer and a backend service that handles external API calls plus lightweight domain-specific analysis.

### Frontend

- React + Vite single-page application
- Recharts for trend and summary visualizations
- Focused intake dashboard for:
  - search input
  - vehicle snapshot
  - scoring and severity summaries
  - trends, geography, recalls, and complaint excerpts

### Backend

- FastAPI service that acts as the system boundary to NHTSA
- `requests` for live VIN, recall, complaint, and metadata lookups
- Lightweight analysis helpers for:
  - complaint severity tagging
  - top-component aggregation
  - yearly trend aggregation
  - complaint geography estimation from free-text summaries
- TF-IDF + cosine similarity for symptom search

### Why This Shape

- It keeps the app easy to run locally and easy to inspect during review.
- It avoids unnecessary infrastructure for a take-home scope.
- It centralizes NHTSA-specific logic in the backend so the UI can stay focused on workflow and presentation.

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

- The intended usage is local demo or take-home review, not production deployment.
- Live NHTSA endpoints are available and responsive during evaluation.
- Complaint records are noisy and partially structured, so the product should degrade gracefully when fields are missing or inconsistent.
- The case strength score is a triage heuristic only. It is meant to support intake review, not replace legal judgment.
- Geographic distribution is estimated from free-text complaint summaries and is inherently incomplete.
- A reviewer benefits more from a clear, inspectable implementation than from heavier infrastructure or speculative optimization.

## Tradeoffs

- Live API calls keep the architecture simple and the data fresh, but they introduce dependency on third-party latency and uptime.
- The backend favors deterministic heuristics over opaque models so the behavior is easier to review and reason about in a take-home setting.
- Keyword-based severity tagging is fast and transparent, but it will miss nuance that a richer NLP pipeline could capture.
- TF-IDF symptom search is lightweight and explainable, but less capable than embeddings-based retrieval for semantic matching.
- The single-page dashboard optimizes for fast intake triage, but it intentionally leaves out deeper drill-down, saved views, and workflow state.
- The geographic view is useful directional context, but it is an estimate rather than a canonical structured location dataset.

## Limitations

- The app depends on NHTSA uptime and response quality.
- Some vehicles return sparse or missing complaint geography data.
- Complaint records are not fully normalized, so certain injury, fire, or crash fields may vary by source record.
- The current search experience is optimized for clarity over completeness; it does not include advanced filters, saved searches, or exports.
- There is no persistence, caching, authentication, or background ingestion pipeline.
- Testing coverage is limited; this submission focuses on the working end-to-end product flow.

## AI Tools Used

AI tools were used as accelerators for implementation and iteration, not as a substitute for engineering judgment.

- ChatGPT was used for early brainstorming, feature framing, and rough drafting.
- Codex was used for repository-local implementation, debugging, UI refinement, and documentation cleanup.

All generated output was reviewed, edited, and validated in the local project context before being kept.

## Future Improvements

Given more time, I would prioritize the following next steps:

1. Add automated tests around backend transforms, API failure handling, and frontend rendering edge cases.
2. Introduce caching or persistence to reduce repeated live NHTSA calls and improve responsiveness.
3. Improve complaint search with embeddings or hybrid retrieval instead of pure TF-IDF.
4. Expand analyst controls with filtering by component, severity, geography, and year range.
5. Improve the geographic pipeline with a stronger extraction strategy and confidence scoring.
6. Add exportable intake summaries for case review workflows.
7. Improve recall presentation with clearer remedy and consequence summaries.
8. Add deployment configuration, environment management, and observability basics if the project were to move beyond take-home scope.

## Submission Notes

This submission is intentionally pragmatic. The goal was to deliver a working end-to-end intake workflow that is easy to run, easy to review, and grounded in real public data.

Where tradeoffs were necessary, I favored clarity, inspectability, and product usefulness over heavier infrastructure or speculative complexity. That felt like the strongest fit for a take-home evaluation.

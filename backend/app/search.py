from __future__ import annotations

from typing import Any

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from .nhtsa import complaint_text


class ComplaintSearcher:
    def __init__(self, complaints: list[dict[str, Any]]) -> None:
        self.complaints = complaints
        self.texts = [complaint_text(c) for c in complaints]
        self.vectorizer = TfidfVectorizer(stop_words="english", ngram_range=(1, 2), min_df=1)
        self.matrix = self.vectorizer.fit_transform(self.texts) if self.texts else None

    def search(self, query: str, k: int = 5) -> list[dict[str, Any]]:
        if self.matrix is None or not query.strip():
            return []
        query_vec = self.vectorizer.transform([query])
        scores = cosine_similarity(query_vec, self.matrix).flatten()
        top_idx = scores.argsort()[::-1][:k]
        results = []
        for idx in top_idx:
            if float(scores[idx]) <= 0:
                continue
            item = self.complaints[idx]
            results.append(
                {
                    "score": round(float(scores[idx]), 4),
                    "odiNumber": item.get("odiNumber") or item.get("ODINumber"),
                    "component": item.get("components") or item.get("component") or "UNKNOWN",
                    "summary": complaint_text(item),
                    "date": item.get("dateComplaintFiled") or item.get("date") or item.get("incidentDate"),
                    "state": item.get("state") or item.get("State"),
                }
            )
        return results

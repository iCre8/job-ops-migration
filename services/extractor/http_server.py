"""
http_server.py — FastAPI HTTP wrapper for the Job-Ops extractor sidecar.

Exposes two endpoints:
  GET  /health  — liveness probe (used by docker-compose healthcheck)
  POST /scrape  — triggers a jobspy scrape and returns raw job records

The scrape() call is CPU-bound and blocking; it runs in a thread pool
executor so the FastAPI event loop is not blocked.

Start with:
  uvicorn http_server:app --host 0.0.0.0 --port 8000
"""

from __future__ import annotations

import asyncio

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from scrape_jobs import scrape

app = FastAPI(title="job-ops-extractor", version="0.1.0")


class ScrapeRequest(BaseModel):
    search_terms: list[str]
    location: str
    country: str = "USA"
    is_remote: bool = False
    results_wanted: int = 50
    sites: list[str] = ["linkedin", "indeed", "glassdoor"]


@app.get("/health")
def health() -> dict[str, bool]:
    return {"ok": True}


@app.post("/scrape")
async def scrape_jobs(req: ScrapeRequest) -> dict[str, object]:
    try:
        loop = asyncio.get_event_loop()
        jobs = await loop.run_in_executor(None, scrape, req.model_dump())
        return {"ok": True, "data": jobs}
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(exc)) from exc

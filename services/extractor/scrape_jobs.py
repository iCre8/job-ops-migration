"""
scrape_jobs.py — Adapted core scraping logic for the Job-Ops extractor sidecar.

The legacy script (extractors/jobspy/scrape_jobs.py) was a CLI that read env
vars and wrote CSV/JSON files. This version exposes a single `scrape(request)`
function called by http_server.py, returning a JSON-serializable list of dicts.

All DataFrame NaN values are normalised to None before serialisation so the
FastAPI response body is always valid JSON.
"""
from __future__ import annotations

import json
from typing import Any

import pandas as pd
from jobspy import scrape_jobs as jobspy_scrape

# ─── Country normalisation ─────────────────────────────────────────────────────

COUNTRY_ALIASES: dict[str, str] = {
    "uk": "united kingdom",
    "united kingdom": "united kingdom",
    "us": "united states",
    "usa": "united states",
    "united states": "united states",
    "türkiye": "turkey",
    "czech republic": "czechia",
}

GLASSDOOR_COUNTRY_TO_CITY: dict[str, str] = {
    "australia": "Sydney",
    "austria": "Vienna",
    "belgium": "Brussels",
    "brazil": "Sao Paulo",
    "canada": "Toronto",
    "france": "Paris",
    "germany": "Berlin",
    "hong kong": "Hong Kong",
    "india": "Bengaluru",
    "ireland": "Dublin",
    "italy": "Milan",
    "mexico": "Mexico City",
    "netherlands": "Amsterdam",
    "new zealand": "Auckland",
    "singapore": "Singapore",
    "spain": "Madrid",
    "switzerland": "Zurich",
    "united kingdom": "London",
    "united states": "New York",
    "vietnam": "Ho Chi Minh City",
}


def _normalize_country(value: str) -> str:
    normalized = " ".join(value.strip().lower().split())
    return COUNTRY_ALIASES.get(normalized, normalized)


def _is_country_level_location(location: str, country: str) -> bool:
    if not location.strip() or not country.strip():
        return False
    return _normalize_country(location) == _normalize_country(country)


def _glassdoor_city_for_country(country: str, location: str) -> str | None:
    key = _normalize_country(country or location)
    return GLASSDOOR_COUNTRY_TO_CITY.get(key)


def _scrape_for_sites(
    *,
    sites: list[str],
    search_term: str,
    location: str | None,
    results_wanted: int,
    country_indeed: str,
    is_remote: bool,
    hours_old: int = 72,
    linkedin_fetch_description: bool = True,
) -> pd.DataFrame:
    kwargs: dict[str, Any] = {
        "site_name": sites,
        "search_term": search_term,
        "results_wanted": results_wanted,
        "hours_old": hours_old,
        "country_indeed": country_indeed,
        "linkedin_fetch_description": linkedin_fetch_description,
        "is_remote": is_remote,
    }
    if location and location.strip():
        kwargs["location"] = location
    return jobspy_scrape(**kwargs)


def _df_to_records(df: pd.DataFrame) -> list[dict[str, Any]]:
    """Convert a DataFrame to a list of JSON-serializable dicts.

    Pandas NaN / NaT values are mapped to None so the FastAPI response
    body is always valid JSON (NaN is not valid JSON).
    """
    if df.empty:
        return []
    # to_json → json.loads round-trip converts NaN to null → None in Python
    return json.loads(df.to_json(orient="records", force_ascii=False, date_format="iso"))


def scrape(request: dict[str, Any]) -> list[dict[str, Any]]:
    """Scrape jobs for each search term and return a combined list of records.

    Args:
        request: Dict with keys matching ScrapeRequest in http_server.py:
            search_terms  — list of search strings
            location      — city/region/country string
            country       — country name for Indeed API
            is_remote     — filter for remote jobs
            results_wanted — max results per term per site batch
            sites         — list of job board names

    Returns:
        List of dicts with raw jobspy field names (snake_case).
    """
    search_terms: list[str] = request.get("search_terms", [])
    location: str = request.get("location", "")
    country: str = request.get("country", "USA")
    is_remote: bool = bool(request.get("is_remote", False))
    results_wanted: int = int(request.get("results_wanted", 50))
    sites: list[str] = request.get("sites", ["linkedin", "indeed", "glassdoor"])

    all_frames: list[pd.DataFrame] = []

    for term in search_terms:
        non_glassdoor = [s for s in sites if s != "glassdoor"]
        if non_glassdoor:
            all_frames.append(
                _scrape_for_sites(
                    sites=non_glassdoor,
                    search_term=term,
                    location=location,
                    results_wanted=results_wanted,
                    country_indeed=country,
                    is_remote=is_remote,
                )
            )

        if "glassdoor" in sites:
            glassdoor_location = location
            if _is_country_level_location(location, country):
                fallback = _glassdoor_city_for_country(country, location)
                if fallback:
                    glassdoor_location = fallback
            all_frames.append(
                _scrape_for_sites(
                    sites=["glassdoor"],
                    search_term=term,
                    location=glassdoor_location,
                    results_wanted=results_wanted,
                    country_indeed=country,
                    is_remote=is_remote,
                )
            )

    if not all_frames:
        return []

    combined = pd.concat(all_frames, ignore_index=True)
    return _df_to_records(combined)

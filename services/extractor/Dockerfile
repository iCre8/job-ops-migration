# ─── Extractor sidecar (Python/FastAPI) ───────────────────────────────────────
# Wraps the legacy jobspy scraper behind an HTTP API.
# Source: adapted from legacy extractors/jobspy/scrape_jobs.py
#
# Phase 2: This is a placeholder Dockerfile. The Python source files
# (http_server.py, scrape_jobs.py, requirements.txt) are created in Phase 5.

FROM python:3.11-slim

WORKDIR /app

# System deps for playwright/browser-based extractors (e.g. ukvisajobs)
RUN apt-get update && apt-get install -y --no-install-recommends \
    wget \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source
COPY . .

ENV HOST=0.0.0.0
ENV PORT=8000

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD wget -qO- http://localhost:${PORT}/health || exit 1

CMD ["python", "-m", "uvicorn", "http_server:app", "--host", "0.0.0.0", "--port", "8000"]

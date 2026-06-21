FROM node:22-slim

ENV DEBIAN_FRONTEND=noninteractive
ENV NODE_ENV=production
ENV PATH=/root/.local/bin:${PATH}

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    python3 \
    python3-pip \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# Install Hermes Agent CLI
RUN curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash

# Copy Hermes Configuration templates
WORKDIR /root/.hermes
COPY apps/hermes-agent/config/config.yaml ./config.yaml
COPY apps/hermes-agent/config/SOUL.md ./SOUL.md
COPY apps/hermes-agent/config/skills/job-verification/SKILL.md ./skills/job-verification/SKILL.md

# Copy data lookup files
WORKDIR /root/realjob-scout/data
COPY apps/hermes-agent/config/data/trusted_ats_domains.txt ./trusted_ats_domains.txt
COPY apps/hermes-agent/config/data/scam_patterns.txt ./scam_patterns.txt

# Set up Node app workspace
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY shared/package*.json ./shared/
COPY apps/hermes-agent/package*.json ./apps/hermes-agent/
COPY orchestrator/package*.json ./orchestrator/

# Install pnpm and workspace production dependencies
RUN corepack enable && corepack prepare pnpm@9.1.1 --activate && \
    pnpm install --frozen-lockfile --prod

# Copy source codes
COPY shared ./shared
COPY orchestrator/src/server/db/schema.ts ./orchestrator/src/server/db/schema.ts
COPY apps/hermes-agent/src ./apps/hermes-agent/src
COPY apps/hermes-agent/tsconfig.json ./apps/hermes-agent/tsconfig.json

# Execute worker
WORKDIR /app/apps/hermes-agent
CMD ["pnpm", "tsx", "src/worker.ts"]

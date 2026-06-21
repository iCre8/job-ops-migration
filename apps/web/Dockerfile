# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

RUN corepack enable

# Copy workspace manifests and Nx metadata first for dependency layer caching.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml nx.json tsconfig.base.json tsconfig.workspace.json ./
COPY apps/web/package.json apps/web/project.json ./apps/web/
COPY apps/web/prisma ./apps/web/prisma/

RUN pnpm install --frozen-lockfile

COPY apps/web ./apps/web

RUN pnpm nx build web
RUN pnpm prune --prod

# Runtime stage
FROM node:22-alpine AS runtime

WORKDIR /app
RUN apk add --no-cache wget

COPY --from=builder /app/apps/web/build ./build
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/web/package.json ./package.json

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "build"]

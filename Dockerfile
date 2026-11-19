# ==========================================
# SortSense Multi-Stage Dockerfile
# Provides images for:
#   1. target: api (Python FastAPI Cloud Backend)
#   2. target: web (Next.js Campus Dashboard)
#   3. target: fullstack (Unified deployment)
# ==========================================

# ------------------------------------------
# Stage 1: Python FastAPI Backend
# ------------------------------------------
FROM python:3.12-slim AS api

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY api/ ./api/
COPY tests/ ./tests/

EXPOSE 8000

HEALTHCHECK --interval=15s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1

CMD ["uvicorn", "api.index:app", "--host", "0.0.0.0", "--port", "8000"]


# ------------------------------------------
# Stage 2: Next.js Frontend Builder
# ------------------------------------------
FROM node:20-alpine AS web-builder

WORKDIR /app

RUN apk add --no-cache libc6-compat

COPY package.json package-lock.json ./
RUN npm ci

COPY app/ ./app/
COPY components/ ./components/
COPY lib/ ./lib/
COPY public/ ./public/
COPY next.config.ts tsconfig.json proxy.ts ./

ENV NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production

RUN npm run build


# ------------------------------------------
# Stage 3: Next.js Production Runner
# ------------------------------------------
FROM node:20-alpine AS web

WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=web-builder /app/package.json ./package.json
COPY --from=web-builder /app/node_modules ./node_modules
COPY --from=web-builder /app/.next ./.next
COPY --from=web-builder /app/public ./public

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=20s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000 || exit 1

CMD ["node_modules/.bin/next", "start"]


# ------------------------------------------
# Default Stage: API + Web Documentation
# ------------------------------------------
FROM api AS fullstack

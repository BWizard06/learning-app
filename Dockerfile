FROM node:24-slim AS build

WORKDIR /app
ENV NODE_OPTIONS=--max-old-space-size=1536

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .
RUN npm run build


FROM node:24-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production \
    NITRO_PORT=3000 \
    NITRO_HOST=0.0.0.0 \
    TZ=Europe/Zurich \
    NUXT_DB_PATH=/data/learning.db \
    NUXT_MIGRATIONS_DIR=/app/migrations

COPY --from=build /app/.output ./.output
COPY --from=build /app/server/db/migrations ./migrations

RUN mkdir -p /data && chown -R node:node /data /app

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", ".output/server/index.mjs"]

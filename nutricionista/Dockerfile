# ---- build ----
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---- produção ----
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 UPLOAD_DIR=/data/uploads
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/scripts ./scripts
# Tabelas de alimentos (TACO 4ª ed. e medidas do IBGE), lidas por scripts/tabelas/importar.mjs ao subir.
COPY --from=build /app/src/db/data ./src/db/data
COPY --from=build /app/next.config.ts ./next.config.ts
RUN addgroup -S app && adduser -S app -G app && mkdir -p /data/uploads && chown -R app:app /data /app/.next
USER app
EXPOSE 3000
CMD ["sh", "-c", "node scripts/migrate.mjs && npx next start -p 3000"]

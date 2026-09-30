FROM node:24.20-bookworm-slim AS builder

WORKDIR /app

# npm ci must use the same peer-resolution settings as the committed lockfile.
COPY package.json package-lock.json .npmrc ./
COPY tsconfig.json tsconfig.portal.json ./
COPY prisma ./prisma/
COPY prisma8 ./prisma8/
COPY prisma.config.ts prisma7.config.ts ./

RUN npm ci

COPY src ./src/
COPY portal ./portal/
COPY scripts/build-portal.mjs ./scripts/build-portal.mjs
RUN npm run build

FROM node:24.20-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

# Each stage has its own filesystem; the runtime install needs .npmrc too.
COPY package.json package-lock.json .npmrc ./
COPY prisma ./prisma/

RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

EXPOSE 3001

USER node

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || '3001') + '/api/health', { signal: AbortSignal.timeout(4000) }).then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "dist/index.js"]

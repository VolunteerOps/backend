FROM node:24.20-alpine AS builder

WORKDIR /app

# npm ci must use the same peer-resolution settings as the committed lockfile.
COPY package.json package-lock.json .npmrc ./
COPY tsconfig.json ./
COPY prisma ./prisma/
COPY prisma8 ./prisma8/
COPY prisma.config.ts prisma7.config.ts ./

RUN npm ci

COPY src ./src/
RUN npm run build

FROM node:24.20-alpine AS runner

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

CMD ["node", "dist/index.js"]

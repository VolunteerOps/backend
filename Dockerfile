FROM node:22.18-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY tsconfig.json ./
COPY prisma ./prisma/
COPY prisma8 ./prisma8/
COPY prisma.config.ts prisma7.config.ts ./

RUN npm ci

COPY src ./src/
RUN npm run build

FROM node:22.18-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

EXPOSE 3001

USER node

CMD ["node", "dist/index.js"]

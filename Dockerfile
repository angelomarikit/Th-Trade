# WULU Trading Scanner — API only (signals / no order execution)
FROM node:22-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/domain/package.json packages/domain/
COPY packages/news/package.json packages/news/
COPY packages/market-data/package.json packages/market-data/
COPY packages/regime/package.json packages/regime/
COPY packages/strategies/package.json packages/strategies/
COPY packages/backtest/package.json packages/backtest/
COPY packages/confirmation/package.json packages/confirmation/
COPY packages/journal/package.json packages/journal/
COPY packages/options/package.json packages/options/
COPY packages/scanner/package.json packages/scanner/

RUN npm ci

COPY tsconfig.base.json tsconfig.json vitest.config.ts ./
COPY packages ./packages
COPY apps/api ./apps/api

RUN npm run build:api

FROM node:22-bookworm-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY packages/domain/package.json packages/domain/
COPY packages/news/package.json packages/news/
COPY packages/market-data/package.json packages/market-data/
COPY packages/regime/package.json packages/regime/
COPY packages/strategies/package.json packages/strategies/
COPY packages/backtest/package.json packages/backtest/
COPY packages/confirmation/package.json packages/confirmation/
COPY packages/journal/package.json packages/journal/
COPY packages/options/package.json packages/options/
COPY packages/scanner/package.json packages/scanner/

RUN npm ci --omit=dev

COPY --from=build /app/packages ./packages
COPY --from=build /app/apps/api ./apps/api

EXPOSE 8787
CMD ["npm", "run", "start:api"]

FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

FROM base AS build
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/dashboard/package.json ./apps/dashboard/
COPY packages/shared/package.json ./packages/shared/
RUN pnpm install --frozen-lockfile
COPY apps/dashboard ./apps/dashboard
COPY packages/shared ./packages/shared
ARG NEXT_PUBLIC_BFF_URL=http://localhost:3002
ARG NEXT_PUBLIC_RISK_ENGINE_URL=http://localhost:3001
ENV NEXT_PUBLIC_BFF_URL=$NEXT_PUBLIC_BFF_URL
ENV NEXT_PUBLIC_RISK_ENGINE_URL=$NEXT_PUBLIC_RISK_ENGINE_URL
RUN pnpm --filter @stock-trader/dashboard build

FROM node:22-alpine
WORKDIR /app
# standalone output includes traced node_modules — no pnpm needed at runtime
COPY --from=build /app/apps/dashboard/.next/standalone ./
COPY --from=build /app/apps/dashboard/.next/static ./apps/dashboard/.next/static
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0
CMD ["node", "apps/dashboard/server.js"]

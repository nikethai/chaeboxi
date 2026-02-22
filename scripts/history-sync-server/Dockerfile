FROM node:22-alpine

WORKDIR /app

COPY package.json ./
RUN corepack enable && pnpm install --prod --no-frozen-lockfile

COPY server.mjs ./

ENV PORT=8788
ENV SYNC_HOST=0.0.0.0
ENV SYNC_DB_PATH=/data/history-sync.db

VOLUME ["/data"]
EXPOSE 8788

CMD ["pnpm", "start"]

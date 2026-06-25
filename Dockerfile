FROM node:20-bookworm-slim

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=80
ENV DATABASE_URL=file:/data/dev.db
ENV WECHAT_APPID=wxbf6d60c2667556b3

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /data

COPY server/package*.json ./
COPY server/prisma ./prisma

RUN npm ci --omit=dev \
  && npx prisma generate

COPY server/auth.js server/db.js server/seed.js server/server.js ./
COPY server/routes ./routes
COPY server/services ./services

VOLUME ["/data"]

EXPOSE 80

CMD ["sh", "-c", "npx prisma migrate deploy && node server.js"]

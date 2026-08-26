FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies for better-sqlite3
RUN apk add --no-cache python3 make g++ gcc

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Production image
FROM node:20-alpine AS runner

WORKDIR /app

# Required runtime libraries for SQLite
RUN apk add --no-cache libstdc++

ENV NODE_ENV=production
ENV PORT=3000
ENV DATABASE_PATH=/data/calendar.db

COPY package*.json ./
RUN apk add --no-cache python3 make g++ gcc \
    && npm ci --omit=dev \
    && apk del python3 make g++ gcc

COPY --from=builder /app/dist ./dist

# Create data directory for SQLite volume
RUN mkdir -p /data

EXPOSE 3000

VOLUME ["/data"]

CMD ["node", "dist/index.js"]

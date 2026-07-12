# --- Build stage -----------------------------------------------------------
FROM node:20-alpine AS build
WORKDIR /app

# Prisma's engine detection shells out to `openssl`; without it Alpine has no
# libssl visible and Prisma silently guesses the wrong engine (openssl-1.1.x)
# instead of the musl/openssl-3 build this image actually ships.
RUN apk add --no-cache openssl

# Install dependencies (leverage layer caching)
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci

# Build the application
COPY . .
RUN npx prisma generate && npm run build

# --- Runtime stage ---------------------------------------------------------
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

RUN apk add --no-cache openssl

COPY package*.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev && npx prisma generate

# Bring in compiled output
COPY --from=build /app/dist ./dist
# Bring in dev JWT keys so the application can boot in Docker without extra setup.
COPY --from=build /app/keys ./keys

# Run as the unprivileged user shipped with the node image
USER node

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/v1/health || exit 1
CMD ["node", "dist/main.js"]

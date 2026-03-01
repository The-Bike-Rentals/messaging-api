# ── Stage 1: Dependencies ─────────────────────────────────────────────────────
FROM node:20-alpine AS deps

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

# ── Stage 2: Production image ─────────────────────────────────────────────────
FROM node:20-alpine AS runner

# Install dumb-init for proper PID 1 signal handling
RUN apk add --no-cache dumb-init

ENV NODE_ENV=production

WORKDIR /app

# Create a non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy production node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy application source
COPY src/ ./src/
COPY public/ ./public/
COPY package.json ./

# Create the sessions directory and set ownership
RUN mkdir -p .sessions && chown -R appuser:appgroup /app

USER appuser

EXPOSE 3000

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "src/server.js"]

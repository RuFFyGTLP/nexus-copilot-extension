# ─── Nexus Co-Pilot API ───
# Lightweight Node.js middleware

FROM node:20-alpine

LABEL maintainer="german-ux"
LABEL description="Nexus Co-Pilot API - Middleware between Chrome extension and Ollama"

WORKDIR /app

# Install dependencies first (layer caching)
COPY package.json ./
RUN npm install --omit=dev && npm cache clean --force

# Copy source
COPY server.js ./

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/status || exit 1

EXPOSE 3000

CMD ["node", "server.js"]

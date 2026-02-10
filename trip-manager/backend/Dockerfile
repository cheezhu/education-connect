FROM node:22-bookworm-slim
WORKDIR /app

RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ \
 && rm -rf /var/lib/apt/lists/*

# Install backend deps
COPY backend/package*.json ./backend/
WORKDIR /app/backend
RUN npm ci --include=optional

# Copy sources (backend + shared)
WORKDIR /app
COPY backend ./backend
COPY shared ./shared

WORKDIR /app/backend
EXPOSE 3001
CMD ["npm","run","start"]

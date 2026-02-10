FROM node:18-alpine AS build

# Build needs shared/* (imported by frontend/src/domain/*)
WORKDIR /app

# Copy only what we need for deterministic installs
COPY frontend/package*.json ./frontend/
WORKDIR /app/frontend
RUN npm ci

# Copy sources (frontend + shared)
WORKDIR /app
COPY frontend ./frontend
COPY shared ./shared

WORKDIR /app/frontend
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/frontend/dist /usr/share/nginx/html

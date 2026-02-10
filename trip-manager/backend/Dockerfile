FROM node:22-bookworm-slim
WORKDIR /app

RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ python3-pip python3-venv \
 && rm -rf /var/lib/apt/lists/*

# Install solver deps (layer cached by requirements.txt)
COPY solver-lab-py/requirements.txt ./solver-lab-py/requirements.txt
RUN python3 -m venv /opt/solver-venv \
 && /opt/solver-venv/bin/pip install --no-cache-dir -r /app/solver-lab-py/requirements.txt

# Install backend deps
COPY backend/package*.json ./backend/
WORKDIR /app/backend
RUN npm ci --include=optional

# Copy sources (backend + shared)
WORKDIR /app
COPY backend ./backend
COPY shared ./shared
COPY solver-lab-py ./solver-lab-py

WORKDIR /app/backend
EXPOSE 3001
CMD ["npm","run","start"]

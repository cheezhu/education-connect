# C2 Relay

`tools/c2-relay/server.js` is a small host-side HTTP relay for Scheme A:

- Web `AiDock` -> backend `/api/c2/turn`
- Backend -> `http://<docker-host-gateway>:18791/c2/turn` (or `C2_RELAY_URL`)
- Relay -> OpenClaw `http://127.0.0.1:18789/v1/responses`

The relay:

- Listens on port `18791` by default
- Accepts only private source IP ranges
- Reads the OpenClaw gateway bearer token from `/root/.openclaw/openclaw.json`
- Sends `x-openclaw-agent-id: cheezhu5`
- Returns `{ "replyText": "..." }` parsed from `output_text` parts

## Run manually

```bash
node tools/c2-relay/server.js
```

## Environment variables

- `C2_RELAY_PORT` (default: `18791`)
- `C2_RELAY_TIMEOUT_MS` (default: `90000`)
- `C2_RELAY_MAX_BODY_BYTES` (default: `262144`)
- `C2_OPENCLAW_RESPONSES_URL` (default: `http://127.0.0.1:18789/v1/responses`)
- `C2_OPENCLAW_CONFIG_PATH` (default: `/root/.openclaw/openclaw.json`)
- `C2_OPENCLAW_AGENT_ID` (default: `cheezhu5`)

## API

- `POST /c2/turn`
  - Request:
    - `groupId`: positive integer
    - `text`: string
    - `context.activeTabLabel`: string (optional)
  - Response:
    - `replyText`: string
- `GET /healthz` -> `{ "ok": true }`

## systemd

Example unit file: `tools/c2-relay/c2-relay.service.example`


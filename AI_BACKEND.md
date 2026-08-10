# Local AI backend (Ollama / LM Studio)

WeatherStop exposes an OpenAI-compatible AI proxy so the app can call a local
LLM without baking provider details into the UI.

## Prerequisites

Pick one:

1. **Ollama** — install from https://ollama.com, then:
   ```bash
   ollama serve
   ollama pull llama3.1:8b
   ```
2. **LM Studio** — load a model and enable the local server (default port `1234`).

Default model is **`llama3.1:8b`** (strong general-purpose chat on ~16GB RAM). Override with `AI_MODEL` if you prefer something lighter (`llama3.2:3b`) or larger.

## Run the backend

```bash
AI_MODEL=llama3.1:8b npm run ai:server
```

Optional env (see `.env.example`):

| Variable | Purpose |
|---|---|
| `AI_PROVIDER` | `ollama` \| `lmstudio` \| `openai-compatible` |
| `AI_BASE_URL` | Upstream origin (no `/v1`) |
| `AI_MODEL` | Default model id (`llama3.1:8b` recommended) |
| `AI_API_KEY` | Optional Bearer token |
| `AI_SERVER_PORT` | Local proxy port (default `8787`) |

LM Studio example:

```bash
AI_PROVIDER=lmstudio AI_BASE_URL=http://127.0.0.1:1234 npm run ai:server
```

## Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/ai/health` | Upstream reachability + model list |
| `GET` | `/api/ai/models` | OpenAI-style model list |
| `POST` | `/api/ai/chat` | Chat completions (`messages[]`, optional `stream`) |
| `POST` | `/api/ai/storm-analysis` | Identify storms → boxes, paths, severe / tornado spots |

### Storm analysis

`POST /api/ai/storm-analysis` builds MapLibre GeoJSON from NWS severe/tornado
alerts in the viewport, then enriches labels with the local LLM:

```bash
curl -s http://127.0.0.1:8787/api/ai/storm-analysis \
  -H 'Content-Type: application/json' \
  -d '{"bbox":[-100,30,-90,40],"alerts":[]}'
```

Feature `kind` values drawn on the radar map:

| kind | Geometry | Meaning |
|---|---|---|
| `box` | Polygon | Identification box around the storm |
| `path` | LineString | Projected 30/60‑min motion track |
| `severe` | Point | Potential severe-weather spot |
| `tornado` | Point | Tornado formation / indicated + path end |

On the radar UI, open **AI Storms** (bottom-right) to toggle the overlay.

## Dev + production

- **Local Vite**: `npm run dev` proxies `/api/ai` to the AI server on `AI_SERVER_PORT`.
  Start both: `npm run ai:server` in one terminal, `npm run dev` in another
  (or `npm run dev:ai` to launch both).
- **Vercel**: the same handlers live under `api/ai/*.ts` (edge). Set
  `AI_BASE_URL` to a reachable OpenAI-compatible host — localhost on your
  laptop is not reachable from Vercel.

## Frontend helper

`src/lib/aiClient.ts` provides `fetchAiHealth`, `fetchAiModels`, `chatCompletion`,
and `chatText` for later UI wiring.

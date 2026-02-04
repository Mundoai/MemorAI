# CLAUDE.md - MemorAI Project Instructions

**GitHub:** https://github.com/Mundoai/MemorAI

## Project Overview

MemorAI is a persistent semantic memory layer for Claude Code and subagents, powered by Mem0. It provides intelligent memory storage with LLM-powered extraction, deduplication, contradiction resolution, and relevance decay — so AI agents can remember context, decisions, preferences, and patterns across sessions and projects.

## Architecture

```
┌──────────────────────────────────────────────┐
│              Docker Compose (Coolify)          │
│                                                │
│  ┌───────────────┐    ┌────────────────────┐  │
│  │  MemorAI API  │────│      Qdrant        │  │
│  │  (FastAPI +   │    │  (vector store +   │  │
│  │   Mem0)       │    │   metadata)        │  │
│  │  Port 8000    │    │  Port 6333         │  │
│  └───────┬───────┘    └────────────────────┘  │
│          │                                     │
│    ┌─────┴──────┐                              │
│    │  Mem0 Core  │                             │
│    │  - LLM: OpenRouter (free models)          │
│    │  - Embeddings: HuggingFace (local)        │
│    │  - Dedup + conflict resolution            │
│    └────────────┘                              │
└──────────────────────────────────────────────┘
         ▲
         │ MCP (stdio)
    ┌────┴──────┐
    │ MCP Server │──── Claude Code + Subagents
    └───────────┘
```

## Quick Start

### Start the memory stack
```bash
docker compose up -d
```

### Verify it's running
```bash
curl http://localhost:8000/health
```

### Stop
```bash
docker compose down
```

## MCP Tools Available

| Tool | Description |
|------|-------------|
| `memory_store` | Store a memory (Mem0 auto-extracts, deduplicates, resolves conflicts) |
| `memory_search` | Semantic search across memories (natural language) |
| `memory_list` | List all memories for a project |
| `memory_update` | Update an existing memory |
| `memory_delete` | Delete a memory by ID |
| `memory_delete_all` | Delete all memories for a project |
| `memory_history` | View change history of a specific memory |

## Memory Usage Guidelines for Agents

### What to store
- **Decisions made** — "We chose JWT over sessions for auth because..."
- **User preferences** — "User prefers TypeScript, Tailwind, minimal dependencies"
- **Architecture context** — "API uses REST with versioned endpoints at /api/v1"
- **Patterns** — "Error handling follows Result<T, E> pattern throughout"
- **Issues/gotchas** — "Port 3000 conflicts with another service, always kill first"
- **Learnings** — "Turbopack caching causes hydration errors, clear .next to fix"

### How to store (for agents)
Use the `memory_store` tool with:
- `project` = project name (e.g., "tuasistente-ai", "memorai")
- `content` = detailed, descriptive text (Mem0 will extract key facts)
- `agent` = your agent name (e.g., "claude", "dev-agent", "architect")
- `metadata` = optional tags like {"category": "decision", "sprint": "1"}

### How to recall
Use `memory_search` with natural language queries. You don't need exact keywords — it's semantic search.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /health | Health check |
| POST | /memories | Add memories (Mem0 extracts and stores) |
| GET | /memories | List memories (filter by user_id, agent_id) |
| GET | /memories/{id} | Get specific memory |
| PUT | /memories/{id} | Update a memory |
| DELETE | /memories/{id} | Delete a memory |
| DELETE | /memories | Delete all for a user_id |
| GET | /memories/{id}/history | Memory change history |
| POST | /search | Semantic search |
| POST | /reset | Reset all memories |

## Key Commands

```bash
# Start stack
docker compose up -d

# Rebuild after code changes
docker compose up -d --build

# View logs
docker compose logs -f api
docker compose logs -f qdrant

# Rebuild MCP server
cd mcp-server && npm run build
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENROUTER_API_KEY` | *(required)* | OpenRouter API key for Mem0 LLM processing |
| `MEMORAI_LLM_MODEL` | `arcee-ai/trinity-large-preview:free` | Free OpenRouter model for memory processing (must support JSON mode) |
| `MEMORAI_API_KEY` | *(empty)* | Optional API auth key |
| `MEMORAI_API_URL` | `http://localhost:8000` | API base URL for MCP server |
| `MEMORAI_QDRANT_HOST` | `qdrant` | Qdrant hostname |
| `MEMORAI_QDRANT_PORT` | `6333` | Qdrant port |

## Free OpenRouter Models for Mem0

| Model | Context | JSON Mode | Best For |
|-------|---------|-----------|----------|
| `arcee-ai/trinity-large-preview:free` | 131K | ✓ | Default — complex extraction (400B MoE) |
| `upstage/solar-pro-3:free` | 128K | ✓ | Alternative with structured output |
| `arcee-ai/trinity-mini:free` | 131K | ✓ | Lightweight alternative |
| `tngtech/tng-r1t-chimera:free` | 164K | ✓ | Large context with structured output |

## Project Structure

```
MemorAI/
├── api/                    # Mem0-powered FastAPI service
│   ├── main.py             # API with Mem0 integration
│   ├── config.py           # Pydantic settings
│   ├── requirements.txt    # Python deps (mem0ai, etc.)
│   └── Dockerfile          # Container build
├── dashboard/              # Next.js 16 dashboard
│   ├── app/                # App Router pages
│   │   ├── login/          # OAuth login (force-dynamic!)
│   │   └── (dashboard)/    # Authenticated pages (layout calls auth())
│   ├── lib/
│   │   ├── auth/index.ts   # NextAuth config (JWT callbacks — NO DB in session!)
│   │   ├── db/index.ts     # Drizzle + postgres connection
│   │   └── api/client.ts   # FastAPI client (30s timeout)
│   ├── middleware.ts        # Edge runtime auth (exports auth as middleware)
│   ├── next.config.ts       # standalone + serverExternalPackages: ["postgres"]
│   ├── Dockerfile           # Multi-stage build with migration support
│   └── migrate.mjs          # Drizzle migration runner
├── mcp-server/             # MCP server for Claude Code
│   ├── src/index.ts        # MCP tool definitions
│   ├── dist/               # Compiled JS
│   └── package.json        # Node deps
├── docs/                   # Documentation
│   └── deployment-troubleshooting.md  # Hard-won deployment lessons
├── docker-compose.yml      # Full stack (Coolify-ready)
├── .mcp.json               # MCP server registration
├── .env                    # Environment variables
└── .env.example            # Template
```

## Dashboard (Next.js)

The dashboard is a Next.js 16 app with NextAuth v5 (beta.30) using JWT strategy and a DrizzleAdapter for PostgreSQL.

### Critical: Edge Runtime vs Node.js Runtime

The `middleware.ts` exports `auth` as middleware, which runs on the **Edge runtime**. The `postgres` npm package **cannot make TCP connections on Edge**. This means:

- **NEVER query the database in the `session` callback** — it runs on both Edge (middleware) and Node.js (page renders). DB calls will fail on Edge, exhaust the connection pool, and cause all pages to hang.
- **DO store computed values (like user role) in the JWT token** via the `jwt` callback, which only runs on Node.js during sign-in.
- The `authorized` callback is safe — it only checks `!!session?.user` without DB calls.

### Static Generation Gotcha

Pages that read environment variables (like OAuth credentials) must use `export const dynamic = "force-dynamic"` or they'll be statically generated at Docker build time when env vars aren't available. The login page is a known example.

### Standalone Build

The dashboard uses `output: "standalone"` with `serverExternalPackages: ["postgres"]` in `next.config.ts`. This ensures the postgres driver is loaded from `node_modules` at runtime (with working native crypto for scram-sha-256) rather than being bundled by webpack/Turbopack.

## Deployment (Coolify on Hostinger VPS)

- **VPS IP:** 168.231.69.241
- **Domain:** memoria.mywebsites.dev (dashboard), memoria-api.mywebsites.dev (API)
- **Reverse proxy:** Traefik (managed by Coolify)
- **Docker network:** `gos8ss8cg4go0cggg4ckwgc4` (app-level network)

### Deploy Process

```bash
# SSH into VPS
ssh root@168.231.69.241

# Pull latest code
cd /tmp/MemorAI && git pull origin main

# Rebuild dashboard image
cd dashboard && docker build -t memorai-dashboard:latest .

# Redeploy (use the deploy script or manually stop/start)
bash /tmp/redeploy-dashboard.sh
```

### Known Deployment Pitfalls

1. **Coolify network DNS collision** — If the dashboard container is connected to both the app network AND the `coolify` network, the `postgres` hostname may resolve to Coolify's own database instead of MemorAI's. Always ensure the dashboard is ONLY on the app network: `docker network disconnect coolify <container-name>`
2. **Shell escaping on VPS** — The VPS uses zsh. Traefik labels with backticks in `docker run` commands will be interpreted. Use a deploy script file instead of inline commands.
3. **Container env vars** — When manually redeploying, you must pass ALL environment variables. The deploy script at `/tmp/redeploy-dashboard.sh` has the full list.
4. **Migration on startup** — The Dockerfile CMD runs `node migrate.mjs && node server.js`. Migrations must pass for the server to start. If postgres is unreachable, the container will crash-loop.

## Important Notes

1. **Mem0 smart processing** — Every `memory_store` call triggers LLM processing via OpenRouter. Mem0 extracts facts, deduplicates against existing memories, and resolves contradictions automatically.
2. **Free tier limits** — OpenRouter free models have rate limits (~20 RPM). For heavy use, consider a paid model.
3. **First startup is slow** — Embedding model (~100MB) downloads on first Docker build.
4. **Project isolation** — Each project is a separate `user_id` in Mem0, with its own memory space.
5. **Coolify deployment** — Use docker-compose.yml directly. Set OPENROUTER_API_KEY in Coolify environment.
6. **Edge runtime** — The NextAuth middleware runs on Edge. Never add DB queries to the `session` or `authorized` callbacks. See "Dashboard" section above.
7. **Docker networking** — Keep the dashboard container on the app network only. Connecting to the `coolify` network causes DNS collisions with Coolify's own postgres.

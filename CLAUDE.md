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
| `MEMORAI_LLM_MODEL` | `stepfun/step-3.5-flash:free` | Free OpenRouter model for memory processing |
| `MEMORAI_API_KEY` | *(empty)* | Optional API auth key |
| `MEMORAI_API_URL` | `http://localhost:8000` | API base URL for MCP server |
| `MEMORAI_QDRANT_HOST` | `qdrant` | Qdrant hostname |
| `MEMORAI_QDRANT_PORT` | `6333` | Qdrant port |

## Free OpenRouter Models for Mem0

| Model | Context | Best For |
|-------|---------|----------|
| `stepfun/step-3.5-flash:free` | 256K | Default — fast reasoning |
| `arcee-ai/trinity-large-preview:free` | 131K | Complex extraction (400B MoE) |
| `nvidia/nemotron-3-nano-30b-a3b:free` | 256K | Agentic workflows |
| `arcee-ai/trinity-mini:free` | 131K | Lightweight alternative |

## Project Structure

```
MemorAI/
├── api/                    # Mem0-powered FastAPI service
│   ├── main.py             # API with Mem0 integration
│   ├── config.py           # Pydantic settings
│   ├── requirements.txt    # Python deps (mem0ai, etc.)
│   └── Dockerfile          # Container build
├── mcp-server/             # MCP server for Claude Code
│   ├── src/index.ts        # MCP tool definitions
│   ├── dist/               # Compiled JS
│   └── package.json        # Node deps
├── docker-compose.yml      # Qdrant + API stack (Coolify-ready)
├── .mcp.json               # MCP server registration
├── .env                    # Environment variables
└── .env.example            # Template
```

## Important Notes

1. **Mem0 smart processing** — Every `memory_store` call triggers LLM processing via OpenRouter. Mem0 extracts facts, deduplicates against existing memories, and resolves contradictions automatically.
2. **Free tier limits** — OpenRouter free models have rate limits (~20 RPM). For heavy use, consider a paid model.
3. **First startup is slow** — Embedding model (~100MB) downloads on first Docker build.
4. **Project isolation** — Each project is a separate `user_id` in Mem0, with its own memory space.
5. **Coolify deployment** — Use docker-compose.yml directly. Set OPENROUTER_API_KEY in Coolify environment.

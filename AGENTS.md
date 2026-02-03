# AGENTS.md - MemorAI Development Guidelines

## Project Context

MemorAI is a semantic memory layer for AI agents. It wraps Mem0 (open-source memory framework) in a FastAPI service with an MCP server for Claude Code integration.

## Tech Stack

- **Memory Engine:** Mem0 (Python, Apache 2.0)
- **LLM Provider:** OpenRouter (free models)
- **Embeddings:** HuggingFace sentence-transformers (local, no API cost)
- **Vector Store:** Qdrant
- **API Framework:** FastAPI + uvicorn
- **MCP Server:** TypeScript + @modelcontextprotocol/sdk
- **Deployment:** Docker Compose on Coolify

## Development Workflow

### API Changes (Python)
1. Edit files in `api/`
2. Rebuild: `docker compose up -d --build api`
3. Test: `curl http://localhost:8000/health`

### MCP Server Changes (TypeScript)
1. Edit `mcp-server/src/index.ts`
2. Build: `cd mcp-server && npm run build`
3. Restart Claude Code to pick up changes

### Testing Endpoints
```bash
# Store a memory
curl -X POST http://localhost:8000/memories \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "Auth uses JWT tokens stored in httpOnly cookies"}], "user_id": "my-project"}'

# Search memories
curl -X POST http://localhost:8000/search \
  -H "Content-Type: application/json" \
  -d '{"query": "how does authentication work", "user_id": "my-project"}'

# List memories
curl "http://localhost:8000/memories?user_id=my-project"
```

## Code Standards

- Keep the API thin — Mem0 handles memory intelligence
- All endpoints must have error handling around Mem0 calls
- Log all memory operations at INFO level
- Health endpoint must be public (no auth)
- Use proper HTTP status codes
- Keep MCP tool descriptions detailed — they help Claude understand usage

## Security

- API key auth is optional but recommended for production
- Never log memory content at DEBUG level in production
- CORS is open by default — restrict in production behind a reverse proxy

# Coolify Deployment Guide for MemorAI

> **Last Updated:** February 2026
> **Coolify Panel:** https://panel.mywebsites.dev
> **GitHub:** https://github.com/Mundoai/MemorAI

## What is MemorAI

MemorAI is a semantic memory layer for AI agents powered by [Mem0](https://mem0.ai). It gives your AI tools persistent, searchable memory so they can recall context across conversations.

The stack consists of:

- **Qdrant** -- vector database that stores memory embeddings
- **FastAPI** -- Mem0-powered REST API for memory operations (add, search, list, delete)
- **MCP server** -- runs locally on your machine so Claude Code can talk to the API (not deployed to Coolify)

## Services

| Service | Port | Description |
|---------|------|-------------|
| MemorAI API | 8000 | REST API for memory operations |
| Qdrant | 6333 | Vector database (internal, used by API) |
| Qdrant Dashboard | 6334 | Qdrant web UI (optional, for debugging) |

---

## Quick Deploy

### 1. Create Project

1. Go to [panel.mywebsites.dev](https://panel.mywebsites.dev)
2. Click **Projects** > **New Project**
3. Name it `MemorAI`

### 2. Add Docker Compose Resource

1. Inside the project, click **New Resource**
2. Select **Docker Compose**
3. Choose **GitHub Repository**
4. Repository: `https://github.com/Mundoai/MemorAI`
5. Branch: `main`
6. Docker Compose Location: `/docker-compose.yml`

### 3. Set Environment Variables

In Coolify, go to **Environment Variables** and add:

```env
# Required
OPENROUTER_API_KEY=sk-or-v1-your-key-here

# Optional
MEMORAI_API_KEY=some-secret-key
MEMORAI_LLM_MODEL=stepfun/step-3.5-flash:free
```

### 4. Configure Domains

Map your domain to the API service on port **8000**. Coolify handles SSL automatically.

Example: `memorai.yourdomain.com` > port 8000

### 5. Deploy

1. Click **Deploy**
2. First build takes 2-5 minutes (Docker image build + model download)
3. Check logs for any errors

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OPENROUTER_API_KEY` | Yes | -- | OpenRouter API key. Get one free at [openrouter.ai](https://openrouter.ai) |
| `MEMORAI_API_KEY` | No | *(none)* | Secret key to protect the API. If set, requests must include `X-API-Key` header |
| `MEMORAI_LLM_MODEL` | No | `stepfun/step-3.5-flash:free` | OpenRouter model ID used by Mem0 for memory extraction |
| `MEMORAI_QDRANT_HOST` | No | `qdrant` | Qdrant hostname (set automatically by Docker Compose) |
| `MEMORAI_QDRANT_PORT` | No | `6333` | Qdrant port (set automatically by Docker Compose) |
| `MEMORAI_EMBEDDING_MODEL` | No | `multi-qa-MiniLM-L6-cos-v1` | HuggingFace sentence-transformers model for embeddings |

---

## Post-Deployment

### Test the API

```bash
# Health check
curl https://memorai.yourdomain.com/health

# Add a memory (with API key)
curl -X POST https://memorai.yourdomain.com/memories \
  -H "X-API-Key: YOUR_MEMORAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "User prefers dark mode"}], "user_id": "test"}'

# Search memories
curl -X POST https://memorai.yourdomain.com/search \
  -H "X-API-Key: YOUR_MEMORAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query": "dark mode", "user_id": "test"}'
```

### Connect Claude Code (MCP)

The MCP server runs **locally** on your machine -- it is not deployed to Coolify. Update your project's `.mcp.json` to point `MEMORAI_API_URL` to the deployed URL:

```json
{
  "mcpServers": {
    "memorai": {
      "type": "stdio",
      "command": "node",
      "args": ["/path/to/MemorAI/mcp-server/dist/index.js"],
      "env": {
        "MEMORAI_API_URL": "https://memorai.yourdomain.com",
        "MEMORAI_API_KEY": "your-memorai-api-key"
      }
    }
  }
}
```

The MCP server is a Node.js process. Build it with `cd mcp-server && npm run build`, then Claude Code will launch it locally and it connects to the remote MemorAI API.

---

## Free OpenRouter Models

Any model ending in `:free` on OpenRouter works. Here are some good options:

| Model | ID |
|-------|-----|
| Step Flash 3.5 | `stepfun/step-3.5-flash:free` |
| Gemini Flash 2.0 | `google/gemini-2.0-flash-exp:free` |
| Llama 3.3 70B | `meta-llama/llama-3.3-70b-instruct:free` |

Set via the `MEMORAI_LLM_MODEL` environment variable.

---

## Troubleshooting

### Qdrant not starting

Check volume permissions. Qdrant needs write access to its storage volume. In Coolify logs you will see permission denied errors if this is the issue.

### API returns 500 errors

Most likely `OPENROUTER_API_KEY` is missing or invalid. Check the environment variables in Coolify and verify the key works:

```bash
curl https://openrouter.ai/api/v1/models \
  -H "Authorization: Bearer YOUR_OPENROUTER_KEY"
```

### First startup is slow

Normal. On first boot the API container downloads the HuggingFace embedding model (`multi-qa-MiniLM-L6-cos-v1`, ~80MB). The model is cached in the `model_cache` volume so subsequent restarts are fast.

### Memory / resource issues

The API needs approximately 1-2 GB of RAM for the embedding model. Make sure your Coolify server has enough available memory. Qdrant is lightweight and uses around 100-200 MB at idle.

### Cannot reach the API from Claude Code

- Verify the domain is correctly configured in Coolify and SSL is active
- Make sure `MEMORAI_API_URL` in `.mcp.json` uses `https://` and has no trailing slash
- If using `MEMORAI_API_KEY`, confirm the same key is in both Coolify env vars and `.mcp.json`

---

## Updating

**From GitHub:** Push changes to your repo and click **Redeploy** in Coolify. If you have webhooks configured, it deploys automatically on push.

**Manual:** Go to [panel.mywebsites.dev](https://panel.mywebsites.dev) > your MemorAI project > click **Redeploy**.

Data in Qdrant persists across redeployments thanks to the `qdrant_data` Docker volume.

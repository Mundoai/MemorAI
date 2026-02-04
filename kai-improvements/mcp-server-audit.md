# MCP Server Audit — MemorAI

> Analysis of `mcp-server/src/index.ts` and its production readiness.

## 1. Overview

The MCP server is a **stdio-based MCP (Model Context Protocol) server** that wraps the MemorAI FastAPI backend. It provides Claude Code (and other MCP clients) with tools to store, search, list, update, and delete memories.

- **Runtime:** Node.js (ESM)
- **Transport:** Stdio (StdioServerTransport)
- **SDK:** `@modelcontextprotocol/sdk ^1.0.0`
- **Language:** TypeScript (strict mode, ES2022 target)
- **Config:** Environment variables `MEMORAI_API_URL` and `MEMORAI_API_KEY`

## 2. Tools Exposed

| Tool | Description | Parameters | API Endpoint |
|------|-------------|-----------|-------------|
| `memory_store` | Store new memory from text | `project` (required), `content` (required), `agent` (optional), `metadata` (optional) | `POST /memories` |
| `memory_search` | Semantic search across memories | `query` (required), `project` (optional), `agent` (optional), `limit` (optional, default 10) | `POST /search` |
| `memory_list` | List all memories for a project | `project` (required), `agent` (optional) | `GET /memories` |
| `memory_update` | Update an existing memory | `memory_id` (required), `content` (required) | `PUT /memories/{id}` |
| `memory_delete` | Delete a single memory | `memory_id` (required) | `DELETE /memories/{id}` |
| `memory_delete_all` | Delete ALL memories for a project | `project` (required) | `DELETE /memories?user_id=X` |
| `memory_history` | Get change history for a memory | `memory_id` (required) | `GET /memories/{id}/history` |
| `memory_health` | Check API health | (none) | `GET /health` |
| `auto_recall` | Recall context at session start | `project` (required), `context` (optional), `limit` (optional, default 15) | `POST /search` or `GET /memories` |
| `memory_context` | Get structured space summary | `project` (required) | `GET /memories` |

**Total: 10 tools** — comprehensive coverage of the API surface.

## 3. Strengths

### Well-Designed
- ✅ **Excellent tool descriptions** — each tool has detailed, LLM-friendly descriptions explaining when and how to use it
- ✅ **Proper error handling** — all tools catch errors and return `isError: true` with descriptive messages
- ✅ **Clean HTTP abstraction** — `apiRequest` helper handles all HTTP concerns (URL building, headers, content types, 204 handling)
- ✅ **Good parameter validation** — uses Zod schemas with min/max constraints and descriptive `.describe()` annotations
- ✅ **Network error differentiation** — separate error messages for connection failures vs API errors

### Architecture
- ✅ **Stateless** — no local state, just proxies to the API
- ✅ **Config via env vars** — clean separation of config from code
- ✅ **Sensible defaults** — API URL defaults to localhost:8000, agent defaults to "claude"
- ✅ **Smart auto_recall** — uses search when context is provided, falls back to listing when not

### Production Quality
- ✅ **TypeScript strict mode** — catches type errors at compile time
- ✅ **Proper package.json** — build, start, dev scripts all present
- ✅ **ESM module** — modern JavaScript module system

## 4. Issues Found

### 🔴 Critical

**C1: Missing `zod` dependency in package.json**
- The code imports `z` from `zod` but `zod` is not listed in `dependencies` or `devDependencies`
- This means `npm install` won't install it, and the server will crash on startup
- **Fix:** Add `"zod": "^3.22.0"` to `dependencies`

### 🟡 Medium

**M1: No request timeout**
- `apiRequest` uses native `fetch` with no timeout
- If the API hangs, the MCP tool call hangs forever
- **Fix:** Add `AbortController` with a 30s timeout (like the dashboard client does)

**M2: No retry logic for transient failures**
- Network blips cause immediate failure
- **Fix:** Add 1 retry with exponential backoff for 5xx errors and connection failures

**M3: `memory_delete_all` lacks confirmation**
- Destructive operation with no safety net — an LLM could accidentally delete all memories
- **Fix:** Add a `confirm` parameter (e.g., `confirm: z.literal(true)`) or require the project name to be typed twice

**M4: No JWT/Bearer token support**
- Only supports `X-API-Key` header authentication
- The API also supports JWT Bearer tokens, which the dashboard uses
- **Fix:** Add `MEMORAI_JWT_TOKEN` env var support and `Authorization: Bearer` header

### 🟢 Low

**L1: `auto_recall` slices results in-memory**
- When no context is provided, it fetches ALL memories then slices to `limit`
- For spaces with thousands of memories, this is wasteful
- **Fix:** Pass `limit` as a query parameter to the API (requires API-side pagination support)

**L2: No structured logging**
- Uses `console.error` only for startup messages
- No request logging, no timing, no error logging to stderr
- **Fix:** Add structured logging for debugging production issues

**L3: `memory_context` is naive**
- Just returns the memory count and first 10 memories
- Doesn't actually summarize patterns or extract themes
- **Fix:** Either rename to `memory_overview` or add LLM-based summarization

**L4: Missing `run_id` support in store**
- The API supports `run_id` for session tracking, but the MCP tool doesn't expose it
- **Fix:** Add optional `session_id` parameter to `memory_store`

**L5: No PATCH method in apiRequest**
- `ApiRequestOptions` includes `PATCH` but it's never used — minor dead code

## 5. Missing Features

| Feature | Priority | Effort |
|---------|----------|--------|
| Bulk store (multiple memories in one call) | Medium | 2h |
| Memory search with filters (by date, by metadata) | Medium | 3h |
| Export/import memories | Low | 4h |
| Rate limiting awareness | Low | 2h |
| Pagination support for memory_list | Medium | 2h |

## 6. Production Readiness Assessment

| Criteria | Status | Notes |
|----------|--------|-------|
| Functionality | ✅ Ready | All core operations covered |
| Error Handling | ✅ Good | All tools handle errors gracefully |
| Type Safety | ✅ Good | Strict TypeScript, Zod validation |
| Security | ⚠️ Partial | API key auth works, but no JWT support |
| Reliability | ⚠️ Needs work | No timeouts, no retries |
| Dependencies | ❌ Broken | Missing `zod` in package.json |
| Logging | ⚠️ Minimal | Only startup messages |
| Documentation | ✅ Good | Tool descriptions are excellent |

### Verdict: **Almost production-ready** — fix the zod dependency, add timeouts, and it's good to go.

## 7. Recommended Fixes (Priority Order)

1. **Add `zod` to package.json dependencies** (5 min, critical)
2. **Add request timeout via AbortController** (15 min)
3. **Add JWT Bearer token support** (15 min)
4. **Add confirmation to `memory_delete_all`** (10 min)
5. **Add basic stderr logging for tool calls** (20 min)

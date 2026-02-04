# Kai's Memory Strategy for MemorAI

> How Kai (AI agent on OpenClaw) should use MemorAI as a persistent semantic memory layer.

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                   Kai's Memory Stack                 │
├─────────────────────────────────────────────────────┤
│ Layer 1: Context Window (ephemeral, per-turn)       │
│   - Current conversation, tool outputs              │
├─────────────────────────────────────────────────────┤
│ Layer 2: Flat Files (session-local, quick access)   │
│   - MEMORY.md — curated long-term summary           │
│   - memory/YYYY-MM-DD.md — daily raw logs           │
│   - HEARTBEAT.md — periodic task checklist          │
├─────────────────────────────────────────────────────┤
│ Layer 3: MemorAI (semantic, cross-session)          │
│   - Space: "kai" (user_id=kai)                      │
│   - Searchable via natural language                 │
│   - Auto-dedup, contradiction resolution            │
│   - Categories: decisions, tasks, context, lessons  │
└─────────────────────────────────────────────────────┘
```

## 2. What Goes Where

### Flat Files (MEMORY.md / daily notes)
- **Session boot context** — read on startup, fast access
- **Today's raw activity log** — what happened this session
- **Quick-reference info** — API keys, tool configs, names
- **Heartbeat state** — last-check timestamps
- **Ephemeral tasks** — things only relevant today/this week

### MemorAI (kai space)
- **Decisions & rationale** — why we chose X over Y
- **Project knowledge** — architecture, tech stack, patterns per project
- **Lessons learned** — mistakes, gotchas, workarounds
- **User preferences** — how the human likes things done
- **Cross-session context** — things that matter weeks/months later
- **Relationship data** — who works on what, contact preferences

### Rule of Thumb
> If you'd want to remember it 2 weeks from now but might not have it in MEMORY.md, put it in MemorAI.

## 3. Memory Schema for Kai's Space

### Space Configuration
- **user_id:** `kai`
- **agent_id:** `kai` (for self-generated), `kai-subagent` (for sub-agents)

### Categories (via metadata.category)

| Category | What Gets Stored | Example |
|----------|-----------------|---------|
| `decisions` | Architecture choices, tool selections, strategy changes | "Decided to use Drizzle ORM instead of Prisma for MemorAI dashboard" |
| `tasks` | Task status, blockers, completion notes | "MemorAI dashboard audit complete. Found 15 issues." |
| `context` | Project context, tech stack, environment details | "VestorsHub uses Next.js 15, deployed on Coolify" |
| `lessons` | Mistakes made, gotchas discovered, best practices | "PowerShell curl is Invoke-WebRequest alias, use Invoke-RestMethod instead" |
| `sessions` | Session summaries, what was accomplished | "2026-02-04: Completed MemorAI improvements audit, created kai space" |
| `preferences` | User preferences, communication style, workflow habits | "Human prefers concise responses, bullet points over paragraphs" |

### Metadata Schema

```json
{
  "category": "decisions|tasks|context|lessons|sessions|preferences",
  "project": "memorai|vestorshub|general",
  "importance": "low|medium|high|critical",
  "tags": ["tag1", "tag2"],
  "session_date": "2026-02-04",
  "expires": "2026-03-04"  // optional: for time-limited context
}
```

## 4. Sync Strategy

### When to Sync (Write to MemorAI)

1. **End of significant work block** — after completing a task or making a decision
2. **After learning something new** — gotchas, patterns, preferences
3. **Session end summary** — condense what happened into 1-3 memories
4. **When MEMORY.md is updated** — sync the most important additions

### When to Recall (Read from MemorAI)

1. **Session start** — use `auto_recall` with context about what you're working on
2. **Before starting a project** — search for project-specific memories
3. **When MEMORY.md doesn't have what you need** — semantic search
4. **Before making a decision** — check if similar decisions were made before

### Sync Workflow

```
Session Start:
  1. Read MEMORY.md (fast, local)
  2. Read today's daily note
  3. Call MemorAI search with session context → get relevant memories
  
During Session:
  4. Work normally, log to daily notes
  5. After important decisions → store to MemorAI immediately
  
Session End / Heartbeat:
  6. Review what happened
  7. Store 1-3 session summary memories to MemorAI
  8. Update MEMORY.md with distilled version
```

### Auto-Sync Triggers

| Trigger | Action | Category |
|---------|--------|----------|
| Decision made about architecture/tools | Store immediately | `decisions` |
| Task completed or blocked | Store status update | `tasks` |
| New project context discovered | Store | `context` |
| Error encountered and resolved | Store lesson | `lessons` |
| Session ending | Store summary | `sessions` |
| User expresses preference | Store | `preferences` |

## 5. Memory Hygiene

### Deduplication
Mem0 handles dedup automatically. When storing, if a similar memory exists, it updates rather than creates duplicates. This means:
- Don't worry about storing the same insight twice
- Updates naturally override stale information
- Contradictions get resolved by Mem0's LLM

### Importance Scoring (Manual for Now)
Use `metadata.importance` to flag critical memories:
- **critical** — Must never forget (security decisions, user hard preferences)
- **high** — Important decisions, recurring patterns
- **medium** — Default, general context
- **low** — Nice to have, may expire

### Expiration
For time-limited context (e.g., "deployment is broken"), add `metadata.expires`. During heartbeat memory maintenance, clean up expired memories.

### Memory Review Cadence
During heartbeat maintenance (every few days):
1. Search MemorAI for outdated memories
2. Update or delete stale information
3. Consolidate fragmented memories into summaries
4. Sync important discoveries from daily notes to MemorAI

## 6. Integration Method

### Preferred: MCP Server
The MCP server (`memorai-mcp-server`) exposes all tools needed:
- `memory_store` — store new memories
- `memory_search` — semantic search
- `memory_list` — browse all memories in a space
- `memory_update` — update existing memory
- `memory_delete` — remove single memory
- `auto_recall` — session-start context loading
- `memory_context` — space summary

### Fallback: Direct HTTP API
If MCP isn't available, use the REST API directly:
```
POST https://memoria-api.mywebsites.dev/memories  (store)
POST https://memoria-api.mywebsites.dev/search    (search)
GET  https://memoria-api.mywebsites.dev/memories?user_id=kai  (list)
```

## 7. Current State

As of 2026-02-04:
- **kai space created** with 8 seed memories
- **Categories defined:** decisions, tasks, context, lessons, sessions, preferences
- **API healthy:** Qdrant connected, embeddings via multi-qa-MiniLM-L6-cos-v1
- **5 other spaces exist:** vestorshub, vestmenthub, psicologoai, asistenteai, rooferscrm

## 8. Example Usage Patterns

### Storing a Decision
```
Store: "Decided to use PostgreSQL with Drizzle ORM for the MemorAI dashboard instead of SQLite, because we need multi-user support and the dashboard runs in Docker with a shared Postgres instance."
metadata: { category: "decisions", project: "memorai", importance: "high" }
```

### Recalling Project Context
```
Search: "What tech stack does MemorAI use?"
→ Returns: FastAPI + Qdrant + Mem0 for API, Next.js + Drizzle for dashboard
```

### Session Summary
```
Store: "2026-02-04 session: Audited MemorAI codebase. Created kai memory space. Found 15 dashboard bugs. Wrote improvement proposals including importance scoring, memory chains, and TTL-based archival."
metadata: { category: "sessions", session_date: "2026-02-04" }
```

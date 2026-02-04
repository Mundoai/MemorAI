# Feature Proposals — MemorAI

> Improvements to make MemorAI more useful for AI agents, especially for Kai's use case.

---

## Proposal 1: Importance Scoring & Priority Retrieval

### Problem
All memories are treated equally. When an agent recalls context, critical decisions are weighted the same as minor observations. The agent has no way to say "this is important" at storage time.

### Solution
Add an `importance` field (0-10 integer) that:
- Can be set at storage time via metadata
- Is auto-scored by the LLM during memory extraction (based on specificity, actionability, uniqueness)
- Influences search ranking (multiply similarity score by importance weight)
- Can be updated later (e.g., bump importance when a memory is recalled frequently)

### Implementation

**API changes:**
- Add `importance` field to `MemoryCreate` model (optional, default 5)
- Modify search to factor in importance: `final_score = similarity * (0.5 + importance/20)`
- Add `GET /memories?min_importance=7` filter

**MCP changes:**
- Add `importance` parameter to `memory_store` tool
- Add `min_importance` parameter to `memory_search` tool

**Effort:** 4-6 hours  
**Impact:** High — dramatically improves recall quality

---

## Proposal 2: Memory Chains (Linked Memories)

### Problem
Related memories are disconnected. A decision about "using PostgreSQL" and the follow-up "migrated from SQLite to PostgreSQL" are stored as unrelated facts. Agents can't follow the thread of a decision.

### Solution
Add `parent_id` and `chain_id` fields to memories:
- `chain_id` groups related memories (e.g., all memories about a single decision)
- `parent_id` links to the previous memory in the chain
- Retrieving one memory can optionally fetch its chain
- Chains have a `topic` label for easy browsing

### Implementation

**New model:**
```python
class MemoryChain(BaseModel):
    chain_id: str  # UUID
    topic: str     # e.g., "Database migration decision"
    user_id: str
    created_at: datetime
```

**API changes:**
- Add `chain_id` and `parent_id` to memory metadata
- New endpoint: `GET /chains?user_id=kai` — list all chains
- New endpoint: `GET /chains/{chain_id}` — get all memories in a chain
- When searching, option to `expand_chains=true` to include sibling memories

**MCP changes:**
- Add `chain` parameter to `memory_store` (creates or appends to chain)
- Add `memory_chain` tool to browse chains

**Effort:** 8-12 hours  
**Impact:** High — enables narrative/sequential memory

---

## Proposal 3: TTL-Based Archival & Memory Decay

### Problem
Memories accumulate forever. "The deployment is broken" stored 3 months ago is still returned with high relevance. There's no way to age out stale information.

### Solution
Implement a memory lifecycle:

```
Active → Aging → Archived → (Deleted)
  │         │         │
  │  30d no │  90d    │  manual or
  │  recall  │  no     │  365d
  │         │  recall  │
```

- **Active:** Normal retrieval, full weight in search
- **Aging:** Reduced weight in search (score * 0.7), tagged for review
- **Archived:** Not returned in normal search, available via `include_archived=true`
- **Deleted:** Permanently removed (optional, configurable)

### Implementation

**DB changes:**
- Add `status` field: `active|aging|archived`
- Add `last_recalled_at` timestamp (updated on search hit)
- Add `ttl_days` field (optional, per-memory expiration)

**Background job:**
- Run daily: memories not recalled in 30 days → aging
- Memories not recalled in 90 days → archived
- Memories with `ttl_days` past expiration → archived

**API changes:**
- New endpoint: `POST /memories/maintenance` — trigger lifecycle processing
- Add `include_archived` param to search
- Return `status` in memory objects

**Effort:** 12-16 hours  
**Impact:** Medium-High — keeps memory space clean and relevant

---

## Proposal 4: Auto-Tagging via LLM

### Problem
Memories are stored with categories but no fine-grained tags. Manual tagging is tedious. Agents need to find memories by topic without exact keyword matching.

### Solution
When a memory is stored, use the LLM to auto-generate 2-5 tags:
- Extract key concepts (e.g., "postgresql", "migration", "database")
- Match against existing tags in the space (prefer reuse)
- Create new tags when needed
- Store as both metadata and in the dashboard's tag system

### Implementation

**API changes:**
- After Mem0 processes the memory, make a second LLM call:
  ```
  "Given this memory: '{memory}', generate 2-5 relevant tags as a JSON array. 
   Prefer these existing tags: {existing_tags}"
  ```
- Store tags in memory metadata and sync to dashboard tag tables

**Cost consideration:**
- Extra LLM call per memory store (minimal with free OpenRouter models)
- Could be made async/background to not slow down store response

**Effort:** 4-6 hours  
**Impact:** Medium — improves discoverability significantly

---

## Proposal 5: Cross-Space Search

### Problem
Each space is isolated. An agent working on multiple projects can't search across all projects at once. "What databases have we used across all projects?" requires searching each space individually.

### Solution
- Add `POST /search/global` endpoint that searches across all spaces
- Results include the space/user_id so the agent knows which project the memory belongs to
- Dashboard gets a "Global Search" mode toggle
- Access control: only return memories from spaces the authenticated user has access to

### Implementation

**API changes:**
- New endpoint: `POST /search/global` — search without user_id filter
- Returns results with `user_id` (space) included for attribution
- Limit to 50 results maximum

**Dashboard changes:**
- Add "All Spaces" toggle to search page
- Show space badge on each result

**MCP changes:**
- Make `project` optional in `memory_search` (already is, but document it better)

**Effort:** 3-4 hours  
**Impact:** Medium — useful for multi-project agents

---

## Proposal 6: Memory Webhooks / Event Stream

### Problem
External systems can't react to memory changes. If an important memory is stored, there's no way to trigger notifications, sync to other systems, or update dashboards in real-time.

### Solution
- Add webhook configuration per space
- Fire webhooks on: memory_created, memory_updated, memory_deleted
- Payload includes memory content, metadata, and event type
- Dashboard gets real-time updates via SSE or WebSocket

### Implementation

**DB changes:**
- New `space_webhooks` table: `id, space_id, url, events[], secret, active`

**API changes:**
- New endpoints: CRUD for webhooks under `/spaces/{slug}/webhooks`
- After memory operations, fire matching webhooks (async, don't block response)
- HMAC signature in webhook headers for verification

**Dashboard:**
- Webhook configuration UI in space settings
- SSE endpoint for live memory feed

**Effort:** 16-20 hours  
**Impact:** Medium — enables integration ecosystem

---

## Proposal 7: Memory Templates & Structured Storage

### Problem
Memories are freeform text. An agent storing a "decision" and a "task status" use the same unstructured format. This makes it harder to query and display memories by type.

### Solution
Define memory templates per category:

```json
{
  "decision": {
    "fields": ["what", "why", "alternatives_considered", "decided_by"],
    "template": "Decision: {what}. Rationale: {why}. Alternatives: {alternatives_considered}."
  },
  "task": {
    "fields": ["task_name", "status", "blockers", "next_steps"],
    "template": "Task '{task_name}' is {status}. Blockers: {blockers}. Next: {next_steps}."
  }
}
```

- Templates are defined per space in settings
- When storing, the agent can pass structured fields
- The template generates the text for embedding
- Structured fields are stored in metadata for querying

### Implementation

**API changes:**
- Accept optional `template` and `fields` in MemoryCreate
- If provided, render template → use as memory text
- Store fields in metadata for structured retrieval

**MCP changes:**
- Add `template` parameter to `memory_store`
- Add tool descriptions explaining available templates

**Effort:** 6-8 hours  
**Impact:** Medium — enables richer querying and display

---

## Proposal 8: Memory Usage Analytics

### Problem
No visibility into how memories are being used. Which memories are recalled most? Which spaces are most active? Are there orphaned memories nobody searches for?

### Solution
Track and expose analytics:
- **Store events:** memory_created, memory_searched, memory_recalled
- **Per-memory stats:** recall_count, last_recalled_at, search_appearances
- **Per-space stats:** total_memories, active_memories, avg_recall_frequency
- **Dashboard analytics page** with charts

### Implementation

**DB changes:**
- New `memory_events` table: `id, memory_id, event_type, user_id, timestamp`
- Or simpler: add `recall_count` and `last_recalled_at` to memory metadata

**API changes:**
- On search results, increment `recall_count` for returned memories
- New endpoint: `GET /analytics?user_id=kai` — memory usage stats

**Dashboard:**
- New Analytics page with:
  - Most recalled memories
  - Memory creation over time
  - Unused memories (candidates for archival)

**Effort:** 12-16 hours  
**Impact:** Medium — enables data-driven memory management

---

## Priority Ranking

| # | Proposal | Impact | Effort | Priority |
|---|----------|--------|--------|----------|
| 1 | Importance Scoring | High | 4-6h | 🔴 P1 |
| 4 | Auto-Tagging | Medium | 4-6h | 🟡 P2 |
| 5 | Cross-Space Search | Medium | 3-4h | 🟡 P2 |
| 2 | Memory Chains | High | 8-12h | 🟡 P2 |
| 3 | TTL-Based Archival | Medium-High | 12-16h | 🟡 P2 |
| 7 | Memory Templates | Medium | 6-8h | 🟢 P3 |
| 8 | Usage Analytics | Medium | 12-16h | 🟢 P3 |
| 6 | Webhooks | Medium | 16-20h | 🟢 P3 |

### Quick Wins (< 4 hours each)
1. Add `importance` metadata support to existing store/search (2h)
2. Make cross-space search work by omitting user_id (1h)  
3. Add `last_recalled_at` tracking on search (2h)
4. Add memory status field for basic lifecycle management (3h)

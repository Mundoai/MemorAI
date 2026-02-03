#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const API_BASE_URL =
  process.env.MEMORAI_API_URL?.replace(/\/+$/, "") ?? "http://localhost:8000";

const API_KEY = process.env.MEMORAI_API_KEY ?? "";

// ---------------------------------------------------------------------------
// HTTP helper
// ---------------------------------------------------------------------------

interface ApiRequestOptions {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  body?: unknown;
  params?: Record<string, string | number | boolean | undefined>;
}

async function apiRequest<T = unknown>(opts: ApiRequestOptions): Promise<T> {
  const url = new URL(`${API_BASE_URL}${opts.path}`);

  if (opts.params) {
    for (const [key, value] of Object.entries(opts.params)) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  if (API_KEY) {
    headers["X-API-Key"] = API_KEY;
  }

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method: opts.method,
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown network error";
    throw new Error(
      `Failed to connect to Mem0 API at ${API_BASE_URL}. ` +
        `Is the Mem0 service running? Error: ${message}`
    );
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `Mem0 API returned ${response.status} ${response.statusText}: ${text}`
    );
  }

  // 204 No Content has no body
  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

// ---------------------------------------------------------------------------
// MCP Server
// ---------------------------------------------------------------------------

const server = new McpServer({
  name: "memorai",
  version: "1.0.0",
});

// ---- memory_store ---------------------------------------------------------

server.tool(
  "memory_store",
  `Store a new memory in Mem0.

Use this tool to persist important information for later recall: decisions made,
user preferences, patterns observed, issues encountered, lessons learned, or
general context about a project. Memories are automatically extracted and stored
with semantic embeddings so they can be retrieved via natural-language search.

The content is sent as a user message to Mem0, which extracts and indexes the
relevant memories. The project parameter maps to Mem0's user_id, allowing you
to namespace memories per project.

Returns Mem0's response with the extracted memories and their IDs.`,
  {
    project: z
      .string()
      .describe(
        "Project name / namespace for the memory. Maps to user_id in Mem0."
      ),
    content: z
      .string()
      .describe(
        "The textual content of the memory. Be detailed and descriptive so Mem0 can extract meaningful memories from it."
      ),
    agent: z
      .string()
      .optional()
      .default("claude")
      .describe(
        "Name of the agent storing the memory. Maps to agent_id in Mem0. Defaults to 'claude'."
      ),
    metadata: z
      .record(z.string(), z.unknown())
      .optional()
      .describe("Arbitrary key-value metadata to attach to the memory"),
  },
  async ({ project, content, agent, metadata }) => {
    try {
      const body: Record<string, unknown> = {
        messages: [{ role: "user", content }],
        user_id: project,
        agent_id: agent ?? "claude",
      };
      if (metadata && Object.keys(metadata).length > 0) {
        body.metadata = metadata;
      }

      const result = await apiRequest({
        method: "POST",
        path: "/memories",
        body,
      });

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Unknown error";
      return {
        content: [{ type: "text" as const, text: `Error: ${message}` }],
        isError: true,
      };
    }
  }
);

// ---- memory_search --------------------------------------------------------

server.tool(
  "memory_search",
  `Search memories by semantic similarity using Mem0's vector search.

Use this tool to recall previously stored information. The query is matched
against all stored memories using vector/semantic search, so you can use
natural language (you don't need exact keywords). Optionally filter by project
(user_id) or agent (agent_id) to narrow results.

Returns an array of matching memories ordered by relevance, including
similarity scores.`,
  {
    query: z
      .string()
      .describe("Natural-language search query"),
    project: z
      .string()
      .optional()
      .describe(
        "Filter by project name (maps to user_id). Omit to search across all projects."
      ),
    agent: z
      .string()
      .optional()
      .describe("Filter by agent name (maps to agent_id)"),
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .optional()
      .default(10)
      .describe("Maximum number of results to return (default 10, max 100)"),
  },
  async ({ query, project, agent, limit }) => {
    try {
      const body: Record<string, unknown> = {
        query,
        limit: limit ?? 10,
      };
      if (project) body.user_id = project;
      if (agent) body.agent_id = agent;

      const result = await apiRequest({
        method: "POST",
        path: "/search",
        body,
      });

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Unknown error";
      return {
        content: [{ type: "text" as const, text: `Error: ${message}` }],
        isError: true,
      };
    }
  }
);

// ---- memory_list ----------------------------------------------------------

server.tool(
  "memory_list",
  `List all memories stored for a specific project.

Returns all memories for the given project (user_id), ordered by creation date.
Use this to browse what has been stored rather than searching for something
specific.`,
  {
    project: z
      .string()
      .describe("Project name to list memories for (maps to user_id)"),
    agent: z
      .string()
      .optional()
      .describe("Filter by agent name (maps to agent_id)"),
  },
  async ({ project, agent }) => {
    try {
      const params: Record<string, string | undefined> = {
        user_id: project,
      };
      if (agent) params.agent_id = agent;

      const result = await apiRequest({
        method: "GET",
        path: "/memories",
        params,
      });

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Unknown error";
      return {
        content: [{ type: "text" as const, text: `Error: ${message}` }],
        isError: true,
      };
    }
  }
);

// ---- memory_update --------------------------------------------------------

server.tool(
  "memory_update",
  `Update an existing memory by its ID.

Replaces the content of a previously stored memory with new text. Use this when
you need to correct or refine a memory that was already stored. The memory_id
is the UUID returned when the memory was originally created.`,
  {
    memory_id: z
      .string()
      .describe("The unique UUID of the memory to update"),
    content: z
      .string()
      .describe("New content for the memory"),
  },
  async ({ memory_id, content }) => {
    try {
      const result = await apiRequest({
        method: "PUT",
        path: `/memories/${memory_id}`,
        body: { data: content },
      });

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Unknown error";
      return {
        content: [{ type: "text" as const, text: `Error: ${message}` }],
        isError: true,
      };
    }
  }
);

// ---- memory_delete --------------------------------------------------------

server.tool(
  "memory_delete",
  `Delete a single memory by its unique ID.

Permanently removes a memory from Mem0. This action cannot be undone. The
memory_id is the UUID returned when the memory was originally created.`,
  {
    memory_id: z
      .string()
      .describe("The unique UUID of the memory to delete"),
  },
  async ({ memory_id }) => {
    try {
      const result = await apiRequest({
        method: "DELETE",
        path: `/memories/${memory_id}`,
      });

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              result ?? { success: true, message: `Memory ${memory_id} deleted.` },
              null,
              2
            ),
          },
        ],
      };
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Unknown error";
      return {
        content: [{ type: "text" as const, text: `Error: ${message}` }],
        isError: true,
      };
    }
  }
);

// ---- memory_delete_all ----------------------------------------------------

server.tool(
  "memory_delete_all",
  `Delete ALL memories for a specific project.

Permanently removes every memory associated with the given project (user_id)
from Mem0. This is a destructive bulk operation and cannot be undone. Use with
caution.`,
  {
    project: z
      .string()
      .describe(
        "Project name whose memories should all be deleted (maps to user_id)"
      ),
  },
  async ({ project }) => {
    try {
      const result = await apiRequest({
        method: "DELETE",
        path: "/memories",
        params: { user_id: project },
      });

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              result ?? {
                success: true,
                message: `All memories for project '${project}' deleted.`,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Unknown error";
      return {
        content: [{ type: "text" as const, text: `Error: ${message}` }],
        isError: true,
      };
    }
  }
);

// ---- memory_history -------------------------------------------------------

server.tool(
  "memory_history",
  `Get the change history for a specific memory.

Returns an array of historical versions showing how a memory has changed over
time. Useful for auditing when and how a memory was modified. The memory_id is
the UUID returned when the memory was originally created.`,
  {
    memory_id: z
      .string()
      .describe("The unique UUID of the memory to get history for"),
  },
  async ({ memory_id }) => {
    try {
      const result = await apiRequest({
        method: "GET",
        path: `/memories/${memory_id}/history`,
      });

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Unknown error";
      return {
        content: [{ type: "text" as const, text: `Error: ${message}` }],
        isError: true,
      };
    }
  }
);

// ---- memory_health --------------------------------------------------------

server.tool(
  "memory_health",
  `Check the health of the Mem0 API service.

Calls the /health endpoint to verify the Mem0 service is running and reachable.
Use this to diagnose connectivity issues before attempting other operations.`,
  {},
  async () => {
    try {
      const result = await apiRequest({
        method: "GET",
        path: "/health",
      });

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Unknown error";
      return {
        content: [{ type: "text" as const, text: `Error: ${message}` }],
        isError: true,
      };
    }
  }
);

// ---- auto_recall ----------------------------------------------------------

server.tool(
  "auto_recall",
  `Automatically recall relevant memories for a project at session start.

Call this tool at the beginning of a session to get the most relevant context
for the current project. Returns the top memories sorted by relevance, including
recent decisions, preferences, patterns, and gotchas.

Useful for agents to bootstrap their context without the user having to
explicitly search for relevant information.`,
  {
    project: z
      .string()
      .describe("Project name to recall context for (maps to user_id)"),
    context: z
      .string()
      .optional()
      .describe(
        "Optional context about what the agent is about to work on, to improve recall relevance"
      ),
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .optional()
      .default(15)
      .describe("Maximum number of memories to recall (default 15)"),
  },
  async ({ project, context, limit }) => {
    try {
      // If context is provided, use semantic search; otherwise list recent
      if (context) {
        const body: Record<string, unknown> = {
          query: context,
          user_id: project,
          limit: limit ?? 15,
        };

        const result = await apiRequest({
          method: "POST",
          path: "/search",
          body,
        });

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      // No context: return all memories for the project
      const result = await apiRequest({
        method: "GET",
        path: "/memories",
        params: { user_id: project },
      });

      // Limit the results
      const memories = Array.isArray(result)
        ? result.slice(0, limit ?? 15)
        : result;

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(memories, null, 2),
          },
        ],
      };
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Unknown error";
      return {
        content: [{ type: "text" as const, text: `Error: ${message}` }],
        isError: true,
      };
    }
  }
);

// ---- memory_context -------------------------------------------------------

server.tool(
  "memory_context",
  `Get a structured context summary for a project/space.

Returns a summary of the project's memory space including:
- Total memory count
- Recent memories
- Key patterns and decisions

Use this to quickly understand what a project is about without reading
every individual memory.`,
  {
    project: z
      .string()
      .describe("Project name to get context for (maps to user_id)"),
  },
  async ({ project }) => {
    try {
      const result = await apiRequest<unknown[]>({
        method: "GET",
        path: "/memories",
        params: { user_id: project },
      });

      const memories = Array.isArray(result) ? result : [];
      const total = memories.length;
      const recent = memories.slice(0, 10);

      const summary = {
        project,
        total_memories: total,
        recent_memories: recent,
        summary: `Project "${project}" has ${total} stored memories.`,
      };

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(summary, null, 2),
          },
        ],
      };
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Unknown error";
      return {
        content: [{ type: "text" as const, text: `Error: ${message}` }],
        isError: true,
      };
    }
  }
);

// ---------------------------------------------------------------------------
// Start the server
// ---------------------------------------------------------------------------

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MemorAI MCP server running on stdio");
  console.error(`Mem0 API base URL: ${API_BASE_URL}`);
}

main().catch((error) => {
  console.error("Fatal error starting MemorAI MCP server:", error);
  process.exit(1);
});

/**
 * Migration script: Existing Memories to Spaces (Story 2.4)
 *
 * Reads existing user_id strings from Mem0 memories, creates corresponding
 * Spaces in PostgreSQL, and ensures backward compatibility.
 *
 * Usage:
 *   DATABASE_URL=postgresql://... MEMORAI_API_URL=http://localhost:8000 npx tsx scripts/migrate-memories.ts
 *
 * Idempotent: safe to run multiple times.
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq } from "drizzle-orm";
import * as schema from "../lib/db/schema";

const API_URL = process.env.MEMORAI_API_URL ?? "http://localhost:8000";
const API_KEY = process.env.MEMORAI_API_KEY ?? "";
const DB_URL = process.env.DATABASE_URL;

if (!DB_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const client = postgres(DB_URL);
const db = drizzle(client, { schema });

interface Memory {
  id: string;
  memory: string;
  user_id?: string;
  agent_id?: string;
}

async function fetchAllMemories(): Promise<Memory[]> {
  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (API_KEY) headers["X-API-Key"] = API_KEY;

  const res = await fetch(`${API_URL}/memories`, { headers });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const data = await res.json();
  return Array.isArray(data)
    ? data
    : data?.results ?? [];
}

async function getOrCreateSystemUser(): Promise<string> {
  const existing = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, "system@memorai.local"))
    .limit(1);

  if (existing[0]) return existing[0].id;

  const [user] = await db
    .insert(schema.users)
    .values({
      name: "System Migration",
      email: "system@memorai.local",
      role: "user",
    })
    .returning();

  return user.id;
}

async function main() {
  console.log("Starting memory migration...");
  console.log(`API URL: ${API_URL}`);

  const memories = await fetchAllMemories();
  console.log(`Found ${memories.length} memories`);

  // Extract unique user_ids (project names)
  const projectNames = new Set<string>();
  for (const m of memories) {
    if (m.user_id) projectNames.add(m.user_id);
  }
  console.log(`Found ${projectNames.size} unique projects: ${[...projectNames].join(", ")}`);

  if (projectNames.size === 0) {
    console.log("No projects to migrate");
    await client.end();
    return;
  }

  const systemUserId = await getOrCreateSystemUser();

  for (const projectName of projectNames) {
    const slug = projectName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    // Check if space already exists
    const existing = await db
      .select({ id: schema.spaces.id })
      .from(schema.spaces)
      .where(eq(schema.spaces.slug, slug))
      .limit(1);

    if (existing[0]) {
      console.log(`  Space "${slug}" already exists, skipping`);
      continue;
    }

    // Create space
    const [space] = await db
      .insert(schema.spaces)
      .values({
        name: projectName,
        slug,
        description: `Migrated from legacy project: ${projectName}`,
        createdBy: systemUserId,
      })
      .returning();

    // Add system user as owner
    await db.insert(schema.spaceMembers).values({
      spaceId: space.id,
      userId: systemUserId,
      role: "owner",
    });

    console.log(`  Created space "${slug}" (${space.id})`);
  }

  console.log("Migration complete!");
  await client.end();
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});

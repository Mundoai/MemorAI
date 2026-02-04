import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import postgres from "postgres";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("[migrate] DATABASE_URL not set, skipping migrations");
  process.exit(0);
}

const sql = postgres(DATABASE_URL, { max: 1 });

async function migrate() {
  console.log("[migrate] Running database migrations...");

  // Create migrations tracking table if it doesn't exist
  await sql`
    CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
      id SERIAL PRIMARY KEY,
      hash TEXT NOT NULL UNIQUE,
      created_at BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)
    )
  `;

  const migrationsDir = join(import.meta.dirname, "lib", "db", "migrations");
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    // Check if already applied
    const applied =
      await sql`SELECT 1 FROM "__drizzle_migrations" WHERE hash = ${file}`;
    if (applied.length > 0) {
      console.log(`[migrate] Already applied: ${file}`);
      continue;
    }

    const content = readFileSync(join(migrationsDir, file), "utf-8");
    const statements = content
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);

    console.log(
      `[migrate] Applying ${file} (${statements.length} statements)...`
    );

    for (const stmt of statements) {
      await sql.unsafe(stmt);
    }

    await sql`INSERT INTO "__drizzle_migrations" (hash) VALUES (${file})`;
    console.log(`[migrate] Applied: ${file}`);
  }

  console.log("[migrate] All migrations applied successfully");
  await sql.end();
}

migrate().catch((err) => {
  console.error("[migrate] Migration failed:", err.message);
  process.exit(1);
});

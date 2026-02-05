import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { apiRequest } from "@/lib/api/client";
import { db } from "@/lib/db";
import { spaceMembers, spaces } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const userId = session.user.id;
  const debug: Record<string, unknown> = {
    userId,
    apiBaseUrl: process.env.MEMORAI_API_URL ?? "not set",
    timestamp: new Date().toISOString(),
  };

  // Step 1: Get spaces from DB
  try {
    const memberSpaces = await db
      .select({
        spaceId: spaceMembers.spaceId,
        spaceName: spaces.name,
        spaceSlug: spaces.slug,
      })
      .from(spaceMembers)
      .innerJoin(spaces, eq(spaces.id, spaceMembers.spaceId))
      .where(and(eq(spaceMembers.userId, userId), isNull(spaces.deletedAt)));

    debug.spaces = memberSpaces;
    debug.spaceSlugs = memberSpaces.map((s) => s.spaceSlug);
  } catch (err) {
    debug.spacesError = String(err);
  }

  // Step 2: Fetch memories for each slug sequentially
  const slugs = (debug.spaceSlugs as string[]) ?? [];
  const perSlug: Record<string, unknown> = {};

  for (const slug of slugs) {
    const start = Date.now();
    try {
      const result = await apiRequest<unknown>({
        method: "GET",
        path: "/memories",
        params: { user_id: slug },
      });
      const elapsed = Date.now() - start;

      let count = 0;
      if (Array.isArray(result)) {
        count = result.length;
      } else if (result && typeof result === "object" && "results" in result) {
        count = (result as { results: unknown[] }).results.length;
      }

      perSlug[slug] = { count, elapsed, responseType: Array.isArray(result) ? "array" : typeof result };
    } catch (err) {
      perSlug[slug] = { error: String(err), elapsed: Date.now() - start };
    }
  }

  debug.memoriesPerSlug = perSlug;
  debug.totalMemories = Object.values(perSlug).reduce((sum, v) => {
    const obj = v as Record<string, unknown>;
    return sum + (typeof obj.count === "number" ? obj.count : 0);
  }, 0);

  return NextResponse.json(debug, { status: 200 });
}

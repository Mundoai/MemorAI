import { auth } from "@/lib/auth";
import { apiRequest } from "@/lib/api/client";
import { db } from "@/lib/db";
import { spaceMembers, spaces, memoryTags, tags, memoryBookmarks } from "@/lib/db/schema";
import { eq, and, inArray, isNull } from "drizzle-orm";
import { MemoryBrowser } from "@/components/memories/memory-browser";

interface Memory {
  id: string;
  memory: string;
  user_id?: string;
  agent_id?: string;
  created_at?: string;
  updated_at?: string;
  metadata?: Record<string, unknown>;
}

async function getUserSpaces(userId: string) {
  // Get spaces via membership
  const memberSpaces = await db
    .select({
      spaceId: spaceMembers.spaceId,
      spaceName: spaces.name,
      spaceSlug: spaces.slug,
    })
    .from(spaceMembers)
    .innerJoin(spaces, eq(spaces.id, spaceMembers.spaceId))
    .where(and(eq(spaceMembers.userId, userId), isNull(spaces.deletedAt)));

  // Also include spaces created by this user (owner fallback)
  const createdSpaces = await db
    .select({
      spaceId: spaces.id,
      spaceName: spaces.name,
      spaceSlug: spaces.slug,
    })
    .from(spaces)
    .where(and(eq(spaces.createdBy, userId), isNull(spaces.deletedAt)));

  // Merge and deduplicate by spaceId
  const seen = new Set(memberSpaces.map((s) => s.spaceId));
  const merged = [...memberSpaces];
  for (const s of createdSpaces) {
    if (!seen.has(s.spaceId)) {
      merged.push(s);
      seen.add(s.spaceId);
    }
  }
  return merged;
}

async function getMemoriesForSlug(slug: string): Promise<Memory[]> {
  try {
    const result = await apiRequest<Memory[] | { results: Memory[] }>({
      method: "GET",
      path: "/memories",
      params: { user_id: slug },
    });
    if (Array.isArray(result)) return result;
    if (result && "results" in result) return result.results;
    console.error(`[getMemoriesForSlug] Unexpected result format for slug=${slug}:`, result);
    return [];
  } catch (err) {
    console.error(`[getMemoriesForSlug] Failed for slug=${slug}:`, err);
    return [];
  }
}

async function getMemories(
  spaceSlug?: string,
  allSlugs?: string[]
): Promise<Memory[]> {
  if (spaceSlug) {
    return getMemoriesForSlug(spaceSlug);
  }
  // "All Spaces" — query each space and merge results
  if (allSlugs && allSlugs.length > 0) {
    const results = await Promise.all(allSlugs.map(getMemoriesForSlug));
    return results
      .flat()
      .sort(
        (a, b) =>
          new Date(b.created_at ?? 0).getTime() -
          new Date(a.created_at ?? 0).getTime()
      );
  }
  return [];
}

export default async function MemoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ space?: string; bookmarked?: string }>;
}) {
  const session = await auth();
  const params = await searchParams;
  const userSpaces = session?.user?.id ? await getUserSpaces(session.user.id) : [];
  const allSlugs = userSpaces.map((s) => s.spaceSlug);
  console.log(`[MemoriesPage] userId=${session?.user?.id}, spaces=${userSpaces.length}, slugs=${JSON.stringify(allSlugs)}, filter=${params.space}`);
  const memories = await getMemories(params.space, allSlugs);
  console.log(`[MemoriesPage] fetched ${memories.length} memories`);

  // Get bookmarked memory IDs for this user
  let bookmarkedIds: string[] = [];
  if (session?.user?.id) {
    try {
      const bookmarks = await db
        .select({ memoryId: memoryBookmarks.memoryId })
        .from(memoryBookmarks)
        .where(eq(memoryBookmarks.userId, session.user.id));
      bookmarkedIds = bookmarks.map((b) => b.memoryId);
    } catch {
      // ignore
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Memories</h1>
        <p className="text-muted-foreground">
          Browse and manage stored memories across your spaces
        </p>
      </div>

      <MemoryBrowser
        memories={memories}
        spaces={userSpaces}
        bookmarkedIds={bookmarkedIds}
        currentSpace={params.space}
        showBookmarkedOnly={params.bookmarked === "true"}
      />
    </div>
  );
}

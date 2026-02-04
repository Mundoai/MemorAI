import { auth } from "@/lib/auth";
import { apiRequest } from "@/lib/api/client";
import { db } from "@/lib/db";
import { spaceMembers, spaces, memoryTags, tags, memoryBookmarks } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
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
  return db
    .select({
      spaceId: spaceMembers.spaceId,
      spaceName: spaces.name,
      spaceSlug: spaces.slug,
    })
    .from(spaceMembers)
    .innerJoin(spaces, eq(spaces.id, spaceMembers.spaceId))
    .where(and(eq(spaceMembers.userId, userId), eq(spaces.deletedAt, null!)));
}

async function getMemories(spaceSlug?: string): Promise<Memory[]> {
  try {
    const params: Record<string, string | undefined> = {};
    if (spaceSlug) {
      params.user_id = spaceSlug;
    }
    const result = await apiRequest<Memory[] | { results: Memory[] }>({
      method: "GET",
      path: "/memories",
      params,
    });
    if (Array.isArray(result)) return result;
    if (result && "results" in result) return result.results;
    return [];
  } catch {
    return [];
  }
}

export default async function MemoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ space?: string; bookmarked?: string }>;
}) {
  console.log("[memories] Starting page render...");
  const session = await auth();
  console.log("[memories] auth() done, user:", session?.user?.id);
  const params = await searchParams;
  console.log("[memories] searchParams resolved:", JSON.stringify(params));
  const memories = await getMemories(params.space);
  console.log("[memories] getMemories done, count:", memories.length);
  const userSpaces = session?.user?.id ? await getUserSpaces(session.user.id) : [];
  console.log("[memories] getUserSpaces done, count:", userSpaces.length);

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

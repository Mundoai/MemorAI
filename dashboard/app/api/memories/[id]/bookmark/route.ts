import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { memoryBookmarks } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: memoryId } = await params;
  const userId = session.user.id;

  try {
    // Check if already bookmarked
    const existing = await db
      .select()
      .from(memoryBookmarks)
      .where(
        and(
          eq(memoryBookmarks.memoryId, memoryId),
          eq(memoryBookmarks.userId, userId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      // Remove bookmark
      await db
        .delete(memoryBookmarks)
        .where(
          and(
            eq(memoryBookmarks.memoryId, memoryId),
            eq(memoryBookmarks.userId, userId)
          )
        );
      return Response.json({ bookmarked: false });
    }

    // Add bookmark
    await db.insert(memoryBookmarks).values({
      memoryId,
      userId,
    });

    return Response.json({ bookmarked: true });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to toggle bookmark" },
      { status: 500 }
    );
  }
}

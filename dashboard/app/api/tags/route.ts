import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { tags, spaceMembers, spaces } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { name, color, spaceSlug } = body;

  if (!name || !spaceSlug) {
    return Response.json({ error: "name and spaceSlug are required" }, { status: 400 });
  }

  // Verify membership
  const membership = await db
    .select({ spaceId: spaces.id })
    .from(spaceMembers)
    .innerJoin(spaces, eq(spaces.id, spaceMembers.spaceId))
    .where(
      and(
        eq(spaceMembers.userId, session.user.id),
        eq(spaces.slug, spaceSlug),
        isNull(spaces.deletedAt)
      )
    )
    .limit(1);

  if (!membership[0]) {
    return Response.json({ error: "Space not found" }, { status: 404 });
  }

  try {
    const [tag] = await db
      .insert(tags)
      .values({
        name,
        color: color || "#6366f1",
        spaceId: membership[0].spaceId,
        createdBy: session.user.id,
      })
      .returning();

    return Response.json(tag, { status: 201 });
  } catch (err) {
    if (
      err instanceof Error &&
      err.message.includes("unique")
    ) {
      return Response.json(
        { error: "Tag already exists in this space" },
        { status: 409 }
      );
    }
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to create tag" },
      { status: 500 }
    );
  }
}

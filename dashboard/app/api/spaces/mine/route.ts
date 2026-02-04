import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { spaces, spaceMembers } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Spaces via membership
    const memberSpaces = await db
      .select({
        spaceId: spaces.id,
        spaceName: spaces.name,
        spaceSlug: spaces.slug,
      })
      .from(spaceMembers)
      .innerJoin(spaces, eq(spaces.id, spaceMembers.spaceId))
      .where(
        and(eq(spaceMembers.userId, session.user.id), isNull(spaces.deletedAt))
      );

    // Also include spaces created by this user (owner fallback)
    const createdSpaces = await db
      .select({
        spaceId: spaces.id,
        spaceName: spaces.name,
        spaceSlug: spaces.slug,
      })
      .from(spaces)
      .where(
        and(eq(spaces.createdBy, session.user.id), isNull(spaces.deletedAt))
      );

    // Merge and deduplicate
    const seen = new Set(memberSpaces.map((s) => s.spaceId));
    const userSpaces = [...memberSpaces];
    for (const s of createdSpaces) {
      if (!seen.has(s.spaceId)) {
        userSpaces.push(s);
        seen.add(s.spaceId);
      }
    }

    return Response.json(userSpaces);
  } catch {
    return Response.json([], { status: 200 });
  }
}

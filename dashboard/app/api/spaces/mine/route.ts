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
    const userSpaces = await db
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

    return Response.json(userSpaces);
  } catch {
    return Response.json([], { status: 200 });
  }
}

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  spaces,
  spaceMembers,
  users,
  auditLogs,
} from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";

async function getSpaceAndRole(slug: string, userId: string) {
  const result = await db
    .select({
      spaceId: spaces.id,
      role: spaceMembers.role,
    })
    .from(spaces)
    .innerJoin(
      spaceMembers,
      and(eq(spaceMembers.spaceId, spaces.id), eq(spaceMembers.userId, userId))
    )
    .where(and(eq(spaces.slug, slug), isNull(spaces.deletedAt)))
    .limit(1);
  return result[0] ?? null;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug } = await params;
  const membership = await getSpaceAndRole(slug, session.user.id);
  if (!membership) {
    return Response.json({ error: "Space not found" }, { status: 404 });
  }

  const members = await db
    .select({
      id: spaceMembers.id,
      userId: spaceMembers.userId,
      role: spaceMembers.role,
      joinedAt: spaceMembers.joinedAt,
      userName: users.name,
      userEmail: users.email,
      userImage: users.image,
    })
    .from(spaceMembers)
    .innerJoin(users, eq(users.id, spaceMembers.userId))
    .where(eq(spaceMembers.spaceId, membership.spaceId));

  return Response.json(members);
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug } = await params;
  const membership = await getSpaceAndRole(slug, session.user.id);
  if (!membership) {
    return Response.json({ error: "Space not found" }, { status: 404 });
  }

  // Only owner/admin can remove members
  if (membership.role !== "owner" && membership.role !== "admin") {
    return Response.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const body = await req.json();
  const { userId } = body;

  if (!userId) {
    return Response.json({ error: "userId is required" }, { status: 400 });
  }

  // Can't remove yourself if you're the owner
  if (userId === session.user.id && membership.role === "owner") {
    return Response.json(
      { error: "Owner cannot remove themselves" },
      { status: 400 }
    );
  }

  try {
    await db
      .delete(spaceMembers)
      .where(
        and(
          eq(spaceMembers.spaceId, membership.spaceId),
          eq(spaceMembers.userId, userId)
        )
      );

    await db.insert(auditLogs).values({
      userId: session.user.id,
      action: "delete",
      resourceType: "space_member",
      resourceId: userId,
      spaceId: membership.spaceId,
    });

    return Response.json({ success: true });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to remove member" },
      { status: 500 }
    );
  }
}

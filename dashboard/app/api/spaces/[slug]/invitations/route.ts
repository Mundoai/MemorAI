import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  spaces,
  spaceMembers,
  spaceInvitations,
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

export async function POST(
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

  // Only owner/admin can invite
  if (membership.role !== "owner" && membership.role !== "admin") {
    return Response.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const body = await req.json();
  const { email, role = "member" } = body;

  if (!email) {
    return Response.json({ error: "Email is required" }, { status: 400 });
  }

  // Check if user is already a member
  const existingUser = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existingUser.length > 0) {
    const existingMember = await db
      .select({ id: spaceMembers.id })
      .from(spaceMembers)
      .where(
        and(
          eq(spaceMembers.spaceId, membership.spaceId),
          eq(spaceMembers.userId, existingUser[0].id)
        )
      )
      .limit(1);

    if (existingMember.length > 0) {
      return Response.json(
        { error: "User is already a member of this space" },
        { status: 409 }
      );
    }
  }

  try {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7-day expiry

    const [invitation] = await db
      .insert(spaceInvitations)
      .values({
        spaceId: membership.spaceId,
        email,
        role: role as "owner" | "admin" | "member",
        invitedBy: session.user.id,
        expiresAt,
      })
      .returning();

    await db.insert(auditLogs).values({
      userId: session.user.id,
      action: "invite",
      resourceType: "space_invitation",
      resourceId: invitation.id,
      spaceId: membership.spaceId,
      details: { email, role },
    });

    return Response.json(invitation, { status: 201 });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to create invitation" },
      { status: 500 }
    );
  }
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

  const invitations = await db
    .select()
    .from(spaceInvitations)
    .where(eq(spaceInvitations.spaceId, membership.spaceId));

  return Response.json(invitations);
}

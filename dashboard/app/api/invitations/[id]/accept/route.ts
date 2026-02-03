import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { spaceInvitations, spaceMembers, auditLogs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id || !session?.user?.email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const invitations = await db
      .select()
      .from(spaceInvitations)
      .where(eq(spaceInvitations.id, id))
      .limit(1);

    const invitation = invitations[0];
    if (!invitation) {
      return Response.json({ error: "Invitation not found" }, { status: 404 });
    }

    if (invitation.email !== session.user.email) {
      return Response.json(
        { error: "This invitation is for a different email" },
        { status: 403 }
      );
    }

    if (invitation.status !== "pending") {
      return Response.json(
        { error: `Invitation already ${invitation.status}` },
        { status: 400 }
      );
    }

    if (invitation.expiresAt < new Date()) {
      await db
        .update(spaceInvitations)
        .set({ status: "expired" })
        .where(eq(spaceInvitations.id, id));
      return Response.json({ error: "Invitation has expired" }, { status: 400 });
    }

    // Accept: add member + update invitation
    await db.insert(spaceMembers).values({
      spaceId: invitation.spaceId,
      userId: session.user.id,
      role: invitation.role,
    });

    await db
      .update(spaceInvitations)
      .set({ status: "accepted" })
      .where(eq(spaceInvitations.id, id));

    await db.insert(auditLogs).values({
      userId: session.user.id,
      action: "create",
      resourceType: "space_member",
      resourceId: session.user.id,
      spaceId: invitation.spaceId,
      details: { role: invitation.role, via: "invitation" },
    });

    return Response.json({ success: true, spaceId: invitation.spaceId });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to accept invitation" },
      { status: 500 }
    );
  }
}

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { spaces, auditLogs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireSpaceRole } from "@/lib/auth/rbac";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug } = await params;

  try {
    await requireSpaceRole(session.user.id, slug, "member");
    const result = await db
      .select({ settings: spaces.settings })
      .from(spaces)
      .where(eq(spaces.slug, slug))
      .limit(1);

    return Response.json(result[0]?.settings ?? {});
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    const status = msg.includes("Requires") ? 403 : msg.includes("Not a member") ? 404 : 500;
    return Response.json({ error: msg }, { status });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug } = await params;

  try {
    const { spaceId } = await requireSpaceRole(session.user.id, slug, "owner");
    const body = await req.json();

    // Merge settings
    const current = await db
      .select({ settings: spaces.settings })
      .from(spaces)
      .where(eq(spaces.id, spaceId))
      .limit(1);

    const merged = {
      ...(current[0]?.settings as object ?? {}),
      ...body,
    };

    await db
      .update(spaces)
      .set({ settings: merged, updatedAt: new Date() })
      .where(eq(spaces.id, spaceId));

    await db.insert(auditLogs).values({
      userId: session.user.id,
      action: "settings_change",
      resourceType: "space",
      resourceId: spaceId,
      spaceId,
      details: body,
    });

    return Response.json(merged);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    const status = msg.includes("Requires") ? 403 : msg.includes("Not a member") ? 404 : 500;
    return Response.json({ error: msg }, { status });
  }
}

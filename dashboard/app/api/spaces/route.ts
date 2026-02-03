import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { spaces, spaceMembers, auditLogs } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { name, slug, description, icon } = body;

  if (!name || !slug) {
    return Response.json(
      { error: "Name and slug are required" },
      { status: 400 }
    );
  }

  // Validate slug format
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return Response.json(
      { error: "Slug must only contain lowercase letters, numbers, and hyphens" },
      { status: 400 }
    );
  }

  try {
    // Check slug uniqueness
    const existing = await db
      .select({ id: spaces.id })
      .from(spaces)
      .where(eq(spaces.slug, slug))
      .limit(1);

    if (existing.length > 0) {
      return Response.json(
        { error: "A space with this slug already exists" },
        { status: 409 }
      );
    }

    // Create space
    const [space] = await db
      .insert(spaces)
      .values({
        name,
        slug,
        description: description || null,
        icon: icon || null,
        createdBy: session.user.id,
      })
      .returning();

    // Add creator as owner
    await db.insert(spaceMembers).values({
      spaceId: space.id,
      userId: session.user.id,
      role: "owner",
    });

    // Audit log
    await db.insert(auditLogs).values({
      userId: session.user.id,
      action: "create",
      resourceType: "space",
      resourceId: space.id,
      spaceId: space.id,
      details: { name, slug },
    });

    return Response.json(space, { status: 201 });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to create space" },
      { status: 500 }
    );
  }
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await db
      .select({
        id: spaces.id,
        name: spaces.name,
        slug: spaces.slug,
        description: spaces.description,
        icon: spaces.icon,
        createdAt: spaces.createdAt,
        role: spaceMembers.role,
      })
      .from(spaceMembers)
      .innerJoin(spaces, eq(spaces.id, spaceMembers.spaceId))
      .where(
        and(eq(spaceMembers.userId, session.user.id), isNull(spaces.deletedAt))
      );

    return Response.json(result);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to list spaces" },
      { status: 500 }
    );
  }
}

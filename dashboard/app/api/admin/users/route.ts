import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users, spaceMembers } from "@/lib/db/schema";
import { eq, count, desc } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (role !== "superadmin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const allUsers = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      image: users.image,
      role: users.role,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(desc(users.createdAt));

  return Response.json(allUsers);
}

export async function PUT(req: Request) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (role !== "superadmin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { userId, newRole } = body;

  if (!userId || !newRole || !["user", "superadmin"].includes(newRole)) {
    return Response.json(
      { error: "userId and newRole (user|superadmin) are required" },
      { status: 400 }
    );
  }

  await db
    .update(users)
    .set({ role: newRole, updatedAt: new Date() })
    .where(eq(users.id, userId));

  return Response.json({ success: true });
}

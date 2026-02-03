import { db } from "@/lib/db";
import { spaceMembers, spaces } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";

export type SpaceRole = "owner" | "admin" | "member";

const ROLE_HIERARCHY: Record<SpaceRole, number> = {
  owner: 3,
  admin: 2,
  member: 1,
};

export function hasPermission(
  userRole: SpaceRole,
  requiredRole: SpaceRole
): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

export async function getUserSpaceRole(
  userId: string,
  spaceSlug: string
): Promise<SpaceRole | null> {
  const result = await db
    .select({ role: spaceMembers.role })
    .from(spaceMembers)
    .innerJoin(spaces, eq(spaces.id, spaceMembers.spaceId))
    .where(
      and(
        eq(spaceMembers.userId, userId),
        eq(spaces.slug, spaceSlug),
        isNull(spaces.deletedAt)
      )
    )
    .limit(1);

  return (result[0]?.role as SpaceRole) ?? null;
}

export async function getUserSpaceRoleById(
  userId: string,
  spaceId: string
): Promise<SpaceRole | null> {
  const result = await db
    .select({ role: spaceMembers.role })
    .from(spaceMembers)
    .where(
      and(eq(spaceMembers.userId, userId), eq(spaceMembers.spaceId, spaceId))
    )
    .limit(1);

  return (result[0]?.role as SpaceRole) ?? null;
}

export async function requireSpaceRole(
  userId: string,
  spaceSlug: string,
  requiredRole: SpaceRole
): Promise<{ spaceId: string; role: SpaceRole }> {
  const result = await db
    .select({ spaceId: spaces.id, role: spaceMembers.role })
    .from(spaceMembers)
    .innerJoin(spaces, eq(spaces.id, spaceMembers.spaceId))
    .where(
      and(
        eq(spaceMembers.userId, userId),
        eq(spaces.slug, spaceSlug),
        isNull(spaces.deletedAt)
      )
    )
    .limit(1);

  if (!result[0]) {
    throw new Error("Not a member of this space");
  }

  const role = result[0].role as SpaceRole;
  if (!hasPermission(role, requiredRole)) {
    throw new Error(`Requires ${requiredRole} role, you have ${role}`);
  }

  return { spaceId: result[0].spaceId, role };
}

import { auth } from "@/lib/auth";
import { apiRequest } from "@/lib/api/client";
import { getUserSpaceRole, hasPermission } from "@/lib/auth/rbac";

interface MemoryResponse {
  id: string;
  memory: string;
  user_id?: string;
  agent_id?: string;
  [key: string]: unknown;
}

/**
 * Fetches the memory and verifies the current user has the required role
 * in the memory's space (identified by user_id = space slug).
 */
async function verifyMemoryOwnership(
  memoryId: string,
  userId: string,
  requiredRole: "member" | "admin" | "owner"
) {
  // Fetch the memory from the Mem0 API to get its user_id (space slug)
  const memory = await apiRequest<MemoryResponse>({
    method: "GET",
    path: `/memories/${memoryId}`,
  });

  if (!memory || !memory.user_id) {
    throw new Error("Memory not found or has no associated space");
  }

  const spaceSlug = memory.user_id;

  // Check user is a member of that space with sufficient role
  const role = await getUserSpaceRole(userId, spaceSlug);
  if (!role) {
    throw new Error("You are not a member of the space that owns this memory");
  }

  if (!hasPermission(role, requiredRole)) {
    throw new Error(
      `Requires ${requiredRole} role in this space, you have ${role}`
    );
  }

  return { memory, role, spaceSlug };
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    // C2 fix: verify user owns (is member of) the memory's space
    // DELETE requires at least "admin" role
    await verifyMemoryOwnership(id, session.user.id, "admin");

    await apiRequest({ method: "DELETE", path: `/memories/${id}` });
    return Response.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to delete";
    const status = message.includes("not a member") || message.includes("Requires")
      ? 403
      : message.includes("not found")
      ? 404
      : 500;
    return Response.json({ error: message }, { status });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();

  try {
    // C2 fix: verify user owns (is member of) the memory's space
    // UPDATE requires at least "member" role
    await verifyMemoryOwnership(id, session.user.id, "member");

    const result = await apiRequest({
      method: "PUT",
      path: `/memories/${id}`,
      body: { data: body.data },
    });
    return Response.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update";
    const status = message.includes("not a member") || message.includes("Requires")
      ? 403
      : message.includes("not found")
      ? 404
      : 500;
    return Response.json({ error: message }, { status });
  }
}

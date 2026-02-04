import { auth } from "@/lib/auth";
import { apiRequest } from "@/lib/api/client";
import { getUserSpaceRole } from "@/lib/auth/rbac";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();

  // C1 fix: user_id (space slug) is REQUIRED and must be a space the user belongs to
  const spaceSlug = body.user_id;
  if (!spaceSlug || typeof spaceSlug !== "string") {
    return Response.json(
      { error: "user_id (space slug) is required to scope search" },
      { status: 400 }
    );
  }

  // Verify user is a member of the requested space
  const role = await getUserSpaceRole(session.user.id, spaceSlug);
  if (!role) {
    return Response.json(
      { error: "You do not have access to this space" },
      { status: 403 }
    );
  }

  try {
    const result = await apiRequest({
      method: "POST",
      path: "/search",
      body: {
        query: body.query,
        user_id: spaceSlug,
        agent_id: body.agent_id,
        limit: body.limit ?? 20,
      },
    });
    return Response.json(result);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Search failed" },
      { status: 500 }
    );
  }
}

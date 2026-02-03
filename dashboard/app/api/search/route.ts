import { auth } from "@/lib/auth";
import { apiRequest } from "@/lib/api/client";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();

  try {
    const result = await apiRequest({
      method: "POST",
      path: "/search",
      body: {
        query: body.query,
        user_id: body.user_id,
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

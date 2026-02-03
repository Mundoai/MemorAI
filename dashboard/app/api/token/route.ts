import { auth } from "@/lib/auth";
import { createAPIToken } from "@/lib/auth/jwt";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id || !session?.user?.email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = (session.user as { role?: string }).role ?? "user";

  try {
    const token = await createAPIToken(session.user.id, session.user.email, role);
    return Response.json({ token });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to generate token" },
      { status: 500 }
    );
  }
}

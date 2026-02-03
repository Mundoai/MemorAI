import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { memoryAnnotations } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Only return user's own annotations (private)
  const result = await db
    .select()
    .from(memoryAnnotations)
    .where(
      and(
        eq(memoryAnnotations.memoryId, id),
        eq(memoryAnnotations.userId, session.user.id)
      )
    );

  return Response.json(result);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: memoryId } = await params;
  const body = await req.json();
  const { content } = body;

  if (!content) {
    return Response.json({ error: "content is required" }, { status: 400 });
  }

  try {
    const [annotation] = await db
      .insert(memoryAnnotations)
      .values({
        memoryId,
        userId: session.user.id,
        content,
      })
      .returning();

    return Response.json(annotation, { status: 201 });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to create annotation" },
      { status: 500 }
    );
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

  const body = await req.json();
  const { annotationId, content } = body;

  if (!annotationId || !content) {
    return Response.json(
      { error: "annotationId and content are required" },
      { status: 400 }
    );
  }

  await db
    .update(memoryAnnotations)
    .set({ content, updatedAt: new Date() })
    .where(
      and(
        eq(memoryAnnotations.id, annotationId),
        eq(memoryAnnotations.userId, session.user.id)
      )
    );

  return Response.json({ success: true });
}

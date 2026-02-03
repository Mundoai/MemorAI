import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { memoryTags, tags } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const result = await db
    .select({
      id: tags.id,
      name: tags.name,
      color: tags.color,
    })
    .from(memoryTags)
    .innerJoin(tags, eq(tags.id, memoryTags.tagId))
    .where(eq(memoryTags.memoryId, id));

  return Response.json(result);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: memoryId } = await params;
  const body = await req.json();
  const { tagId } = body;

  if (!tagId) {
    return Response.json({ error: "tagId is required" }, { status: 400 });
  }

  try {
    await db.insert(memoryTags).values({ memoryId, tagId });
    return Response.json({ success: true }, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.message.includes("unique")) {
      return Response.json({ error: "Tag already applied" }, { status: 409 });
    }
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to add tag" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: memoryId } = await params;
  const body = await req.json();
  const { tagId } = body;

  if (!tagId) {
    return Response.json({ error: "tagId is required" }, { status: 400 });
  }

  await db
    .delete(memoryTags)
    .where(and(eq(memoryTags.memoryId, memoryId), eq(memoryTags.tagId, tagId)));

  return Response.json({ success: true });
}

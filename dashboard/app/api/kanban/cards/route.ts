import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { kanbanCards, kanbanCardMemories } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { columnId, title, description, position = 0 } = body;

  if (!columnId || !title) {
    return Response.json(
      { error: "columnId and title are required" },
      { status: 400 }
    );
  }

  try {
    const [card] = await db
      .insert(kanbanCards)
      .values({
        columnId,
        title,
        description: description || null,
        position,
        createdBy: session.user.id,
      })
      .returning();

    return Response.json(card, { status: 201 });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to create card" },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { cardId, columnId, position, title, description } = body;

  if (!cardId) {
    return Response.json({ error: "cardId is required" }, { status: 400 });
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (columnId) updates.columnId = columnId;
  if (position !== undefined) updates.position = position;
  if (title) updates.title = title;
  if (description !== undefined) updates.description = description;

  await db
    .update(kanbanCards)
    .set(updates)
    .where(eq(kanbanCards.id, cardId));

  return Response.json({ success: true });
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { cardId } = body;

  if (!cardId) {
    return Response.json({ error: "cardId is required" }, { status: 400 });
  }

  await db.delete(kanbanCards).where(eq(kanbanCards.id, cardId));
  return Response.json({ success: true });
}

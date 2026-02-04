import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  kanbanCards,
  kanbanColumns,
  kanbanBoards,
  spaceMembers,
  spaces,
} from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";

/**
 * C3 fix: Trace columnId → kanbanColumns → kanbanBoards → spaces,
 * then verify user is a member of that space.
 * Returns the space info or throws an error.
 */
async function verifyColumnAccess(columnId: string, userId: string) {
  const result = await db
    .select({
      columnId: kanbanColumns.id,
      boardId: kanbanBoards.id,
      spaceId: spaces.id,
      spaceSlug: spaces.slug,
      memberRole: spaceMembers.role,
    })
    .from(kanbanColumns)
    .innerJoin(kanbanBoards, eq(kanbanBoards.id, kanbanColumns.boardId))
    .innerJoin(spaces, eq(spaces.id, kanbanBoards.spaceId))
    .innerJoin(
      spaceMembers,
      and(
        eq(spaceMembers.spaceId, spaces.id),
        eq(spaceMembers.userId, userId)
      )
    )
    .where(and(eq(kanbanColumns.id, columnId), isNull(spaces.deletedAt)))
    .limit(1);

  if (!result[0]) {
    throw new Error(
      "Column not found or you are not a member of its space"
    );
  }

  return result[0];
}

/**
 * For card-level operations (PUT/DELETE), verify via the card's current columnId.
 */
async function verifyCardAccess(cardId: string, userId: string) {
  const card = await db
    .select({ id: kanbanCards.id, columnId: kanbanCards.columnId })
    .from(kanbanCards)
    .where(eq(kanbanCards.id, cardId))
    .limit(1);

  if (!card[0]) {
    throw new Error("Card not found");
  }

  const spaceInfo = await verifyColumnAccess(card[0].columnId, userId);
  return { card: card[0], ...spaceInfo };
}

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
    // C3 fix: verify user is a member of the column's space
    await verifyColumnAccess(columnId, session.user.id);

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
    const message = err instanceof Error ? err.message : "Failed to create card";
    const status = message.includes("not a member") || message.includes("not found")
      ? 403
      : 500;
    return Response.json({ error: message }, { status });
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

  try {
    // C3 fix: verify user has access to the card's current space
    await verifyCardAccess(cardId, session.user.id);

    // If moving to a new column, also verify access to the target column's space
    if (columnId) {
      await verifyColumnAccess(columnId, session.user.id);
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
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update card";
    const status = message.includes("not a member") || message.includes("not found")
      ? 403
      : 500;
    return Response.json({ error: message }, { status });
  }
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

  try {
    // C3 fix: verify user has access to the card's space
    await verifyCardAccess(cardId, session.user.id);

    await db.delete(kanbanCards).where(eq(kanbanCards.id, cardId));
    return Response.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to delete card";
    const status = message.includes("not a member") || message.includes("not found")
      ? 403
      : 500;
    return Response.json({ error: message }, { status });
  }
}

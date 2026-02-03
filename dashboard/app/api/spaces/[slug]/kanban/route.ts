import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  kanbanBoards,
  kanbanColumns,
  kanbanCards,
  spaces,
  spaceMembers,
} from "@/lib/db/schema";
import { eq, and, isNull, asc } from "drizzle-orm";

async function getSpaceId(slug: string, userId: string) {
  const result = await db
    .select({ spaceId: spaces.id })
    .from(spaceMembers)
    .innerJoin(spaces, eq(spaces.id, spaceMembers.spaceId))
    .where(
      and(
        eq(spaceMembers.userId, userId),
        eq(spaces.slug, slug),
        isNull(spaces.deletedAt)
      )
    )
    .limit(1);
  return result[0]?.spaceId ?? null;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug } = await params;
  const spaceId = await getSpaceId(slug, session.user.id);
  if (!spaceId) {
    return Response.json({ error: "Space not found" }, { status: 404 });
  }

  const boards = await db
    .select()
    .from(kanbanBoards)
    .where(eq(kanbanBoards.spaceId, spaceId));

  // For each board, get columns and cards
  const result = await Promise.all(
    boards.map(async (board) => {
      const columns = await db
        .select()
        .from(kanbanColumns)
        .where(eq(kanbanColumns.boardId, board.id))
        .orderBy(asc(kanbanColumns.position));

      const columnsWithCards = await Promise.all(
        columns.map(async (col) => {
          const cards = await db
            .select()
            .from(kanbanCards)
            .where(eq(kanbanCards.columnId, col.id))
            .orderBy(asc(kanbanCards.position));
          return { ...col, cards };
        })
      );

      return { ...board, columns: columnsWithCards };
    })
  );

  return Response.json(result);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug } = await params;
  const spaceId = await getSpaceId(slug, session.user.id);
  if (!spaceId) {
    return Response.json({ error: "Space not found" }, { status: 404 });
  }

  const body = await req.json();
  const { name } = body;

  if (!name) {
    return Response.json({ error: "name is required" }, { status: 400 });
  }

  try {
    const [board] = await db
      .insert(kanbanBoards)
      .values({
        spaceId,
        name,
        createdBy: session.user.id,
      })
      .returning();

    // Create default columns
    const defaultColumns = ["To Do", "In Progress", "Done"];
    for (let i = 0; i < defaultColumns.length; i++) {
      await db.insert(kanbanColumns).values({
        boardId: board.id,
        name: defaultColumns[i],
        position: i,
      });
    }

    return Response.json(board, { status: 201 });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to create board" },
      { status: 500 }
    );
  }
}

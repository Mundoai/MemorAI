import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  spaces,
  spaceMembers,
  spaceInvitations,
  tags,
} from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Users, Tag, Settings, Brain } from "lucide-react";
import Link from "next/link";
import { apiRequest } from "@/lib/api/client";

async function getSpace(slug: string, userId: string) {
  const result = await db
    .select({
      id: spaces.id,
      name: spaces.name,
      slug: spaces.slug,
      description: spaces.description,
      icon: spaces.icon,
      settings: spaces.settings,
      createdAt: spaces.createdAt,
      role: spaceMembers.role,
    })
    .from(spaces)
    .innerJoin(
      spaceMembers,
      and(
        eq(spaceMembers.spaceId, spaces.id),
        eq(spaceMembers.userId, userId)
      )
    )
    .where(and(eq(spaces.slug, slug), isNull(spaces.deletedAt)))
    .limit(1);

  return result[0] ?? null;
}

async function getSpaceMembers(spaceId: string) {
  return db
    .select({
      userId: spaceMembers.userId,
      role: spaceMembers.role,
      joinedAt: spaceMembers.joinedAt,
    })
    .from(spaceMembers)
    .where(eq(spaceMembers.spaceId, spaceId));
}

async function getSpaceTags(spaceId: string) {
  return db.select().from(tags).where(eq(tags.spaceId, spaceId));
}

async function getSpaceMemories(slug: string) {
  try {
    const result = await apiRequest<{ results?: unknown[] }>({
      method: "GET",
      path: "/memories",
      params: { user_id: slug },
    });
    return Array.isArray(result?.results) ? result.results.length : 0;
  } catch {
    return 0;
  }
}

export default async function SpaceDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await auth();
  if (!session?.user?.id) notFound();

  const space = await getSpace(slug, session.user.id);
  if (!space) notFound();

  const [members, spaceTags, memoryCount] = await Promise.all([
    getSpaceMembers(space.id),
    getSpaceTags(space.id),
    getSpaceMemories(slug),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/spaces">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Spaces
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              {space.icon && <span className="text-2xl">{space.icon}</span>}
              {space.name}
            </h1>
            {space.description && (
              <p className="text-muted-foreground">{space.description}</p>
            )}
          </div>
        </div>
        <Badge variant="outline">{space.role}</Badge>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Memories</CardTitle>
            <Brain className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{memoryCount}</div>
            <Link
              href={`/memories?space=${slug}`}
              className="text-xs text-primary hover:underline"
            >
              Browse memories
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Members</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{members.length}</div>
            <p className="text-xs text-muted-foreground">Active members</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tags</CardTitle>
            <Tag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{spaceTags.length}</div>
            <p className="text-xs text-muted-foreground">Created tags</p>
          </CardContent>
        </Card>
      </div>

      {/* Members */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Members
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {members.map((m) => (
              <div
                key={m.userId}
                className="flex items-center justify-between rounded-lg border border-border p-3"
              >
                <span className="text-sm font-mono">{m.userId}</span>
                <Badge variant="outline">{m.role}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Tags */}
      {spaceTags.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Tag className="h-4 w-4" />
              Tags
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {spaceTags.map((tag) => (
                <Badge
                  key={tag.id}
                  style={
                    tag.color
                      ? { backgroundColor: tag.color + "20", color: tag.color }
                      : undefined
                  }
                >
                  {tag.name}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

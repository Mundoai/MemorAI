import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { spaces, spaceMembers } from "@/lib/db/schema";
import { eq, and, isNull, count } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LayoutGrid, Users, Plus } from "lucide-react";
import Link from "next/link";
import { SpaceCreateButton } from "@/components/spaces/space-create-button";

async function getUserSpaces(userId: string) {
  const memberSpaces = await db
    .select({
      id: spaces.id,
      name: spaces.name,
      slug: spaces.slug,
      description: spaces.description,
      icon: spaces.icon,
      role: spaceMembers.role,
      createdAt: spaces.createdAt,
    })
    .from(spaceMembers)
    .innerJoin(spaces, eq(spaces.id, spaceMembers.spaceId))
    .where(and(eq(spaceMembers.userId, userId), isNull(spaces.deletedAt)));

  return memberSpaces;
}

export default async function SpacesPage() {
  const session = await auth();
  const userSpaces = session?.user?.id
    ? await getUserSpaces(session.user.id)
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Spaces</h1>
          <p className="text-muted-foreground">
            Organize your memories into workspaces
          </p>
        </div>
        <SpaceCreateButton />
      </div>

      {userSpaces.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <LayoutGrid className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No spaces yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Create your first space to start organizing memories
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {userSpaces.map((space) => (
            <Link key={space.id} href={`/spaces/${space.slug}`}>
              <Card className="hover:bg-accent/50 transition-colors cursor-pointer h-full">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      {space.icon ? (
                        <span className="text-lg">{space.icon}</span>
                      ) : (
                        <LayoutGrid className="h-4 w-4 text-muted-foreground" />
                      )}
                      {space.name}
                    </CardTitle>
                    <Badge variant="outline" className="text-xs">
                      {space.role}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {space.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {space.description}
                    </p>
                  )}
                  <div className="mt-3 text-xs text-muted-foreground">
                    slug: {space.slug}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

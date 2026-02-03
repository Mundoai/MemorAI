import { auth } from "@/lib/auth";
import { apiRequest } from "@/lib/api/client";
import { db } from "@/lib/db";
import { spaces, spaceMembers } from "@/lib/db/schema";
import { eq, count } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Brain, LayoutGrid, Search, Activity } from "lucide-react";
import Link from "next/link";

async function getStats(userId: string) {
  try {
    const spaceCount = await db
      .select({ count: count() })
      .from(spaceMembers)
      .where(eq(spaceMembers.userId, userId));

    return {
      spaces: spaceCount[0]?.count ?? 0,
    };
  } catch {
    return { spaces: 0 };
  }
}

export default async function DashboardHome() {
  const session = await auth();
  const stats = session?.user?.id ? await getStats(session.user.id) : { spaces: 0 };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          Welcome back{session?.user?.name ? `, ${session.user.name}` : ""}
        </h1>
        <p className="text-muted-foreground">
          Manage your AI agent memories and workspaces
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Spaces</CardTitle>
            <LayoutGrid className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.spaces}</div>
            <p className="text-xs text-muted-foreground">Active workspaces</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Memories</CardTitle>
            <Brain className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">--</div>
            <p className="text-xs text-muted-foreground">
              Across all spaces
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Search</CardTitle>
            <Search className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <Link
              href="/search"
              className="text-sm text-primary hover:underline"
            >
              Semantic search
            </Link>
            <p className="text-xs text-muted-foreground">
              Find memories by meaning
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">API</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">Healthy</div>
            <p className="text-xs text-muted-foreground">
              FastAPI + Qdrant running
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link
              href="/memories"
              className="block rounded-lg border border-border p-3 text-sm hover:bg-accent transition-colors"
            >
              Browse Memories
            </Link>
            <Link
              href="/spaces"
              className="block rounded-lg border border-border p-3 text-sm hover:bg-accent transition-colors"
            >
              Manage Spaces
            </Link>
            <Link
              href="/search"
              className="block rounded-lg border border-border p-3 text-sm hover:bg-accent transition-colors"
            >
              Search Memories
            </Link>
            <Link
              href="/settings"
              className="block rounded-lg border border-border p-3 text-sm hover:bg-accent transition-colors"
            >
              Settings & API Tokens
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Getting Started</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              MemorAI provides persistent semantic memory for your AI agents.
              Here&apos;s how to get started:
            </p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Create a Space for each project</li>
              <li>Store memories via MCP tools or API</li>
              <li>Search and browse memories from the dashboard</li>
              <li>Tag and bookmark important memories</li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { users, spaces, auditLogs } from "@/lib/db/schema";
import { count, desc } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, Users, LayoutGrid, Activity } from "lucide-react";
import { format } from "date-fns";

async function getAdminStats() {
  const [userCount, spaceCount, recentAudit] = await Promise.all([
    db.select({ count: count() }).from(users),
    db.select({ count: count() }).from(spaces),
    db
      .select()
      .from(auditLogs)
      .orderBy(desc(auditLogs.createdAt))
      .limit(20),
  ]);

  return {
    userCount: userCount[0]?.count ?? 0,
    spaceCount: spaceCount[0]?.count ?? 0,
    recentAudit,
  };
}

export default async function AdminPage() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;

  if (role !== "superadmin") {
    redirect("/");
  }

  const stats = await getAdminStats();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Shield className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Admin Panel</h1>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.userCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Spaces</CardTitle>
            <LayoutGrid className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.spaceCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Audit Events</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.recentAudit.length}
            </div>
            <p className="text-xs text-muted-foreground">Recent events</p>
          </CardContent>
        </Card>
      </div>

      {/* Audit Log */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Audit Log</CardTitle>
        </CardHeader>
        <CardContent>
          {stats.recentAudit.length === 0 ? (
            <p className="text-sm text-muted-foreground">No audit events yet</p>
          ) : (
            <div className="space-y-2">
              {stats.recentAudit.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between rounded-lg border border-border p-3 text-sm"
                >
                  <div className="flex items-center gap-3">
                    <Badge variant="outline">{log.action}</Badge>
                    <span className="text-muted-foreground">
                      {log.resourceType}
                      {log.resourceId && ` #${log.resourceId.slice(0, 8)}`}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {log.createdAt
                      ? format(log.createdAt, "PPp")
                      : "Unknown"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

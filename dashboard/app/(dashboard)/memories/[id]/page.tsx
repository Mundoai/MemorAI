import { auth } from "@/lib/auth";
import { apiRequest } from "@/lib/api/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Clock, History, Edit, Trash2 } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import Link from "next/link";
import { MemoryActions } from "@/components/memories/memory-actions";

interface Memory {
  id: string;
  memory: string;
  user_id?: string;
  agent_id?: string;
  created_at?: string;
  updated_at?: string;
  metadata?: Record<string, unknown>;
}

interface HistoryEntry {
  id: string;
  memory_id: string;
  old_memory?: string;
  new_memory?: string;
  event: string;
  created_at: string;
}

async function getMemory(id: string): Promise<Memory | null> {
  try {
    return await apiRequest<Memory>({ method: "GET", path: `/memories/${id}` });
  } catch {
    return null;
  }
}

async function getHistory(id: string): Promise<HistoryEntry[]> {
  try {
    const result = await apiRequest<HistoryEntry[] | { results: HistoryEntry[] }>({
      method: "GET",
      path: `/memories/${id}/history`,
    });
    if (Array.isArray(result)) return result;
    if (result && "results" in result) return result.results;
    return [];
  } catch {
    return [];
  }
}

export default async function MemoryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [memory, history] = await Promise.all([
    getMemory(id),
    getHistory(id),
  ]);

  if (!memory) {
    return (
      <div className="space-y-4">
        <Link href="/memories">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Memories
          </Button>
        </Link>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Memory not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/memories">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Memories
          </Button>
        </Link>
        <MemoryActions memoryId={id} />
      </div>

      {/* Memory Content */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Memory Content</CardTitle>
            <div className="flex items-center gap-2">
              {memory.user_id && (
                <Badge variant="secondary">{memory.user_id}</Badge>
              )}
              {memory.agent_id && (
                <Badge variant="outline">{memory.agent_id}</Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-wrap text-sm leading-relaxed">
            {memory.memory}
          </p>
          <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
            {memory.created_at && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Created{" "}
                {formatDistanceToNow(new Date(memory.created_at), {
                  addSuffix: true,
                })}
              </span>
            )}
            {memory.updated_at && memory.updated_at !== memory.created_at && (
              <span className="flex items-center gap-1">
                <Edit className="h-3 w-3" />
                Updated{" "}
                {formatDistanceToNow(new Date(memory.updated_at), {
                  addSuffix: true,
                })}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Metadata */}
      {memory.metadata && Object.keys(memory.metadata).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Metadata</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(memory.metadata).map(([key, value]) => (
                <div
                  key={key}
                  className="flex items-center gap-2 text-sm"
                >
                  <span className="font-mono text-muted-foreground">
                    {key}:
                  </span>
                  <span>{JSON.stringify(value)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <History className="h-4 w-4" />
            Version History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No history entries found
            </p>
          ) : (
            <div className="space-y-4">
              {history.map((entry, i) => (
                <div
                  key={entry.id || i}
                  className="border-l-2 border-border pl-4 pb-4"
                >
                  <div className="flex items-center gap-2 text-sm">
                    <Badge variant="outline" className="text-xs">
                      {entry.event}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {entry.created_at
                        ? format(new Date(entry.created_at), "PPp")
                        : "Unknown date"}
                    </span>
                  </div>
                  {entry.old_memory && (
                    <div className="mt-2 rounded bg-destructive/10 p-2 text-xs">
                      <span className="text-destructive">-</span>{" "}
                      {entry.old_memory}
                    </div>
                  )}
                  {entry.new_memory && (
                    <div className="mt-1 rounded bg-green-500/10 p-2 text-xs">
                      <span className="text-green-500">+</span>{" "}
                      {entry.new_memory}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

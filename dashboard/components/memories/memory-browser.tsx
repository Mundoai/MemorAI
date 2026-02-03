"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Brain,
  Bookmark,
  BookmarkCheck,
  Clock,
  Filter,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Memory {
  id: string;
  memory: string;
  user_id?: string;
  agent_id?: string;
  created_at?: string;
  updated_at?: string;
  metadata?: Record<string, unknown>;
}

interface SpaceInfo {
  spaceId: string;
  spaceName: string;
  spaceSlug: string;
}

interface MemoryBrowserProps {
  memories: Memory[];
  spaces: SpaceInfo[];
  bookmarkedIds: string[];
  currentSpace?: string;
  showBookmarkedOnly?: boolean;
}

const PAGE_SIZE = 20;

export function MemoryBrowser({
  memories,
  spaces,
  bookmarkedIds,
  currentSpace,
  showBookmarkedOnly,
}: MemoryBrowserProps) {
  const router = useRouter();
  const [filterText, setFilterText] = useState("");
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    let result = memories;
    if (showBookmarkedOnly) {
      result = result.filter((m) => bookmarkedIds.includes(m.id));
    }
    if (filterText) {
      const lower = filterText.toLowerCase();
      result = result.filter(
        (m) =>
          m.memory.toLowerCase().includes(lower) ||
          m.agent_id?.toLowerCase().includes(lower)
      );
    }
    return result;
  }, [memories, filterText, showBookmarkedOnly, bookmarkedIds]);

  const pageCount = Math.ceil(filtered.length / PAGE_SIZE);
  const pageItems = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[200px]">
          <Input
            placeholder="Filter memories..."
            value={filterText}
            onChange={(e) => {
              setFilterText(e.target.value);
              setPage(0);
            }}
          />
        </div>
        <select
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
          value={currentSpace ?? ""}
          onChange={(e) => {
            const val = e.target.value;
            router.push(val ? `/memories?space=${val}` : "/memories");
          }}
        >
          <option value="">All Spaces</option>
          {spaces.map((s) => (
            <option key={s.spaceId} value={s.spaceSlug}>
              {s.spaceName}
            </option>
          ))}
        </select>
      </div>

      {/* Results count */}
      <div className="text-sm text-muted-foreground">
        {filtered.length} {filtered.length === 1 ? "memory" : "memories"} found
      </div>

      {/* Memory Cards */}
      <div className="space-y-3">
        {pageItems.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Brain className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No memories found</p>
              <p className="text-xs text-muted-foreground mt-1">
                Memories will appear here as your AI agents store them
              </p>
            </CardContent>
          </Card>
        ) : (
          pageItems.map((memory) => (
            <Link key={memory.id} href={`/memories/${memory.id}`}>
              <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm leading-relaxed line-clamp-3">
                        {memory.memory}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {memory.user_id && (
                          <Badge variant="secondary" className="text-xs">
                            {memory.user_id}
                          </Badge>
                        )}
                        {memory.agent_id && (
                          <Badge variant="outline" className="text-xs">
                            {memory.agent_id}
                          </Badge>
                        )}
                        {memory.created_at && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {formatDistanceToNow(new Date(memory.created_at), {
                              addSuffix: true,
                            })}
                          </span>
                        )}
                      </div>
                    </div>
                    {bookmarkedIds.includes(memory.id) && (
                      <BookmarkCheck className="h-4 w-4 text-primary shrink-0" />
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))
        )}
      </div>

      {/* Pagination */}
      {pageCount > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 0}
            onClick={() => setPage(page - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page + 1} of {pageCount}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= pageCount - 1}
            onClick={() => setPage(page + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

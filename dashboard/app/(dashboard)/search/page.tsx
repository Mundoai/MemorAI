"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Brain, Clock, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface SearchResult {
  id: string;
  memory: string;
  score?: number;
  user_id?: string;
  agent_id?: string;
  created_at?: string;
}

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;

    setSearching(true);
    setSearched(true);
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, limit: 20 }),
      });
      const data = await res.json();
      if (Array.isArray(data)) {
        setResults(data);
      } else if (data?.results) {
        setResults(data.results);
      } else {
        setResults([]);
      }
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Semantic Search</h1>
        <p className="text-muted-foreground">
          Search memories using natural language
        </p>
      </div>

      <form onSubmit={handleSearch} className="flex gap-3">
        <div className="flex-1">
          <Input
            placeholder="What decisions were made about authentication?"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-11"
          />
        </div>
        <Button type="submit" disabled={searching} className="h-11">
          {searching ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Search className="mr-2 h-4 w-4" />
          )}
          Search
        </Button>
      </form>

      {searched && (
        <div className="text-sm text-muted-foreground">
          {results.length} {results.length === 1 ? "result" : "results"} found
        </div>
      )}

      <div className="space-y-3">
        {results.map((result) => (
          <Link key={result.id} href={`/memories/${result.id}`}>
            <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm leading-relaxed line-clamp-3">
                      {result.memory}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {result.score !== undefined && (
                        <Badge variant="default" className="text-xs">
                          {(result.score * 100).toFixed(1)}% match
                        </Badge>
                      )}
                      {result.user_id && (
                        <Badge variant="secondary" className="text-xs">
                          {result.user_id}
                        </Badge>
                      )}
                      {result.agent_id && (
                        <Badge variant="outline" className="text-xs">
                          {result.agent_id}
                        </Badge>
                      )}
                      {result.created_at && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {formatDistanceToNow(new Date(result.created_at), {
                            addSuffix: true,
                          })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}

        {searched && results.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Brain className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No matching memories found</p>
              <p className="text-xs text-muted-foreground mt-1">
                Try rephrasing your query or broadening your search
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

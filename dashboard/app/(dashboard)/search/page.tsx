"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Brain, Clock, Loader2, AlertCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface SearchResult {
  id: string;
  memory: string;
  score?: number;
  user_id?: string;
  agent_id?: string;
  created_at?: string;
}

interface UserSpace {
  spaceId: string;
  spaceName: string;
  spaceSlug: string;
}

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [spaces, setSpaces] = useState<UserSpace[]>([]);
  const [selectedSpace, setSelectedSpace] = useState<string>("");
  const [loadingSpaces, setLoadingSpaces] = useState(true);

  // Fetch user's spaces on mount
  useEffect(() => {
    async function fetchSpaces() {
      try {
        const res = await fetch("/api/spaces/mine");
        if (res.ok) {
          const data = await res.json();
          setSpaces(data);
          if (data.length > 0) {
            setSelectedSpace(data[0].spaceSlug);
          }
        }
      } catch {
        // ignore — spaces will be empty
      } finally {
        setLoadingSpaces(false);
      }
    }
    fetchSpaces();
  }, []);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    if (!selectedSpace) {
      setError("Please select a space to search in.");
      return;
    }

    setSearching(true);
    setSearched(true);
    setError(null);
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, user_id: selectedSpace, limit: 20 }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Search failed");
        setResults([]);
        return;
      }
      if (Array.isArray(data)) {
        setResults(data);
      } else if (data?.results) {
        setResults(data.results);
      } else {
        setResults([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search request failed");
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
        <div className="w-48">
          <Select
            value={selectedSpace}
            onValueChange={setSelectedSpace}
            disabled={loadingSpaces || spaces.length === 0}
          >
            <SelectTrigger className="h-11">
              <SelectValue
                placeholder={
                  loadingSpaces
                    ? "Loading..."
                    : spaces.length === 0
                    ? "No spaces"
                    : "Select space"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {spaces.map((space) => (
                <SelectItem key={space.spaceId} value={space.spaceSlug}>
                  {space.spaceName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1">
          <Input
            placeholder="What decisions were made about authentication?"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-11"
          />
        </div>
        <Button
          type="submit"
          disabled={searching || !selectedSpace}
          className="h-11"
        >
          {searching ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Search className="mr-2 h-4 w-4" />
          )}
          Search
        </Button>
      </form>

      {/* Error feedback (M5) */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="flex items-center gap-3 p-4">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {searched && !error && (
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

        {searched && !error && results.length === 0 && (
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

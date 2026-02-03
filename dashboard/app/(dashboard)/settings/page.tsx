"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Key, Copy, RefreshCw, Activity } from "lucide-react";
import { toast } from "sonner";

interface HealthStatus {
  status: string;
  qdrant_connected: boolean;
  embedding_model: string;
  llm_model: string;
}

export default function SettingsPage() {
  const [apiToken, setApiToken] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [health, setHealth] = useState<HealthStatus | null>(null);

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => setHealth(null));
  }, []);

  async function generateToken() {
    setGenerating(true);
    try {
      const res = await fetch("/api/token", { method: "POST" });
      const data = await res.json();
      if (data.token) {
        setApiToken(data.token);
        toast.success("API token generated");
      }
    } catch {
      toast.error("Failed to generate token");
    } finally {
      setGenerating(false);
    }
  }

  function copyToken() {
    if (apiToken) {
      navigator.clipboard.writeText(apiToken);
      toast.success("Token copied to clipboard");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your account and API access</p>
      </div>

      {/* API Token */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-4 w-4" />
            API Token
          </CardTitle>
          <CardDescription>
            Generate a JWT token to authenticate with the MemorAI API from
            external tools or scripts.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {apiToken ? (
            <div className="flex items-center gap-2">
              <Input
                value={apiToken}
                readOnly
                className="font-mono text-xs"
              />
              <Button variant="outline" size="icon" onClick={copyToken}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <Button onClick={generateToken} disabled={generating}>
              <RefreshCw
                className={`mr-2 h-4 w-4 ${generating ? "animate-spin" : ""}`}
              />
              {generating ? "Generating..." : "Generate Token"}
            </Button>
          )}
          <p className="text-xs text-muted-foreground">
            Use this token as a Bearer token in the Authorization header when
            calling the MemorAI API.
          </p>
        </CardContent>
      </Card>

      {/* System Health */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            System Health
          </CardTitle>
        </CardHeader>
        <CardContent>
          {health ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div
                  className={`h-3 w-3 rounded-full ${
                    health.status === "ok" ? "bg-green-500" : "bg-yellow-500"
                  }`}
                />
                <span className="text-sm font-medium capitalize">
                  {health.status}
                </span>
              </div>
              <div className="grid gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Qdrant</span>
                  <Badge
                    variant={
                      health.qdrant_connected ? "default" : "destructive"
                    }
                  >
                    {health.qdrant_connected ? "Connected" : "Disconnected"}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Embedding Model</span>
                  <span className="font-mono text-xs">
                    {health.embedding_model}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">LLM Model</span>
                  <span className="font-mono text-xs">{health.llm_model}</span>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Loading health status...
            </p>
          )}
        </CardContent>
      </Card>

      {/* MCP Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>MCP Configuration</CardTitle>
          <CardDescription>
            Add this to your <code>.mcp.json</code> to connect Claude Code
          </CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="rounded-lg bg-muted p-4 text-xs font-mono overflow-x-auto">
{`{
  "mcpServers": {
    "memorai": {
      "type": "stdio",
      "command": "node",
      "args": ["/path/to/mcp-server/dist/index.js"],
      "env": {
        "MEMORAI_API_URL": "http://localhost:8000",
        "MEMORAI_API_KEY": "<your-api-key>"
      }
    }
  }
}`}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}

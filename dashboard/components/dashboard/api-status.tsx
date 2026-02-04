"use client";

import { useEffect, useState } from "react";

export function ApiStatus() {
  const [status, setStatus] = useState<string>("Checking...");
  const [color, setColor] = useState<string>("text-muted-foreground");
  const [detail, setDetail] = useState<string>("Fetching health status...");

  useEffect(() => {
    async function checkHealth() {
      try {
        const res = await fetch("/api/health");
        const data = await res.json();
        if (res.ok && data.status === "ok") {
          setStatus("Healthy");
          setColor("text-green-500");
          setDetail(
            [
              data.qdrant_connected ? "Qdrant ✓" : "Qdrant ✗",
              data.embedding_model ? `Embed: ${data.embedding_model}` : null,
            ]
              .filter(Boolean)
              .join(" · ") || "FastAPI + Qdrant running"
          );
        } else {
          setStatus("Degraded");
          setColor("text-yellow-500");
          setDetail(data.error || "Some services may be unavailable");
        }
      } catch {
        setStatus("Unreachable");
        setColor("text-red-500");
        setDetail("Cannot reach the MemorAI API");
      }
    }
    checkHealth();
  }, []);

  return (
    <>
      <div className={`text-2xl font-bold ${color}`}>{status}</div>
      <p className="text-xs text-muted-foreground">{detail}</p>
    </>
  );
}

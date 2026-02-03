import { auth } from "@/lib/auth";
import { apiRequest } from "@/lib/api/client";

function chunkText(text: string, chunkSize = 1500, overlap = 200): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.slice(start, end));
    start = end - overlap;
    if (start >= text.length) break;
  }
  return chunks;
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const contentType = req.headers.get("content-type") ?? "";

  let text: string;
  let source: string;
  let spaceSlug: string;

  if (contentType.includes("application/json")) {
    // URL ingestion
    const body = await req.json();
    const { url, space } = body;
    if (!url || !space) {
      return Response.json(
        { error: "url and space are required" },
        { status: 400 }
      );
    }

    spaceSlug = space;
    source = url;

    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
      text = await res.text();
      // Strip HTML tags for basic extraction
      text = text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    } catch (err) {
      return Response.json(
        { error: err instanceof Error ? err.message : "Failed to fetch URL" },
        { status: 400 }
      );
    }
  } else if (contentType.includes("multipart/form-data")) {
    // File upload ingestion
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    spaceSlug = (formData.get("space") as string) ?? "";

    if (!file || !spaceSlug) {
      return Response.json(
        { error: "file and space are required" },
        { status: 400 }
      );
    }

    source = file.name;
    text = await file.text();
  } else {
    return Response.json(
      { error: "Unsupported content type" },
      { status: 415 }
    );
  }

  if (!text || text.length < 10) {
    return Response.json(
      { error: "Content too short to process" },
      { status: 400 }
    );
  }

  // Chunk and store
  const chunks = chunkText(text);
  const results = [];

  for (let i = 0; i < chunks.length; i++) {
    try {
      const result = await apiRequest({
        method: "POST",
        path: "/memories",
        body: {
          messages: [
            {
              role: "user",
              content: chunks[i],
            },
          ],
          user_id: spaceSlug,
          agent_id: "context-composer",
          metadata: {
            source,
            chunk_index: i,
            total_chunks: chunks.length,
          },
        },
      });
      results.push(result);
    } catch {
      results.push({ error: `Failed to process chunk ${i}` });
    }
  }

  return Response.json({
    source,
    chunks_processed: chunks.length,
    results,
  });
}

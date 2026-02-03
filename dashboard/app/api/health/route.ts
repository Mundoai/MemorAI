import { apiRequest } from "@/lib/api/client";

export async function GET() {
  try {
    const result = await apiRequest({ method: "GET", path: "/health" });
    return Response.json(result);
  } catch {
    return Response.json(
      { status: "error", qdrant_connected: false, embedding_model: "", llm_model: "" },
      { status: 502 }
    );
  }
}

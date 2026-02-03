import logging
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, HTTPException, Header, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from mem0 import Memory

from config import settings

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("memorai")

# ---------------------------------------------------------------------------
# Global Mem0 instance (initialised in lifespan)
# ---------------------------------------------------------------------------
memory: Memory | None = None


def _get_mem0_config() -> dict:
    """Build the Mem0 configuration dict."""
    return {
        "llm": {
            "provider": "openai",
            "config": {
                "model": settings.llm_model,
                "openai_base_url": "https://openrouter.ai/api/v1",
                "api_key": settings.openrouter_api_key,
                "temperature": settings.llm_temperature,
                "max_tokens": settings.llm_max_tokens,
            },
        },
        "embedder": {
            "provider": "huggingface",
            "config": {
                "model": settings.embedding_model,
            },
        },
        "vector_store": {
            "provider": "qdrant",
            "config": {
                "collection_name": settings.qdrant_collection,
                "host": settings.qdrant_host,
                "port": settings.qdrant_port,
                "embedding_model_dims": settings.embedding_dims,
            },
        },
        "version": "v1.1",
    }


@asynccontextmanager
async def lifespan(_app: FastAPI):
    """Initialise Mem0 Memory at startup."""
    global memory

    logger.info("Initialising Mem0 Memory with config:")
    logger.info("  LLM model: %s (via OpenRouter)", settings.llm_model)
    logger.info("  Embedding model: %s (local HuggingFace)", settings.embedding_model)
    logger.info("  Vector store: Qdrant at %s:%s", settings.qdrant_host, settings.qdrant_port)

    config = _get_mem0_config()
    memory = Memory.from_config(config)

    logger.info("Mem0 Memory initialised successfully")

    yield

    logger.info("Shutting down MemorAI")


# ---------------------------------------------------------------------------
# FastAPI application
# ---------------------------------------------------------------------------
app = FastAPI(
    title="MemorAI Memory Service",
    description="Smart memory storage and retrieval for AI agents, powered by Mem0",
    version="0.2.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------


class MessageItem(BaseModel):
    role: str = Field(..., description="Message role: user, assistant, or system")
    content: str = Field(..., description="Message content")


class MemoryCreate(BaseModel):
    messages: list[MessageItem] = Field(..., min_length=1, description="Conversation messages for Mem0 to process")
    user_id: str | None = Field(None, description="Project / user namespace for isolation")
    agent_id: str | None = Field(None, description="Which agent stored the memory (claude, subagent, user)")
    run_id: str | None = Field(None, description="Optional run/session identifier")
    metadata: dict | None = Field(None, description="Arbitrary metadata to attach")


class MemoryUpdate(BaseModel):
    data: str = Field(..., min_length=1, description="Updated memory content")


class SearchRequest(BaseModel):
    query: str = Field(..., min_length=1, description="Search query")
    user_id: str | None = Field(None, description="Filter by project / user namespace")
    agent_id: str | None = Field(None, description="Filter by agent")
    limit: int = Field(default=10, ge=1, le=100, description="Max results to return")


class HealthResponse(BaseModel):
    status: str
    qdrant_connected: bool
    embedding_model: str
    llm_model: str


# ---------------------------------------------------------------------------
# Auth dependency
# ---------------------------------------------------------------------------


async def verify_api_key(x_api_key: str | None = Header(default=None)):
    """If MEMORAI_API_KEY is configured, require a matching header."""
    if settings.api_key and settings.api_key != x_api_key:
        raise HTTPException(status_code=401, detail="Invalid or missing API key")


# ---------------------------------------------------------------------------
# Helper to build Mem0 kwargs
# ---------------------------------------------------------------------------


def _mem0_kwargs(
    user_id: str | None = None,
    agent_id: str | None = None,
    run_id: str | None = None,
    metadata: dict | None = None,
) -> dict[str, Any]:
    """Build keyword arguments for Mem0 operations."""
    kwargs: dict[str, Any] = {}
    if user_id:
        kwargs["user_id"] = user_id
    if agent_id:
        kwargs["agent_id"] = agent_id
    if run_id:
        kwargs["run_id"] = run_id
    if metadata:
        kwargs["metadata"] = metadata
    return kwargs


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@app.get("/health", response_model=HealthResponse, tags=["system"])
async def health_check():
    """Return service health status. Public endpoint (no auth required)."""
    qdrant_ok = False
    try:
        # Attempt a simple operation to verify connectivity
        if memory is not None:
            memory.get_all(user_id="__health_check__")
            qdrant_ok = True
    except Exception as e:
        logger.warning("Health check - Qdrant connectivity issue: %s", str(e))
        # Even if get_all fails, Mem0 might still be initialised
        qdrant_ok = memory is not None

    return HealthResponse(
        status="ok" if qdrant_ok else "degraded",
        qdrant_connected=qdrant_ok,
        embedding_model=settings.embedding_model,
        llm_model=settings.llm_model,
    )


# ---- Add memories ---------------------------------------------------------

@app.post(
    "/memories",
    status_code=201,
    dependencies=[Depends(verify_api_key)],
    tags=["memories"],
)
async def add_memories(body: MemoryCreate):
    """
    Add memories from a conversation. Mem0 handles:
    - Extracting key facts from messages
    - Deduplication against existing memories
    - Contradiction resolution
    - Summarization
    """
    try:
        messages = [{"role": m.role, "content": m.content} for m in body.messages]
        kwargs = _mem0_kwargs(
            user_id=body.user_id,
            agent_id=body.agent_id,
            run_id=body.run_id,
            metadata=body.metadata,
        )

        logger.info(
            "Adding memories: user_id=%s, agent_id=%s, messages=%d",
            body.user_id,
            body.agent_id,
            len(messages),
        )

        result = memory.add(messages, **kwargs)

        logger.info("Mem0 add result: %s", result)
        return result

    except Exception as e:
        logger.error("Failed to add memories: %s", str(e), exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to add memories: {str(e)}")


# ---- List memories --------------------------------------------------------

@app.get(
    "/memories",
    dependencies=[Depends(verify_api_key)],
    tags=["memories"],
)
async def list_memories(
    user_id: str | None = Query(None, description="Filter by user/project"),
    agent_id: str | None = Query(None, description="Filter by agent"),
):
    """List all memories, optionally filtered by user_id and/or agent_id."""
    try:
        kwargs = _mem0_kwargs(user_id=user_id, agent_id=agent_id)

        logger.info("Listing memories: user_id=%s, agent_id=%s", user_id, agent_id)
        result = memory.get_all(**kwargs)

        logger.info("Listed %d memories", len(result) if isinstance(result, list) else 0)
        return result

    except Exception as e:
        logger.error("Failed to list memories: %s", str(e), exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to list memories: {str(e)}")


# ---- Get specific memory --------------------------------------------------

@app.get(
    "/memories/{memory_id}",
    dependencies=[Depends(verify_api_key)],
    tags=["memories"],
)
async def get_memory(memory_id: str):
    """Retrieve a specific memory by its ID."""
    try:
        logger.info("Getting memory: %s", memory_id)
        result = memory.get(memory_id)

        if not result:
            raise HTTPException(status_code=404, detail=f"Memory {memory_id} not found")

        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to get memory %s: %s", memory_id, str(e), exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get memory: {str(e)}")


# ---- Update memory --------------------------------------------------------

@app.put(
    "/memories/{memory_id}",
    dependencies=[Depends(verify_api_key)],
    tags=["memories"],
)
async def update_memory(memory_id: str, body: MemoryUpdate):
    """Update an existing memory's content."""
    try:
        logger.info("Updating memory %s", memory_id)
        result = memory.update(memory_id, data=body.data)

        logger.info("Updated memory %s: %s", memory_id, result)
        return result

    except Exception as e:
        logger.error("Failed to update memory %s: %s", memory_id, str(e), exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to update memory: {str(e)}")


# ---- Delete single memory -------------------------------------------------

@app.delete(
    "/memories/{memory_id}",
    status_code=204,
    dependencies=[Depends(verify_api_key)],
    tags=["memories"],
)
async def delete_memory(memory_id: str):
    """Delete a specific memory by ID."""
    try:
        logger.info("Deleting memory: %s", memory_id)
        memory.delete(memory_id)
        logger.info("Deleted memory: %s", memory_id)
        return None

    except Exception as e:
        logger.error("Failed to delete memory %s: %s", memory_id, str(e), exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to delete memory: {str(e)}")


# ---- Delete all memories for a user ---------------------------------------

@app.delete(
    "/memories",
    status_code=204,
    dependencies=[Depends(verify_api_key)],
    tags=["memories"],
)
async def delete_all_memories(
    user_id: str | None = Query(None, description="Delete all memories for this user/project"),
    agent_id: str | None = Query(None, description="Delete all memories for this agent"),
):
    """Delete all memories for a given user_id and/or agent_id."""
    try:
        kwargs = _mem0_kwargs(user_id=user_id, agent_id=agent_id)

        if not kwargs:
            raise HTTPException(
                status_code=400,
                detail="Must provide at least user_id or agent_id to delete memories",
            )

        logger.info("Deleting all memories: user_id=%s, agent_id=%s", user_id, agent_id)
        memory.delete_all(**kwargs)
        logger.info("Deleted all memories for user_id=%s, agent_id=%s", user_id, agent_id)
        return None

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to delete all memories: %s", str(e), exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to delete memories: {str(e)}")


# ---- Memory history -------------------------------------------------------

@app.get(
    "/memories/{memory_id}/history",
    dependencies=[Depends(verify_api_key)],
    tags=["memories"],
)
async def get_memory_history(memory_id: str):
    """Get the change history for a specific memory."""
    try:
        logger.info("Getting history for memory: %s", memory_id)
        result = memory.history(memory_id)

        logger.info("History for memory %s: %d entries", memory_id, len(result) if isinstance(result, list) else 0)
        return result

    except Exception as e:
        logger.error("Failed to get memory history %s: %s", memory_id, str(e), exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to get memory history: {str(e)}")


# ---- Search memories ------------------------------------------------------

@app.post(
    "/search",
    dependencies=[Depends(verify_api_key)],
    tags=["search"],
)
async def search_memories(body: SearchRequest):
    """
    Semantic search across memories. Mem0 handles relevance ranking
    and smart retrieval.
    """
    try:
        kwargs = _mem0_kwargs(user_id=body.user_id, agent_id=body.agent_id)
        kwargs["limit"] = body.limit

        logger.info(
            "Searching memories: query='%s', user_id=%s, agent_id=%s, limit=%d",
            body.query[:80],
            body.user_id,
            body.agent_id,
            body.limit,
        )

        result = memory.search(body.query, **kwargs)

        result_count = len(result) if isinstance(result, list) else 0
        logger.info("Search returned %d results for query: '%s'", result_count, body.query[:80])
        return result

    except Exception as e:
        logger.error("Failed to search memories: %s", str(e), exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to search memories: {str(e)}")


# ---- Reset all memories ---------------------------------------------------

@app.post(
    "/reset",
    status_code=204,
    dependencies=[Depends(verify_api_key)],
    tags=["system"],
)
async def reset_all_memories():
    """Reset (delete) ALL memories across all users and agents. Use with caution."""
    try:
        logger.warning("Resetting ALL memories!")
        memory.reset()
        logger.info("All memories have been reset")
        return None

    except Exception as e:
        logger.error("Failed to reset memories: %s", str(e), exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to reset memories: {str(e)}")

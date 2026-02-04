from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # OpenRouter (free models for Mem0's LLM processing)
    openrouter_api_key: str = ""
    llm_model: str = "arcee-ai/trinity-large-preview:free"  # Supports JSON mode required by Mem0
    llm_temperature: float = 0.1
    llm_max_tokens: int = 2000

    # Embeddings (local, no API cost)
    embedding_model: str = "multi-qa-MiniLM-L6-cos-v1"
    embedding_dims: int = 384

    # Qdrant
    qdrant_host: str = "qdrant"
    qdrant_port: int = 6333
    qdrant_collection: str = "memories"

    # API auth
    api_key: str = ""
    jwt_secret: str = "memorai-jwt-secret-change-in-production"

    # PostgreSQL (for spaces, users, etc.)
    database_url: str = ""

    class Config:
        env_prefix = "MEMORAI_"
        env_file = ".env"


settings = Settings()

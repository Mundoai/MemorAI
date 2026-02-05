FROM python:3.13-slim

WORKDIR /app

# Install system deps for sentence-transformers
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download the embedding model during build
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('multi-qa-MiniLM-L6-cos-v1')"

COPY . .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]

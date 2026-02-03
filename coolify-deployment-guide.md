# Coolify Deployment Guide for LangChain + Langflow

> **Last Updated:** February 2026
> **Coolify Version:** v4.0.0-beta.462+
> **Project URL:** https://panel.mywebsites.dev/projects
> **GitHub Source:** https://github.com/langchain-ai/langchain

## What You Get

| Service | Port | Description |
|---------|------|-------------|
| **LangChain API** | 8000 | REST API for apps to connect |
| **Langflow Admin** | 7860 | Visual admin UI for workflows |
| **Swagger Docs** | 8000/docs | Interactive API documentation |

## Table of Contents

1. [Overview](#overview)
2. [Deployment Architecture](#deployment-architecture)
3. [Quick Deploy (Docker Compose)](#quick-deploy-docker-compose)
4. [Manual Deployment](#manual-deployment)
5. [Environment Variables](#environment-variables)
6. [Accessing Your Services](#accessing-your-services)
7. [Use Cases](#use-cases)
8. [Updating from GitHub](#updating-from-github)
9. [Troubleshooting](#troubleshooting)

---

## Overview

This guide covers deploying the LangChain Python framework to a self-hosted Coolify server. LangChain is deployed as a Docker container that provides:

- **Development environment** for working with LangChain packages
- **Runtime environment** for LangChain-based applications
- **Jupyter Lab** for interactive development
- **LangServe** for deploying LangChain chains as APIs

### Key Advantage

Deploying from the GitHub repository (`https://github.com/langchain-ai/langchain`) allows automatic updates as the project receives frequent updates (almost daily).

---

## Deployment Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                      Coolify Server (VPS)                            │
│                    panel.mywebsites.dev                              │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   GitHub Repo ─────► Docker Compose ─────► Containers                │
│                                                                      │
│   ┌─────────────────────────────────────────────────────────────┐    │
│   │                    Docker Network                            │    │
│   │                                                             │    │
│   │  ┌─────────────────┐      ┌─────────────────────────┐      │    │
│   │  │  LangChain API  │      │    Langflow Admin UI    │      │    │
│   │  │   Port: 8000    │◄────►│      Port: 7860         │      │    │
│   │  │                 │      │                         │      │    │
│   │  │  /health        │      │  Visual Builder         │      │    │
│   │  │  /docs          │      │  Workflow Management    │      │    │
│   │  │  /chain/invoke  │      │  Drag & Drop UI         │      │    │
│   │  │  /chat/invoke   │      │  API Export             │      │    │
│   │  │  /rag/invoke    │      │                         │      │    │
│   │  └─────────────────┘      └─────────────────────────┘      │    │
│   │                                                             │    │
│   │  Optional: Redis (caching) | Jupyter (development)          │    │
│   └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Quick Deploy (Docker Compose)

**This is the RECOMMENDED method for Coolify deployment.**

### Step 1: Create Project in Coolify

1. Go to `https://panel.mywebsites.dev`
2. Click **Projects** → **New Project**
3. Name: `LangChain`

### Step 2: Add Docker Compose Resource

1. Inside the project, click **New Resource**
2. Select **Docker Compose**
3. Choose **GitHub Repository**
4. Repository: `https://github.com/langchain-ai/langchain` (or your fork)
5. Branch: `master`
6. Docker Compose Location: `/docker-compose.yml`

### Step 3: Configure Environment Variables

In Coolify, go to **Environment Variables** and add:

```env
# Required: LLM API Keys (set at least one)
OPENAI_API_KEY=sk-your-key-here
ANTHROPIC_API_KEY=sk-ant-your-key-here

# Langflow Admin Credentials
LANGFLOW_SUPERUSER=admin
LANGFLOW_SUPERUSER_PASSWORD=secure-password-here

# Optional: LangSmith Tracing
LANGCHAIN_TRACING_V2=true
LANGCHAIN_API_KEY=your-langsmith-key
```

### Step 4: Configure Domains

| Service | Suggested Domain |
|---------|------------------|
| LangChain API | `api.langchain.yourdomain.com` → Port 8000 |
| Langflow Admin | `admin.langchain.yourdomain.com` → Port 7860 |

### Step 5: Deploy

1. Click **Deploy**
2. Wait for build (first build: ~5-10 minutes)
3. Check logs for any errors

### Step 6: Access Your Services

| Service | URL |
|---------|-----|
| **LangChain API** | `https://api.langchain.yourdomain.com` |
| **API Docs (Swagger)** | `https://api.langchain.yourdomain.com/docs` |
| **Langflow Admin** | `https://admin.langchain.yourdomain.com` |

---

## Manual Deployment

---

## Deployment Options

### Option 1: Deploy from GitHub (Recommended)

Deploy directly from the official LangChain repository for automatic updates:

- **Repository:** `https://github.com/langchain-ai/langchain`
- **Branch:** `master` (or specific tag for stability)
- **Dockerfile:** `Dockerfile` (root of repository)

### Option 2: Deploy from Fork

Fork the repository to your account for custom modifications:

1. Fork `langchain-ai/langchain` to your GitHub account
2. Configure Coolify to pull from your fork
3. Merge upstream changes periodically

### Option 3: Docker Compose

Use the included `docker-compose.yml` for additional services like Redis.

---

## How to Deploy to Coolify

### Step 1: Create New Project

1. Navigate to `https://panel.mywebsites.dev`
2. Go to **Projects** → **New Project**
3. Name: `LangChain`
4. Description: `LangChain Python framework for AI/LLM applications`

### Step 2: Add Application

1. Inside the project, click **New Resource** → **Application**
2. Select **GitHub** as source
3. Repository: `https://github.com/langchain-ai/langchain`
4. Branch: `master`

### Step 3: Configure Build Settings

```yaml
# Build Configuration
Build Pack: Dockerfile
Dockerfile Location: /Dockerfile
Docker Build Target: production

# Port Configuration
Ports Exposes: 8000,8888
Port Mappings:
  - 8000:8000 (API/LangServe)
  - 8888:8888 (Jupyter Lab)
```

### Step 4: Set Environment Variables

Navigate to **Environment Variables** and add:

```env
# Required for LangSmith tracing (optional but recommended)
LANGCHAIN_TRACING_V2=true
LANGCHAIN_API_KEY=your_langsmith_api_key
LANGCHAIN_PROJECT=langchain-coolify

# LLM Provider Keys (add as needed)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GROQ_API_KEY=gsk_...

# Application Settings
PORT=8000
```

### Step 5: Configure Domain (Optional)

1. Go to **Domains** section
2. Add domain: `langchain.yourdomain.com`
3. Enable HTTPS with Let's Encrypt

### Step 6: Deploy

1. Click **Deploy** button
2. Monitor build logs
3. Wait for container to start (~3-5 minutes for first build)

---

## Environment Variables

### Core Configuration

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | API port (default: 8000) |
| `JUPYTER_PORT` | No | Jupyter port (default: 8888) |

### LangSmith Integration

| Variable | Required | Description |
|----------|----------|-------------|
| `LANGCHAIN_TRACING_V2` | No | Enable tracing (true/false) |
| `LANGCHAIN_API_KEY` | No | LangSmith API key |
| `LANGCHAIN_PROJECT` | No | Project name in LangSmith |

### LLM Provider Keys

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | No | OpenAI API key |
| `ANTHROPIC_API_KEY` | No | Anthropic API key |
| `GROQ_API_KEY` | No | Groq API key |
| `GOOGLE_API_KEY` | No | Google AI API key |

---

## Use Cases

### 1. Jupyter Lab Development

Override the container command to start Jupyter:

```bash
# In Coolify, set Custom Start Command:
jupyter lab --ip=0.0.0.0 --port=8888 --no-browser --allow-root
```

Access at: `https://your-domain:8888`

### 2. LangServe API

Create a simple `app.py` in your workspace:

```python
from fastapi import FastAPI
from langserve import add_routes
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate

app = FastAPI(title="LangChain API")

# Health check endpoint
@app.get("/health")
def health():
    return {"status": "healthy"}

# Add your chains
prompt = ChatPromptTemplate.from_template("Tell me about {topic}")
chain = prompt | ChatOpenAI(model="gpt-4o-mini")

add_routes(app, chain, path="/chat")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

Start command:
```bash
python /app/workspace/app.py
```

### 3. Custom Python Scripts

Mount your scripts in `/app/workspace` and run:

```bash
python /app/workspace/your_script.py
```

---

## Updating from GitHub

### Automatic Updates

Configure webhook in Coolify for automatic deployments on GitHub pushes:

1. Go to **Application Settings** → **Webhooks**
2. Copy the webhook URL
3. Add to GitHub repository settings (or watch releases)

### Manual Updates

1. Go to your application in Coolify
2. Click **Redeploy** button
3. Coolify will pull latest from GitHub and rebuild

### Version Pinning

For stability, pin to a specific tag:

1. Change branch to a release tag (e.g., `v0.3.0`)
2. Only update when you explicitly change the tag

---

## Troubleshooting

### Build Takes Too Long (>10 minutes)

**Cause:** Installing all dependencies from scratch

**Solutions:**
1. Enable Docker layer caching in Coolify
2. Use a slimmer Dockerfile with only needed packages
3. Pre-build and push to container registry

### Container Crashes on Start

**Check:**
1. View logs in Coolify → Deployments → Latest → Logs
2. Verify environment variables are set correctly
3. Ensure custom start command is valid

### Memory Issues

**Cause:** LangChain with many packages uses significant memory

**Solutions:**
1. Increase container memory limit (minimum 2GB recommended)
2. Use swap if available
3. Only install required packages

### Port Already in Use

**Error:** `Address already in use`

**Solution:**
1. Check if another container uses port 8000/8888
2. Change port mappings in Coolify
3. Set `PORT` environment variable

### Cannot Connect to LLM Providers

**Check:**
1. API keys are set in environment variables
2. Container has internet access
3. No firewall blocking outbound connections

---

## Quick Reference

### Key Endpoints

| Endpoint | Port | Description |
|----------|------|-------------|
| `/health` | 8000 | Health check |
| `/docs` | 8000 | API documentation (Swagger) |
| `/` | 8888 | Jupyter Lab interface |

### Useful Commands

```bash
# Check container logs
docker logs langchain-app

# Enter container shell
docker exec -it langchain-app /bin/bash

# Test API
curl http://localhost:8000/health

# List installed packages
docker exec langchain-app pip list | grep langchain
```

### Deployment Checklist

- [ ] Project created in Coolify
- [ ] GitHub repository connected
- [ ] Dockerfile path set correctly
- [ ] Ports exposed (8000, 8888)
- [ ] Environment variables configured
- [ ] Domain/SSL configured (optional)
- [ ] Deployment successful
- [ ] Health check passing

---

## Accessing Your Services

### LangChain API

**Swagger UI (Interactive Docs):**
```
https://api.langchain.yourdomain.com/docs
```

**Test the API:**
```bash
# Health check
curl https://api.langchain.yourdomain.com/health

# List models
curl https://api.langchain.yourdomain.com/models

# Invoke chain
curl -X POST https://api.langchain.yourdomain.com/chain/invoke \
  -H "Content-Type: application/json" \
  -d '{"input": "Hello!", "model": "openai"}'
```

### Langflow Admin UI

**Access:**
```
https://admin.langchain.yourdomain.com
```

**Login:**
- Username: Value of `LANGFLOW_SUPERUSER` (default: `admin`)
- Password: Value of `LANGFLOW_SUPERUSER_PASSWORD`

**Features:**
1. **Build Workflows** - Drag and drop LangChain components
2. **Test Chains** - Run and debug in real-time
3. **Export API** - Generate REST endpoints
4. **Manage Prompts** - Version and test prompts
5. **Monitor** - View execution logs

### Connecting Apps to LangChain

**From any application:**
```python
import requests

# Python example
response = requests.post(
    "https://api.langchain.yourdomain.com/chain/invoke",
    json={
        "input": "Explain quantum computing",
        "model": "openai"
    }
)
print(response.json()["output"])
```

```javascript
// JavaScript example
const response = await fetch('https://api.langchain.yourdomain.com/chain/invoke', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ input: 'Hello!', model: 'demo' })
});
const data = await response.json();
```

---

## Related Documentation

- [LangChain Documentation](https://docs.langchain.com/)
- [LangServe Documentation](https://docs.langchain.com/langserve)
- [Langflow Documentation](https://docs.langflow.org/)
- [Coolify Documentation](https://coolify.io/docs)
- [LangSmith](https://smith.langchain.com/)

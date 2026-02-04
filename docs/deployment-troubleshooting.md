# Deployment Troubleshooting Guide

This document captures hard-won lessons from deploying MemorAI to production on Coolify (Hostinger VPS). Each issue took significant debugging time - reference this first before investigating deployment problems.

## Issue: Pages hang after login (sidebar/navigation doesn't work)

**Symptoms:**
- OAuth login completes successfully
- Home page may load once (during OAuth redirect)
- Clicking sidebar links or quick action buttons does nothing
- Direct navigation to `/memories`, `/spaces`, etc. times out
- No errors visible in server logs

**Root cause:** The NextAuth middleware runs on the **Edge runtime**, which cannot use the `postgres` npm package for TCP connections. If the `session` callback queries the DB, it fails on Edge, exhausts the connection pool, and causes all subsequent page renders to hang.

**Fix:** Never query the database in the NextAuth `session` callback. Store computed values (like user role) in the JWT token during the `jwt` callback instead.

```typescript
// BAD - session callback runs on Edge, DB query will fail
async session({ session, token }) {
  const dbUser = await db.select(...).from(users).where(...); // HANGS ON EDGE
  session.user.role = dbUser[0]?.role;
}

// GOOD - jwt callback runs on Node.js during sign-in only
async jwt({ token, user, trigger }) {
  if (trigger === "signIn" || !token.role) {
    const dbUser = await db.select(...).from(users).where(...); // Safe on Node.js
    token.role = dbUser[0]?.role ?? "user";
  }
  return token;
},
async session({ session, token }) {
  session.user.role = token.role; // Just read from JWT, no DB call
}
```

**How to diagnose:** Add `console.log` to the session callback. If you see repeated calls from `.next/server/edge/chunks/` with `DB query failed`, this is the issue.

---

## Issue: Login page shows "No providers configured"

**Symptoms:**
- Login page renders but shows "No authentication providers configured"
- OAuth credentials are correctly set in environment variables
- Works fine in local development

**Root cause:** Next.js statically generates pages at Docker build time. During `docker build`, OAuth environment variables are not available, so the page is pre-rendered with `hasGoogle = false`.

**Fix:** Add `export const dynamic = "force-dynamic"` to the login page:

```typescript
// dashboard/app/login/page.tsx
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  await headers(); // belt-and-suspenders to force runtime rendering
  const hasGoogle = !!process.env.AUTH_GOOGLE_ID && !!process.env.AUTH_GOOGLE_SECRET;
  // ...
}
```

---

## Issue: "Password authentication failed for user memorai"

**Symptoms:**
- Container starts but migrations fail
- `password authentication failed for user "memorai"` in logs
- Database credentials are correct

**Root cause:** Docker DNS collision. When the dashboard container is connected to both the app network AND the `coolify` network, the hostname `postgres` resolves to Coolify's own database (coolify-db) instead of MemorAI's postgres container.

**Diagnosis:**
```bash
# Check which networks the container is on
docker inspect CONTAINER_NAME --format '{{json .NetworkSettings.Networks}}' | python3 -m json.tool

# Check where "postgres" resolves to
docker exec CONTAINER_NAME node -e "require('dns').resolve4('postgres', (e,a) => console.log(a))"
```

**Fix:**
```bash
docker network disconnect coolify CONTAINER_NAME
docker restart CONTAINER_NAME
```

**Prevention:** The deploy script (`/tmp/redeploy-dashboard.sh`) only connects to the app network.

---

## Issue: MissingCSRF error on OAuth sign-in

**Symptoms:**
- Clicking "Continue with Google" fails
- Server logs show `MissingCSRF` error
- Happens when users click before the page fully loads

**Root cause:** The CSRF token is fetched client-side via `/api/auth/csrf`. If the user clicks the button before the token loads, an empty string is submitted.

**Fix:** The sign-in form disables the button until the CSRF token is fetched, with a retry on failure.

---

## Issue: Shell escaping failures on VPS deploy

**Symptoms:**
- `docker run` command with Traefik labels fails
- Backticks in labels are interpreted by the shell
- Container gets removed but new one doesn't start

**Root cause:** The VPS uses zsh, which interprets backtick characters in Traefik label values like `` Host(`domain`) ``.

**Fix:** Always use a deploy script file instead of inline `docker run` commands:
```bash
# Write the script to a file
cat > /tmp/redeploy-dashboard.sh << 'SCRIPT'
#!/bin/bash
docker run -d \
  --name "$CONTAINER_NAME" \
  -l "traefik.http.routers.dashboard.rule=Host(\`memoria.mywebsites.dev\`)" \
  ...
SCRIPT

# Execute it
bash /tmp/redeploy-dashboard.sh
```

---

## Issue: Next.js standalone build can't connect to postgres (scram-sha-256)

**Symptoms:**
- Migrations pass (using separately copied postgres module)
- But page renders hang when trying to query the DB
- No error messages

**Root cause:** Without `serverExternalPackages`, webpack/Turbopack bundles the `postgres` npm package into server chunks, breaking the native crypto needed for scram-sha-256 authentication.

**Fix:** In `next.config.ts`:
```typescript
const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["postgres"],
};
```

The Dockerfile also copies `node_modules/postgres` explicitly for the migration script.

---

## Deploy Checklist

Before deploying dashboard changes:

1. [ ] Push to GitHub `main` branch
2. [ ] SSH to VPS: `ssh root@168.231.69.241`
3. [ ] Pull code: `cd /tmp/MemorAI && git pull origin main`
4. [ ] Rebuild image: `cd dashboard && docker build -t memorai-dashboard:latest .`
5. [ ] Run deploy script: `bash /tmp/redeploy-dashboard.sh`
6. [ ] Check logs: `docker logs CONTAINER_NAME`
7. [ ] Verify migrations passed
8. [ ] Verify no Edge runtime errors in logs
9. [ ] Test login page loads with OAuth button
10. [ ] Test OAuth sign-in completes
11. [ ] Test sidebar navigation (Memories, Spaces, Search, Settings)
12. [ ] Test quick action buttons on home page

## Architecture Reference

```
Browser -> Traefik (TLS) -> Dashboard Container (port 3000)
                                |
                                +--> Next.js Edge Runtime (middleware/auth check)
                                |      - JWT validation only
                                |      - NO database calls
                                |
                                +--> Next.js Node.js Runtime (page renders)
                                |      - Database queries (postgres)
                                |      - API calls to FastAPI backend
                                |
                                +--> PostgreSQL (app network, hostname: postgres)
                                |
                                +--> FastAPI API (app network, hostname: api:8000)
```

## Environment Variables (Dashboard)

| Variable | Required | Description |
|----------|----------|-------------|
| `AUTH_GOOGLE_ID` | Yes | Google OAuth client ID |
| `AUTH_GOOGLE_SECRET` | Yes | Google OAuth client secret |
| `AUTH_SECRET` | Yes | NextAuth encryption secret |
| `AUTH_URL` | Yes | Public URL (https://memoria.mywebsites.dev) |
| `AUTH_TRUST_HOST` | Yes | Set to `true` for reverse proxy |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `MEMORAI_API_URL` | Yes | FastAPI backend URL (http://api:8000) |
| `NEXTAUTH_SECRET` | Yes | Same as AUTH_SECRET |
| `NEXTAUTH_URL` | Yes | Same as AUTH_URL |

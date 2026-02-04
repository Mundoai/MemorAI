# Dashboard Bug Audit — MemorAI

> Full audit of `dashboard/` frontend, API routes, and components.  
> Date: 2026-02-04

## Summary

- **15 issues found** (3 critical, 5 medium, 7 low)
- **Affected areas:** search, memory detail, sidebar navigation, forms, API routes, accessibility

---

## 🔴 Critical Issues

### C1: Search page has no space filtering — searches everything
**File:** `dashboard/app/(dashboard)/search/page.tsx`  
**Issue:** The search form sends `{ query, limit: 20 }` without any `user_id`. This means it searches across ALL spaces (all user_ids), not just the spaces the user has access to.  
**Impact:** Users can potentially see memories from spaces they don't belong to. This is a **data leak / authorization bypass**.  
**Fix:** Fetch user's spaces, add a space selector dropdown, and send `user_id` in the search request. On the API route side (`/api/search/route.ts`), validate that the user has access to the requested space.

### C2: Memory delete API route has no authorization check on ownership
**File:** `dashboard/app/api/memories/[id]/route.ts`  
**Issue:** The DELETE and PUT endpoints only check that the user is authenticated (`session?.user`), not that the user has access to the space that owns the memory. Any authenticated user can delete/update any memory by ID.  
**Impact:** Any logged-in user can delete or modify any memory in the system.  
**Fix:** Before allowing DELETE/PUT, look up the memory's `user_id` (space slug), verify the user is a member of that space, and check their role permissions.

### C3: Kanban card routes have no space membership verification
**File:** `dashboard/app/api/kanban/cards/route.ts`  
**Issue:** POST, PUT, and DELETE endpoints only check authentication, not that the user is a member of the space that owns the board/column. Any authenticated user who knows a `columnId` can create/modify/delete cards.  
**Impact:** Unauthorized modification of kanban boards across spaces.  
**Fix:** Trace `columnId` → `kanbanColumns` → `kanbanBoards` → `spaces`, then verify user membership.

---

## 🟡 Medium Issues

### M1: Dashboard homepage hardcodes "Healthy" API status
**File:** `dashboard/app/(dashboard)/page.tsx` (line ~70)  
**Issue:** The API health card always shows `<div className="text-2xl font-bold text-green-500">Healthy</div>` — it never actually checks the API health.  
**Fix:** Fetch `/api/health` and render the actual status. The Settings page already does this correctly.

### M2: Memory count on dashboard shows "--" hardcoded
**File:** `dashboard/app/(dashboard)/page.tsx` (line ~56)  
**Issue:** The Memories stat card shows `--` instead of the actual memory count.  
**Fix:** In `getStats()`, also fetch memories for each user space (like the memories page does) and sum the counts.

### M3: Header `img` tag uses `src` directly instead of Next.js `Image`
**File:** `dashboard/components/layout/header.tsx`  
**Issue:** Uses `<img src={user.image}>` instead of `<Image>` from next/image. This bypasses Next.js image optimization and may cause CSP issues in production.  
**Fix:** Use `next/image` `Image` component with proper `width`/`height` and add the OAuth provider domains to `next.config.ts` `images.remotePatterns`.

### M4: Sidebar "Kanban" link goes to `/spaces?tab=kanban` but no page handles this
**File:** `dashboard/components/layout/sidebar.tsx`  
**Issue:** The Kanban sidebar link navigates to `/spaces?tab=kanban`, but the Spaces page doesn't read or handle a `tab` query parameter. The kanban board is only accessible per-space via the API route, and there's no Kanban UI page at all.  
**Impact:** Dead link — clicking Kanban just shows the Spaces list.  
**Fix:** Either create a dedicated Kanban page or add tab handling to the Spaces page. Alternatively, remove the sidebar link until the feature is built.

### M5: Search results don't show error feedback on failure
**File:** `dashboard/app/(dashboard)/search/page.tsx`  
**Issue:** The catch block does `setResults([])` but never shows an error message. If the search API fails (e.g., API down, network error), the user sees "0 results found" which is misleading.  
**Fix:** Add an `error` state and display it in the UI when the fetch fails.

---

## 🟢 Low Issues

### L1: Space create form doesn't handle slug collisions gracefully
**File:** `dashboard/components/spaces/space-create-button.tsx`  
**Issue:** If the API returns 409 (slug exists), the error message from the server is shown via toast. But the slug is auto-generated from the name and there's no way for the user to customize it before submitting.  
**Fix:** Show the slug as an editable field, or auto-append a number when collision is detected.

### L2: Tags route DELETE uses request body which is non-standard
**File:** `dashboard/app/api/memories/[id]/tags/route.ts`  
**Issue:** The DELETE handler reads `tagId` from `req.json()` body. While this works, DELETE requests with bodies are non-standard and some proxies/CDNs strip the body. This could silently fail in production behind certain infrastructure.  
**Fix:** Use query parameters or change to `POST /api/memories/[id]/tags/remove`.

### L3: Bookmark toggle doesn't show current state
**File:** `dashboard/components/memories/memory-actions.tsx`  
**Issue:** The Bookmark button always shows the same icon and text regardless of whether the memory is bookmarked. The bookmarked state from the parent page isn't passed to this component.  
**Fix:** Pass `isBookmarked` prop and toggle the icon between `Bookmark` and `BookmarkCheck`.

### L4: Memory browser filter resets pagination but URL doesn't update
**File:** `dashboard/components/memories/memory-browser.tsx`  
**Issue:** When typing in the filter input, `page` resets to 0 (good), but the filter text isn't synced to the URL. Refreshing the page loses the filter.  
**Fix:** Use URL search params for the filter text (via `router.push`) for shareable/persistent filtering.

### L5: Admin page has no pagination for audit log
**File:** `dashboard/app/(dashboard)/admin/page.tsx`  
**Issue:** Fetches only the most recent 20 audit entries with no way to see older ones. The API supports `limit` and `offset` parameters.  
**Fix:** Add pagination controls or "Load More" button.

### L6: SignOut button has race condition with CSRF token
**File:** `dashboard/components/layout/signout-button.tsx`  
**Issue:** The form submits a CSRF token fetched in `useEffect`. If the user clicks the sign-out button before the CSRF fetch completes, it submits with an empty string token.  
**Fix:** Disable the button until `csrfToken` is loaded, or use a loading state.

### L7: Invitation accept doesn't handle duplicate membership
**File:** `dashboard/app/api/invitations/[id]/accept/route.ts`  
**Issue:** If a user is already a member of the space and tries to accept an invitation, the `db.insert(spaceMembers)` will fail due to the unique constraint, returning a 500 error instead of a friendly message.  
**Fix:** Check for existing membership before inserting and return 409 with a clear message.

---

## Accessibility Issues

### A1: Space dropdown uses native `<select>` without label
**File:** `dashboard/components/memories/memory-browser.tsx`  
**Issue:** The `<select>` for space filtering has no associated `<label>` or `aria-label`. Screen readers won't know what this dropdown is for.  
**Fix:** Add `aria-label="Filter by space"`.

### A2: Card links lack focus indicators
**File:** Multiple components (memory cards, space cards)  
**Issue:** Cards that are clickable via `<Link>` wrapping don't have visible focus indicators (`:focus-visible` styles).  
**Fix:** Add `focus-visible:ring-2 focus-visible:ring-primary` to card components.

### A3: Delete confirmation uses `window.confirm()`
**File:** `dashboard/components/memories/memory-actions.tsx`  
**Issue:** `window.confirm()` is not accessible and cannot be styled. It also blocks the main thread.  
**Fix:** Use a proper modal dialog component (e.g., from shadcn/ui).

---

## Architecture Observations (Not Bugs)

1. **No loading states on server components** — pages like Memories and Spaces make API calls during SSR. If the API is slow, the page hangs with no feedback. Consider adding `loading.tsx` files.
2. **No error boundaries** — if a server component throws, the user gets the default Next.js error page. Add `error.tsx` files.
3. **Dashboard doesn't display tags on memories** — tags can be created and applied via API, but the memory detail page and memory browser don't show them.
4. **No memory edit UI** — the API route for PUT exists but there's no edit form in the UI. The Edit button icon is imported but never used.
5. **Ingest route exists but has no UI** — file/URL ingestion is available via API but there's no dashboard page for it.

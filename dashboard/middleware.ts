export { auth as middleware } from "@/lib/auth";

export const config = {
  matcher: [
    // Protect page routes only. Exclude:
    // - /login (auth page)
    // - /api/* (API routes handle their own auth via session checks)
    // - /_next/* (static assets, images, HMR)
    // - /favicon.ico
    "/((?!login|api|_next|favicon.ico).*)",
  ],
};

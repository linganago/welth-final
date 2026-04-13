import arcjet, { createMiddleware, detectBot, shield } from "@arcjet/next";
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/account(.*)",
  "/transaction(.*)",
]);

// ---------------------------------------------------------------------------
// ArcJet mode selection
// ---------------------------------------------------------------------------
// In CI (ARCJET_ENV=ci) and during E2E tests, we switch detectBot to DRY_RUN
// so Playwright's headless Chromium and GitHub Actions runners are never
// blocked. In production this is always LIVE.
//
// Set ARCJET_ENV=ci in your GitHub Actions env block for the E2E job.
// ---------------------------------------------------------------------------
const ARCJET_BOT_MODE =
  process.env.ARCJET_ENV === "ci" ||
  process.env.NODE_ENV === "test"
    ? "DRY_RUN"
    : "LIVE";

const aj = arcjet({
  key: process.env.ARCJET_KEY,
  rules: [
    shield({ mode: "LIVE" }),
    detectBot({
      mode: ARCJET_BOT_MODE,
      allow: [
        "CATEGORY:SEARCH_ENGINE",
        "GO_HTTP", // For Inngest
      ],
    }),
  ],
});

const clerk = clerkMiddleware(async (auth, req) => {
  const { userId } = await auth();

  if (!userId && isProtectedRoute(req)) {
    const { redirectToSignIn } = await auth();
    return redirectToSignIn();
  }

  return NextResponse.next();
});

export default createMiddleware(aj, clerk);

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};

import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Public routes that do not require authentication
const isPublicRoute = createRouteMatcher([
  "/",
  "/@:handle(.*)",
  "/u/:handle(.*)",
  "/api/usernames/availability(.*)",
  "/api/webhooks(.*)",
  "/api/events(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  const { pathname } = req.nextUrl;

  // Handle canonical @username rewrites to /u/[handle] (ADR-0004a)
  if (pathname.startsWith("/@")) {
    const handleAndRest = pathname.slice(2); // remove "/@"
    const url = req.nextUrl.clone();
    url.pathname = `/u/${handleAndRest}`;
    return NextResponse.rewrite(url);
  }

  // Protect non-public routes
  if (!isPublicRoute(req)) {
    await auth.protect();
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/@:path*",
    "/(api|trpc)(.*)",
  ],
};

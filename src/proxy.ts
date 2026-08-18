import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isProtectedRoute = createRouteMatcher([
  "/upload(.*)",
  "/me(.*)",
  "/account(.*)",
  "/admin(.*)",
]);
const clerkConfigured = Boolean(process.env.CLERK_SECRET_KEY?.trim());

export default clerkConfigured
  ? clerkMiddleware(async (auth, request) => {
      if (request.nextUrl.pathname.startsWith("/api/v1")) {
        return NextResponse.next();
      }
      if (isProtectedRoute(request)) {
        await auth.protect();
      }
    })
  : function proxy() {
      return NextResponse.next();
    };

export const config = {
  matcher: [
    "/((?!_next|api/v1|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/__clerk/(.*)",
  ],
};

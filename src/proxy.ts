import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isProtectedRoute = createRouteMatcher([
  "/upload(.*)",
  "/me(.*)",
  "/account(.*)",
  "/admin(.*)",
]);
const clerkConfigured = Boolean(process.env.CLERK_SECRET_KEY?.trim());

function apexToWww(request: Request) {
  const host = request.headers.get("host")?.split(":")[0];
  if (host !== "spiritvalemods.com") return null;
  const dest = new URL(request.url);
  dest.hostname = "www.spiritvalemods.com";
  dest.protocol = "https:";
  dest.port = "";
  return NextResponse.redirect(dest, 308);
}

export default clerkConfigured
  ? clerkMiddleware(async (auth, request) => {
      const redirected = apexToWww(request);
      if (redirected) return redirected;
      if (request.nextUrl.pathname.startsWith("/api/v1")) {
        return NextResponse.next();
      }
      if (isProtectedRoute(request)) {
        await auth.protect();
      }
    })
  : function proxy(request: Request) {
      return apexToWww(request) ?? NextResponse.next();
    };

export const config = {
  matcher: [
    "/((?!_next|api/v1|api/upload/blob|files|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|exe|webmanifest)).*)",
    "/__clerk/(.*)",
  ],
};

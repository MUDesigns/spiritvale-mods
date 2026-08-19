import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isProtectedRoute = createRouteMatcher([
  "/upload(.*)",
  "/me(.*)",
  "/account(.*)",
  "/admin(.*)",
]);
const clerkConfigured = Boolean(process.env.CLERK_SECRET_KEY?.trim());
const isSessionTaskRoute = createRouteMatcher(["/sign-in/tasks(.*)"]);
const clerkAuthorizedParties = [
  "https://www.spiritvalemods.com",
  "https://spiritvalemods.com",
  "https://clerk.spiritvalemods.com",
  "https://accounts.spiritvalemods.com",
  ...(process.env.NODE_ENV === "production"
    ? []
    : ["http://localhost:3000", "http://127.0.0.1:3000"]),
];

function apexToWww(request: Request) {
  const host = request.headers.get("host")?.split(":")[0];
  if (host !== "spiritvalemods.com") return null;
  const pathname = new URL(request.url).pathname;
  if (pathname.startsWith("/api/") || pathname.startsWith("/files/")) {
    return null;
  }
  const dest = new URL(request.url);
  dest.hostname = "www.spiritvalemods.com";
  dest.protocol = "https:";
  dest.port = "";
  return NextResponse.redirect(dest, 308);
}

export default clerkConfigured
  ? clerkMiddleware(
      async (auth, request) => {
        const redirected = apexToWww(request);
        if (redirected) return redirected;
        if (request.nextUrl.pathname.startsWith("/api/v1")) {
          return NextResponse.next();
        }
        const { sessionStatus } = await auth();
        if (sessionStatus === "pending" && !isSessionTaskRoute(request)) {
          if (
            isProtectedRoute(request) ||
            request.nextUrl.pathname.startsWith("/sign-in") ||
            request.nextUrl.pathname.startsWith("/sign-up")
          ) {
            const dest = request.nextUrl.clone();
            dest.pathname = "/sign-in/tasks";
            dest.search = "";
            return NextResponse.redirect(dest);
          }
        }
        if (isProtectedRoute(request)) {
          await auth.protect();
        }
      },
      { authorizedParties: clerkAuthorizedParties },
    )
  : function proxy(request: Request) {
      return apexToWww(request) ?? NextResponse.next();
    };

export const config = {
  matcher: [
    "/((?!_next|api/v1|api/upload/blob|files|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|exe|webmanifest)).*)",
    "/__clerk/(.*)",
  ],
};

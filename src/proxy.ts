import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

const isProtectedRoute = createRouteMatcher([
  "/upload(.*)",
  "/me(.*)",
  "/account(.*)",
  "/admin(.*)",
]);
const clerkConfigured = Boolean(process.env.CLERK_SECRET_KEY?.trim());
const isSessionTaskRoute = createRouteMatcher(["/sign-in/tasks(.*)"]);
const PUBLIC_HOST = "www.spiritvalemods.com";

function publicForwardedHost(request: NextRequest): string | null {
  const raw = (
    request.headers.get("x-forwarded-host") ||
    request.headers.get("host") ||
    ""
  )
    .split(",")[0]
    ?.trim()
    .split(":")[0];
  if (!raw || raw === "0.0.0.0" || raw === "web") {
    return PUBLIC_HOST;
  }
  if (raw === "localhost" || raw === "127.0.0.1") {
    return null;
  }
  if (raw === "spiritvalemods.com") return PUBLIC_HOST;
  return raw;
}

function withPublicForwardedHeaders(request: NextRequest): NextRequest {
  const headers = new Headers(request.headers);
  headers.set("x-forwarded-proto", "https");
  const host = publicForwardedHost(request);
  if (host) {
    headers.set("x-forwarded-host", host);
  }
  return new NextRequest(request, { headers });
}

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

const clerkHandler = clerkMiddleware(
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
  {
    signInUrl: "/sign-in",
    signUpUrl: "/sign-up",
  },
);

export default clerkConfigured
  ? function proxy(
      request: NextRequest,
      event: Parameters<typeof clerkHandler>[1],
    ) {
      const redirected = apexToWww(request);
      if (redirected) return redirected;
      return clerkHandler(withPublicForwardedHeaders(request), event);
    }
  : function proxy(request: Request) {
      return apexToWww(request) ?? NextResponse.next();
    };

export const config = {
  matcher: [
    "/((?!_next|api/v1|api/upload/blob|files|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|exe|webmanifest)).*)",
    "/__clerk/(.*)",
  ],
};

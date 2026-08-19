import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { CLERK_TASK_PATH } from "@/lib/clerk-options";

type DecorateUrl = (url: string) => string;

export { CLERK_TASK_PATH, CLERK_TASK_URLS, clerkAppearance } from "@/lib/clerk-options";

export function navigateAfterAuth(
  _router: AppRouterInstance,
  decorateUrl: DecorateUrl,
  path = "/upload",
  session?: { currentTask?: { key?: string } | null } | null,
) {
  // Full document loads let clerkMiddleware finish the handshake and set
  // `__session`. App Router client navigations skip that and bounce to sign-in.
  const dest = session?.currentTask?.key ? CLERK_TASK_PATH : path;
  window.location.assign(decorateUrl(dest));
}

export function statusOf(resource: { status: string }) {
  return resource.status;
}

export function clerkErrorText(error?: unknown): string | null {
  if (!error) return null;
  if (typeof error === "object") {
    const record = error as {
      longMessage?: string;
      message?: string;
      errors?: { longMessage?: string; message?: string }[];
    };
    if (record.longMessage || record.message) {
      return record.longMessage || record.message || null;
    }
    const first = record.errors?.[0];
    if (first?.longMessage || first?.message) {
      return first.longMessage || first.message || null;
    }
  }
  return error instanceof Error ? error.message : null;
}

"use client";

import {
  TaskChooseOrganization,
  TaskResetPassword,
  TaskSetupMFA,
  useSession,
} from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function SessionTasksPage() {
  const { isLoaded, session } = useSession();
  const router = useRouter();
  const task = session?.currentTask?.key;

  useEffect(() => {
    if (!isLoaded) return;
    if (!session) {
      router.replace("/sign-in");
      return;
    }
    if (!session.currentTask) {
      router.replace("/account");
    }
  }, [isLoaded, router, session]);

  if (!isLoaded) {
    return (
      <main className="flex min-h-[50vh] items-center justify-center px-6 py-12 text-sm text-[var(--muted)]">
        Loading…
      </main>
    );
  }

  return (
    <main className="flex min-h-[70vh] w-full items-center justify-center px-4 py-12 sm:px-6">
      <div className="panel w-full max-w-md p-5 sm:p-8">
        {task === "reset-password" ? (
          <TaskResetPassword redirectUrlComplete="/account" />
        ) : task === "setup-mfa" ? (
          <TaskSetupMFA redirectUrlComplete="/account" />
        ) : task === "choose-organization" ? (
          <TaskChooseOrganization redirectUrlComplete="/account" />
        ) : (
          <p className="text-sm text-[var(--muted)]">Finishing sign in…</p>
        )}
      </div>
    </main>
  );
}

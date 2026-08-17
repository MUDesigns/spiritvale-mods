"use client";

import { useClerk, useSignIn, useSignUp } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { navigateAfterAuth, statusOf } from "@/lib/clerk-ui";

export default function SsoCallbackPage() {
  const clerk = useClerk();
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();
  const router = useRouter();
  const started = useRef(false);

  useEffect(() => {
    void (async () => {
      if (!clerk.loaded || started.current) return;
      started.current = true;

      const finishSignIn = () =>
        signIn.finalize({
          navigate: ({ session, decorateUrl }) => {
            if (session?.currentTask) return;
            navigateAfterAuth(router, decorateUrl);
          },
        });
      const finishSignUp = () =>
        signUp.finalize({
          navigate: ({ session, decorateUrl }) => {
            if (session?.currentTask) return;
            navigateAfterAuth(router, decorateUrl);
          },
        });

      if (signIn.status === "complete") {
        await finishSignIn();
        return;
      }

      if (signUp.isTransferable) {
        await signIn.create({ transfer: true });
        if (statusOf(signIn) === "complete") {
          await finishSignIn();
          return;
        }
        router.push("/sign-in");
        return;
      }

      if (signIn.isTransferable) {
        await signUp.create({ transfer: true });
        if (statusOf(signUp) === "complete") {
          await finishSignUp();
          return;
        }
        router.push("/sign-up/continue");
        return;
      }

      if (signUp.status === "complete") {
        await finishSignUp();
        return;
      }

      const sessionId = signIn.existingSession?.sessionId || signUp.existingSession?.sessionId;
      if (sessionId) {
        await clerk.setActive({
          session: sessionId,
          navigate: ({ session, decorateUrl }) => {
            if (session?.currentTask) return;
            navigateAfterAuth(router, decorateUrl);
          },
        });
        return;
      }

      if (clerk.user) {
        router.push("/account");
        return;
      }

      router.push("/sign-in");
    })();
  }, [clerk, router, signIn, signUp]);

  return (
    <main className="flex min-h-[50vh] items-center justify-center px-6 py-12 text-sm text-[#9aa3b8]">
      Completing sign in…
      <div id="clerk-captcha" />
    </main>
  );
}

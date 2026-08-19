"use client";

import { useSignUp } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { clerkErrorText, navigateAfterAuth } from "@/lib/clerk-ui";

export default function SignUpContinuePage() {
  const router = useRouter();
  const { signUp, fetchStatus } = useSignUp();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const { error: updateError } = await signUp.update({ firstName, lastName });
    if (updateError) {
      setError(clerkErrorText(updateError));
      return;
    }
    if (signUp.status === "complete") {
      await signUp.finalize({
        navigate: ({ session, decorateUrl }) => {
          navigateAfterAuth(router, decorateUrl, "/upload", session);
        },
      });
      return;
    }
    setError("Additional details are still required. Try signing in with email instead.");
  }

  return (
    <main className="flex min-h-[70vh] w-full items-center justify-center px-4 py-12 sm:px-6">
        <div className="panel w-full max-w-md p-5 sm:p-8">
        <h1 className="text-2xl font-extrabold text-[#f4f7fb]">Finish creating your account</h1>
        <p className="mt-2 text-sm text-[#9aa3b8]">A couple more details and you’re in.</p>
        <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
          <label className="text-sm font-semibold text-[#f4f7fb]">
            First name
            <input
              className="field mt-1"
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              required
              autoComplete="given-name"
            />
          </label>
          <label className="text-sm font-semibold text-[#f4f7fb]">
            Last name
            <input
              className="field mt-1"
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              required
              autoComplete="family-name"
            />
          </label>
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
          <div id="clerk-captcha" />
          <button
            type="submit"
            disabled={fetchStatus === "fetching"}
            className="btn btn-primary"
          >
            Continue
          </button>
        </form>
      </div>
    </main>
  );
}

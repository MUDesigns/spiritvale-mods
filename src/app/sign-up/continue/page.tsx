"use client";

import { useClerk, useSignUp } from "@clerk/nextjs";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useMemo, useState } from "react";
import { USERNAME_MAX, USERNAME_MIN } from "@/lib/clerk-options";
import { clerkErrorText, navigateAfterAuth } from "@/lib/clerk-ui";

export default function SignUpContinuePage() {
  const router = useRouter();
  const { loaded } = useClerk();
  const { signUp, fetchStatus } = useSignUp();
  const [username, setUsername] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const missing = useMemo(
    () => new Set(signUp.missingFields),
    [signUp.missingFields],
  );
  const needUsername = missing.has("username");
  const needFirstName = missing.has("first_name");
  const needLastName = missing.has("last_name");

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const { error: updateError } = await signUp.update({
      ...(needUsername ? { username: username.trim() } : {}),
      ...(needFirstName ? { firstName: firstName.trim() } : {}),
      ...(needLastName ? { lastName: lastName.trim() } : {}),
    });
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
    if (signUp.status === "missing_requirements" && signUp.missingFields.length > 0) {
      setError("Additional details are still required.");
      return;
    }
    setError("Could not finish creating your account. Try signing in with email instead.");
  }

  if (!loaded) {
    return (
      <main className="flex min-h-[50vh] items-center justify-center px-6 py-12 text-sm text-[var(--muted)]">
        Loading…
      </main>
    );
  }

  return (
    <main className="flex min-h-[70vh] w-full items-center justify-center px-4 py-12 sm:px-6">
      <div className="panel w-full max-w-md p-5 sm:p-8">
        <h1 className="text-2xl font-extrabold text-[#f4f7fb]">Finish creating your account</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">A couple more details and you’re in.</p>
        <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
          {needUsername ? (
            <label className="text-sm font-semibold text-[#f4f7fb]">
              Username
              <input
                className="field mt-1"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                required
                minLength={USERNAME_MIN}
                maxLength={USERNAME_MAX}
                autoComplete="username"
                placeholder="Letters, numbers, and underscores"
              />
            </label>
          ) : null}
          {needFirstName ? (
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
          ) : null}
          {needLastName ? (
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
          ) : null}
          {!needUsername && !needFirstName && !needLastName ? (
            <p className="text-sm text-[var(--muted)]">
              This sign-up is no longer active.{" "}
              <Link href="/sign-up" className="font-bold text-[var(--blue)]">
                Start again
              </Link>
              .
            </p>
          ) : null}
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
          <div id="clerk-captcha" />
          {needUsername || needFirstName || needLastName ? (
            <button
              type="submit"
              disabled={fetchStatus === "fetching"}
              className="btn btn-primary"
            >
              Continue
            </button>
          ) : null}
        </form>
      </div>
    </main>
  );
}

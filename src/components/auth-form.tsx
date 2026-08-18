"use client";

import { useSignIn, useSignUp } from "@clerk/nextjs";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { clerkErrorText, navigateAfterAuth, statusOf } from "@/lib/clerk-ui";

type Mode = "sign-in" | "sign-up";
type OAuthStrategy = "oauth_google" | "oauth_discord";

const fieldClass = "field mt-1";

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const { signIn, fetchStatus: signInStatus } = useSignIn();
  const { signUp, fetchStatus: signUpStatus } = useSignUp();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const verifyingSignUp =
    signUp.status === "missing_requirements" &&
    signUp.unverifiedFields.includes("email_address") &&
    signUp.missingFields.length === 0;
  const verifyingSignIn =
    signIn.status === "needs_client_trust" || signIn.status === "needs_second_factor";
  const verifying = verifyingSignUp || verifyingSignIn;
  const busy = signInStatus === "fetching" || signUpStatus === "fetching";

  async function oauth(strategy: OAuthStrategy) {
    setError(null);
    const target = mode === "sign-up" ? signUp : signIn;
    const { error: oauthError } = await target.sso({
      strategy,
      redirectCallbackUrl: "/sso-callback",
      redirectUrl: "/upload",
    });
    setError(clerkErrorText(oauthError));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (mode === "sign-in") {
      if (verifyingSignIn) {
        const { error: verifyError } = await signIn.mfa.verifyEmailCode({ code });
        if (verifyError) {
          setError(clerkErrorText(verifyError));
          return;
        }
      } else {
        const { error: passwordError } = await signIn.password({
          emailAddress: email,
          password,
        });
        if (passwordError) {
          setError(clerkErrorText(passwordError));
          return;
        }
        if (statusOf(signIn) === "needs_client_trust") {
          await signIn.mfa.sendEmailCode();
          return;
        }
      }

      if (statusOf(signIn) === "complete") {
        await signIn.finalize({
          navigate: ({ session, decorateUrl }) => {
            if (session?.currentTask) return;
            navigateAfterAuth(router, decorateUrl);
          },
        });
        return;
      }
      if (statusOf(signIn) === "needs_second_factor" || statusOf(signIn) === "needs_client_trust") {
        return;
      }
      setError("Could not finish sign in. Try Google or Discord.");
      return;
    }

    if (verifyingSignUp) {
      const { error: verifyError } = await signUp.verifications.verifyEmailCode({ code });
      if (verifyError) {
        setError(clerkErrorText(verifyError));
        return;
      }
    } else {
      const { error: passwordError } = await signUp.password({
        emailAddress: email,
        password,
      });
      if (passwordError) {
        setError(clerkErrorText(passwordError));
        return;
      }
      if (signUp.status !== "complete") {
        await signUp.verifications.sendEmailCode();
        return;
      }
    }

    if (signUp.status === "complete") {
      await signUp.finalize({
        navigate: ({ session, decorateUrl }) => {
          if (session?.currentTask) return;
          navigateAfterAuth(router, decorateUrl);
        },
      });
      return;
    }
    if (signUp.status === "missing_requirements" && signUp.missingFields.length > 0) {
      router.push("/sign-up/continue");
    }
  }

  const title = mode === "sign-in" ? "Sign in" : "Create an account";
  const subtitle =
    mode === "sign-in"
      ? "Use email and password, Google, or Discord."
      : "Upload mods after a virus scan. Google, Discord, or email.";

  return (
    <div className="panel w-full max-w-md p-8">
      <h1 className="text-2xl font-extrabold text-[#f4f7fb]">{title}</h1>
      <p className="mt-2 text-sm text-[#9aa3b8]">{subtitle}</p>

      {!verifying ? (
        <div className="mt-6 flex flex-col gap-3">
          <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => oauth("oauth_google")}>
            Continue with Google
          </button>
          <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => oauth("oauth_discord")}>
            Continue with Discord
          </button>
        </div>
      ) : null}

      {!verifying ? (
        <div className="my-5 flex items-center gap-3 text-xs font-semibold tracking-wide text-[#9aa3b8] uppercase">
          <span className="h-px flex-1 bg-white/10" />
          or email
          <span className="h-px flex-1 bg-white/10" />
        </div>
      ) : (
        <p className="mt-6 text-sm text-[#9aa3b8]">Enter the code we sent to your email.</p>
      )}

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        {verifying ? (
          <label className="text-sm font-semibold text-[#f4f7fb]">
            Verification code
            <input
              className={fieldClass}
              value={code}
              onChange={(event) => setCode(event.target.value)}
              required
              inputMode="numeric"
              autoComplete="one-time-code"
            />
          </label>
        ) : (
          <>
            <label className="text-sm font-semibold text-[#f4f7fb]">
              Email
              <input
                className={fieldClass}
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                autoComplete="email"
              />
            </label>
            <label className="text-sm font-semibold text-[#f4f7fb]">
              Password
              <input
                className={fieldClass}
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={8}
                autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
              />
            </label>
          </>
        )}
        {error ? <p className="text-sm text-red-400">{error}</p> : null}
        {mode === "sign-up" ? <div id="clerk-captcha" /> : null}
        <button
          type="submit"
          disabled={busy}
          className="btn btn-primary"
        >
          {busy
            ? "Please wait…"
            : verifying
              ? "Verify email"
              : mode === "sign-in"
                ? "Sign in"
                : "Create account"}
        </button>
      </form>

      <p className="mt-6 text-sm text-[#9aa3b8]">
        {mode === "sign-in" ? (
          <>
            Need an account?{" "}
            <Link href="/sign-up" className="font-bold text-[#55b7ea]">
              Sign up
            </Link>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <Link href="/sign-in" className="font-bold text-[#55b7ea]">
              Sign in
            </Link>
          </>
        )}
      </p>
    </div>
  );
}

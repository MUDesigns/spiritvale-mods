"use client";

import { useClerk, useUser } from "@clerk/nextjs";
import Link from "next/link";

export function SiteHeader({
  clerkEnabled,
  isAdmin = false,
}: {
  clerkEnabled: boolean;
  isAdmin?: boolean;
}) {
  return (
    <nav className="border-b border-[var(--line)] bg-[#171b28]">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
        <Link href="/" className="flex items-center gap-3">
          <img
            src="/ui/icon-shop.png"
            alt="SpiritVale"
            width={42}
            height={42}
            className="drop-shadow-[0_4px_10px_rgba(0,0,0,0.45)]"
          />
          <span>
            <span className="block text-[1.35rem] leading-none font-extrabold tracking-[-0.02em]">
              SpiritVale
            </span>
            <span className="mt-1 block text-[0.72rem] font-bold tracking-[0.12em] text-[#9aa3b8] uppercase">
              Mods catalog
            </span>
          </span>
        </Link>
        {clerkEnabled ? (
          <AuthLinks isAdmin={isAdmin} />
        ) : (
          <p className="text-xs text-[#9aa3b8]">Sign in coming online shortly</p>
        )}
      </div>
    </nav>
  );
}

function AuthLinks({ isAdmin }: { isAdmin: boolean }) {
  const { isSignedIn, isLoaded, user } = useUser();
  const { signOut } = useClerk();
  if (!isLoaded) {
    return <div className="h-8 w-24" />;
  }
  if (isSignedIn) {
    const label =
      (typeof user.unsafeMetadata.displayName === "string" &&
        user.unsafeMetadata.displayName) ||
      user.primaryEmailAddress?.emailAddress ||
      "Account";
    return (
      <div className="flex items-center gap-3 text-sm">
        <Link href="/upload" className="btn btn-primary">
          Upload
        </Link>
        <Link href="/me" className="font-extrabold text-[#9aa3b8] hover:text-white">
          My mods
        </Link>
        {isAdmin ? (
          <Link href="/admin" className="font-extrabold text-[#f0c14a] hover:text-white">
            Admin
          </Link>
        ) : null}
        <Link
          href="/account"
          className="max-w-[12rem] truncate font-extrabold text-[#55b7ea]"
        >
          {label}
        </Link>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => signOut({ redirectUrl: "/" })}
        >
          Sign out
        </button>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3 text-sm">
      <Link href="/sign-in" className="btn btn-secondary">
        Sign in
      </Link>
      <Link href="/sign-up" className="btn btn-primary">
        Sign up
      </Link>
    </div>
  );
}

"use client";

import { useClerk, useUser } from "@clerk/nextjs";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export function SiteHeader({
  clerkEnabled,
  isAdmin = false,
}: {
  clerkEnabled: boolean;
  isAdmin?: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  return (
    <nav className="site-header">
      <div className="site-header-inner">
        <Link href="/" className="site-brand" onClick={() => setMenuOpen(false)}>
          <img
            src="/ui/icon-shop.png"
            alt="SpiritVale"
            width={42}
            height={42}
            className="drop-shadow-[0_4px_10px_rgba(0,0,0,0.45)]"
          />
          <span className="min-w-0">
            <span className="block text-[1.2rem] leading-none font-extrabold tracking-[-0.02em] sm:text-[1.35rem]">
              SpiritVale
            </span>
            <span className="mt-1 block text-[0.72rem] font-bold tracking-[0.12em] text-[#9aa3b8] uppercase">
              Mods catalog
            </span>
          </span>
        </Link>
        {clerkEnabled ? (
          <>
            <button
              type="button"
              className="nav-toggle"
              aria-expanded={menuOpen}
              aria-controls="site-menu"
              onClick={() => setMenuOpen((open) => !open)}
            >
              {menuOpen ? "Close" : "Menu"}
            </button>
            <AuthLinks isAdmin={isAdmin} open={menuOpen} />
          </>
        ) : (
          <p className="max-w-[10rem] text-right text-xs text-[#9aa3b8]">
            Sign in coming online shortly
          </p>
        )}
      </div>
    </nav>
  );
}

function AuthLinks({ isAdmin, open }: { isAdmin: boolean; open: boolean }) {
  const { isSignedIn, isLoaded, user } = useUser();
  const { signOut } = useClerk();
  if (!isLoaded) {
    return <div className="hidden h-8 w-24 md:block" />;
  }
  if (isSignedIn) {
    const label =
      (typeof user.unsafeMetadata.displayName === "string" &&
        user.unsafeMetadata.displayName) ||
      user.primaryEmailAddress?.emailAddress ||
      "Account";
    return (
      <div id="site-menu" className={`site-menu${open ? " is-open" : ""}`}>
        <Link href="/upload" className="btn btn-primary">
          Upload
        </Link>
        <Link href="/me" className="site-menu-link">
          My mods
        </Link>
        {isAdmin ? (
          <Link href="/admin" className="site-menu-link site-menu-link-admin">
            Admin
          </Link>
        ) : null}
        <Link href="/account" className="site-menu-link site-menu-link-account">
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
    <div className="site-menu-auth">
      <Link href="/sign-in" className="btn btn-secondary">
        Sign in
      </Link>
      <Link href="/sign-up" className="btn btn-primary">
        Sign up
      </Link>
    </div>
  );
}

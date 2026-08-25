"use client";

import { useClerk, useUser } from "@clerk/nextjs";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";

export function SiteHeader({
  clerkEnabled,
  isAdmin = false,
  catalogPaused = false,
}: {
  clerkEnabled: boolean;
  isAdmin?: boolean;
  catalogPaused?: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  return (
    <nav className="site-header">
      <div className="site-header-inner">
        <div className="site-header-start">
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
                {catalogPaused ? "Catalog paused" : "Mods catalog"}
              </span>
            </span>
          </Link>
          <Link
            href="/mods"
            className={`site-nav-link${pathname === "/mods" || pathname.startsWith("/mods/") ? " is-active" : ""}`}
            onClick={() => setMenuOpen(false)}
          >
            Mods
          </Link>
          {!catalogPaused ? (
            <Link
              href="/upload"
              prefetch={false}
              className={`site-nav-link${pathname === "/upload" ? " is-active" : ""}`}
              onClick={() => setMenuOpen(false)}
            >
              Upload
            </Link>
          ) : null}
        </div>
        {clerkEnabled ? (
          <button
            type="button"
            className="nav-toggle"
            aria-expanded={menuOpen}
            aria-controls="site-menu"
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? "Close" : "Menu"}
          </button>
        ) : null}
        {catalogPaused ? null : (
          <Suspense fallback={<div className="site-header-search" />}>
            <ModsSearch />
          </Suspense>
        )}
        {clerkEnabled ? (
          <AuthLinks isAdmin={isAdmin} open={menuOpen} />
        ) : (
          <p className="site-header-notice">
            Sign in coming online shortly
          </p>
        )}
      </div>
    </nav>
  );
}

function ModsSearch() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlQuery = pathname === "/mods" ? (searchParams.get("q") ?? "") : "";
  const [value, setValue] = useState(urlQuery);
  const onCatalog = pathname === "/mods";

  useEffect(() => {
    setValue(urlQuery);
  }, [urlQuery]);

  useEffect(() => {
    if (!onCatalog) return;
    const handle = window.setTimeout(() => {
      const next = value.trim();
      const current = urlQuery.trim();
      if (next === current) return;
      const href = next ? `/mods?q=${encodeURIComponent(next)}` : "/mods";
      router.replace(href, { scroll: false });
    }, 200);
    return () => window.clearTimeout(handle);
  }, [onCatalog, router, urlQuery, value]);

  return (
    <form className="site-header-search" action="/mods" method="get" role="search">
      <label className="sr-only" htmlFor="site-mod-search">
        Search mods
      </label>
      <span className="search-field">
        <img src="/ui/icon-search.png" alt="" width={16} height={16} />
        <input
          id="site-mod-search"
          name="q"
          placeholder="Search mods…"
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
      </span>
    </form>
  );
}

function AuthLinks({ isAdmin, open }: { isAdmin: boolean; open: boolean }) {
  const { isSignedIn, isLoaded, user } = useUser();
  const { signOut } = useClerk();
  if (!isLoaded) {
    return <div className="site-header-end hidden h-8 w-24 md:flex" />;
  }
  if (isSignedIn) {
    const label =
      (typeof user.unsafeMetadata.displayName === "string" &&
        user.unsafeMetadata.displayName) ||
      user.username ||
      user.primaryEmailAddress?.emailAddress ||
      "Profile";
    return (
      <div id="site-menu" className={`site-header-end site-menu${open ? " is-open" : ""}`}>
        <button
          type="button"
          className="site-nav-link site-nav-text"
          onClick={() => signOut({ redirectUrl: "/" })}
        >
          Sign out
        </button>
        <ProfileMenu label={label} isAdmin={isAdmin} />
      </div>
    );
  }
  return (
    <div id="site-menu" className={`site-header-end site-menu${open ? " is-open" : ""}`}>
      <Link href="/sign-in" className="site-nav-link">
        Sign in
      </Link>
      <Link href="/sign-up" className="site-nav-link">
        Sign up
      </Link>
    </div>
  );
}

function ProfileMenu({ label, isAdmin }: { label: string; isAdmin: boolean }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="site-nav-dropdown" ref={wrapRef}>
      <button
        type="button"
        className={`site-nav-link site-nav-text${open ? " is-active" : ""}`}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={label === "Profile" ? "Profile" : `Profile, ${label}`}
        onClick={() => setOpen((value) => !value)}
      >
        Profile
        <span className="site-nav-caret" aria-hidden="true" />
      </button>
      {open ? (
        <div className="site-nav-dropdown-menu" role="menu">
          <Link
            href="/account"
            prefetch={false}
            role="menuitem"
            className="site-nav-dropdown-item"
            onClick={() => setOpen(false)}
          >
            Account
          </Link>
          <Link
            href="/me"
            prefetch={false}
            role="menuitem"
            className="site-nav-dropdown-item"
            onClick={() => setOpen(false)}
          >
            My Uploads
          </Link>
          {isAdmin ? (
            <Link
              href="/admin"
              prefetch={false}
              role="menuitem"
              className="site-nav-dropdown-item site-nav-dropdown-item-admin"
              onClick={() => setOpen(false)}
            >
              Admin
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

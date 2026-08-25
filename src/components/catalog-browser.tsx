"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  catalogDisplayTitle,
  excerpt,
  formatBytes,
  formatCompactCount,
  formatDate,
  formatRelativeTime,
} from "@/lib/format";
import type { CatalogSort, PublicModPage, PublicModSummary } from "@/lib/types";
import { InstallWithManagerButton } from "@/components/install-with-manager";

const SORTS: { value: CatalogSort; label: string }[] = [
  { value: "newest", label: "New" },
  { value: "downloads", label: "Popular" },
  { value: "name", label: "Name" },
  { value: "oldest", label: "Oldest" },
  { value: "size", label: "Largest" },
];

export function CatalogBrowser({
  initial,
  initialQuery = "",
}: {
  initial: PublicModPage;
  initialQuery?: string;
}) {
  const query = initialQuery;
  const [sort, setSort] = useState<CatalogSort>("newest");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initial.pageSize);
  const [data, setData] = useState(initial);
  const [busy, setBusy] = useState(false);

  const skipFirst = useRef(true);
  const [prevQuery, setPrevQuery] = useState(query);
  if (query !== prevQuery) {
    setPrevQuery(query);
    setPage(1);
  }

  const pageCount = Math.max(1, Math.ceil(data.total / data.pageSize));
  const showing = useMemo(() => {
    if (data.total === 0) return "0 mods";
    const start = (data.page - 1) * data.pageSize + 1;
    const end = Math.min(data.total, data.page * data.pageSize);
    return `${start}–${end} of ${data.total}`;
  }, [data]);

  const load = useCallback(
    async (next: { q: string; sort: CatalogSort; page: number; pageSize: number }) => {
      setBusy(true);
      const params = new URLSearchParams({
        q: next.q,
        sort: next.sort,
        page: String(next.page),
        pageSize: String(next.pageSize),
      });
      const response = await fetch(`/api/mods?${params.toString()}`);
      const json = (await response.json()) as PublicModPage;
      setData(json);
      setBusy(false);
    },
    [],
  );

  useEffect(() => {
    if (skipFirst.current) {
      skipFirst.current = false;
      return;
    }
    const handle = window.setTimeout(() => {
      void load({ q: query.trim(), sort, page, pageSize });
    }, 200);
    return () => window.clearTimeout(handle);
  }, [load, page, pageSize, query, sort]);

  return (
    <section className="flex flex-col gap-4">
      <div className="catalog-toolbar">
        <div className="catalog-sorts" role="group" aria-label="Sort mods">
          {SORTS.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={sort === option.value}
              className={`catalog-sort${sort === option.value ? " is-active" : ""}`}
              onClick={() => {
                setSort(option.value);
                setPage(1);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
        <label className="catalog-toolbar-field">
          Per page
          <select
            className="field"
            value={pageSize}
            onChange={(event) => {
              setPageSize(Number(event.target.value));
              setPage(1);
            }}
          >
            <option value="20">20</option>
            <option value="24">24</option>
            <option value="50">50</option>
          </select>
        </label>
      </div>

      {data.mods.length === 0 ? (
        <div className="panel flex min-h-[180px] flex-col items-center justify-center px-6 py-10 text-center">
          <p className="text-lg font-extrabold">
            {query.trim() ? "No matching mods" : "No mods in the catalog yet"}
          </p>
          <p className="mt-2 text-sm text-[var(--muted)]">
            {query.trim()
              ? "Try a different search term."
              : "Sign in to upload a zip, or use SpiritVale Mod Publisher."}
          </p>
        </div>
      ) : (
        <ul className="catalog-grid">
          {data.mods.map((mod) => (
            <li key={mod.id}>
              <CatalogModCard mod={mod} />
            </li>
          ))}
        </ul>
      )}

      <div className="catalog-pager text-sm text-[var(--muted)]">
        <p>{busy ? "Updating…" : showing}</p>
        <div className="catalog-pager-buttons">
          <button
            type="button"
            className="btn btn-secondary"
            disabled={page <= 1}
            onClick={() => setPage((value) => Math.max(1, value - 1))}
          >
            Previous
          </button>
          <span className="px-2 font-extrabold">
            Page {data.page} of {pageCount}
          </span>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={page >= pageCount}
            onClick={() => setPage((value) => value + 1)}
          >
            Next
          </button>
        </div>
      </div>
    </section>
  );
}

function CatalogModCard({ mod }: { mod: PublicModSummary }) {
  const title = catalogDisplayTitle(mod.name, mod.filename);
  return (
    <article className="nexus-card">
      <Link href={`/mods/${mod.id}`} className="nexus-card-cover">
        {mod.thumbnailUrl ? (
          <img src={mod.thumbnailUrl} alt="" />
        ) : (
          <span className="featured-cover-empty" aria-hidden />
        )}
      </Link>
      <div className="nexus-card-body">
        <Link href={`/mods/${mod.id}`} className="nexus-card-title">
          {title}
        </Link>
        <p className="nexus-card-author">{mod.author || "Unknown author"}</p>
        <p className="nexus-card-meta">
          <span>v{mod.latestVersion}</span>
          <span>{formatRelativeTime(mod.publishedAt)}</span>
          <span>{formatDate(mod.publishedAt)}</span>
        </p>
        {mod.description ? (
          <p className="nexus-card-excerpt">{excerpt(mod.description, 140)}</p>
        ) : null}
      </div>
      <div className="nexus-card-footer">
        <span title={`${formatCompactCount(mod.downloadCount)} downloads`}>
          {formatCompactCount(mod.downloadCount)} dl
        </span>
        <span>{formatBytes(mod.sizeBytes)}</span>
        <InstallWithManagerButton id={mod.id} compact className="nexus-card-link" />
        <a className="nexus-card-link" href={mod.downloadUrl}>
          Zip
        </a>
      </div>
    </article>
  );
}

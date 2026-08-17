"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { excerpt, formatBytes, formatDate } from "@/lib/format";
import type { CatalogSort, PublicModPage } from "@/lib/types";
import { InstallWithManagerButton } from "@/components/install-with-manager";

const SORTS: { value: CatalogSort; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "name", label: "Name" },
  { value: "oldest", label: "Oldest" },
  { value: "size", label: "Largest" },
];

export function CatalogBrowser({ initial }: { initial: PublicModPage }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<CatalogSort>("newest");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initial.pageSize);
  const [data, setData] = useState(initial);
  const [busy, setBusy] = useState(false);

  const skipFirst = useRef(true);

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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="section-title text-xl">Mods</h2>
        <p className="rounded-full border border-[var(--line-strong)] bg-[rgba(20,24,34,0.85)] px-3 py-1 text-xs font-extrabold tracking-wide text-[#bfe8fb] uppercase">
          {data.total} listed
        </p>
      </div>

      <div className="catalog-toolbar">
        <label className="catalog-toolbar-field search">
          Search
          <span className="search-field">
            <img src="/ui/icon-search.png" alt="" width={16} height={16} />
            <input
              placeholder="Search mods…"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
            />
          </span>
        </label>
        <label className="catalog-toolbar-field">
          Sort
          <select
            className="field"
            value={sort}
            onChange={(event) => {
              setSort(event.target.value as CatalogSort);
              setPage(1);
            }}
          >
            {SORTS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
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
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
        </label>
      </div>

      {data.mods.length === 0 ? (
        <div className="panel flex min-h-[180px] flex-col items-center justify-center px-6 py-10 text-center">
          <p className="text-lg font-extrabold">
            {query.trim() ? "No matching mods" : "No mods in the catalog yet"}
          </p>
          <p className="mt-2 text-sm text-[#9aa3b8]">
            {query.trim()
              ? "Try a different search term."
              : "Sign in to upload a zip, or use SpiritVale Mod Publisher."}
          </p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="catalog-table">
            <thead>
              <tr>
                <th>Mod</th>
                <th className="hidden sm:table-cell">Version</th>
                <th className="hidden md:table-cell">Size</th>
                <th className="hidden lg:table-cell">Updated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.mods.map((mod) => (
                <tr key={mod.id} className="catalog-row">
                  <td>
                    <div className="catalog-mod-cell">
                      {mod.thumbnailUrl ? (
                        <img
                          className="mod-thumb"
                          src={mod.thumbnailUrl}
                          alt=""
                          width={40}
                          height={40}
                        />
                      ) : (
                        <span className="mod-thumb mod-thumb-empty" aria-hidden />
                      )}
                      <div className="min-w-0">
                        <Link href={`/mods/${mod.id}`} className="font-extrabold hover:text-[#55b7ea]">
                          {mod.name}
                        </Link>
                        <p className="mt-0.5 font-mono text-xs text-[#9aa3b8]">{mod.id}</p>
                        {mod.description ? (
                          <p className="catalog-mod-excerpt mt-1 text-sm text-[#9aa3b8]">
                            {excerpt(mod.description, 90)}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </td>
                  <td className="hidden whitespace-nowrap sm:table-cell">v{mod.latestVersion}</td>
                  <td className="hidden whitespace-nowrap md:table-cell">
                    {formatBytes(mod.sizeBytes)}
                  </td>
                  <td className="hidden whitespace-nowrap lg:table-cell">
                    {formatDate(mod.publishedAt)}
                  </td>
                  <td className="catalog-actions">
                    <InstallWithManagerButton id={mod.id} compact />
                    <a className="btn btn-secondary btn-compact" href={mod.downloadUrl}>
                      Download
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-[#9aa3b8]">
        <p>{busy ? "Updating…" : showing}</p>
        <div className="flex items-center gap-2">
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

import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { CatalogPauseNotice } from "@/components/catalog-pause-notice";
import { loadModForViewer } from "@/lib/catalog";
import { isCatalogPaused } from "@/lib/catalog-pause";
import { catalogDisplayTitle, formatBytes, formatDate, formatDownloads } from "@/lib/format";
import { InstallWithManagerButton } from "@/components/install-with-manager";
import { ModGallery } from "@/components/mod-gallery";
import { isCatalogId } from "@/lib/ids";
import { publicMod } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ModPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isCatalogId(id)) notFound();

  if (isCatalogPaused()) {
    return (
      <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
        <Link href="/" className="text-sm font-extrabold text-[var(--blue)]">
          ← Back to home
        </Link>
        <CatalogPauseNotice compact />
      </main>
    );
  }

  const { userId } = await auth();
  const viewed = await loadModForViewer(id, userId);
  if (!viewed) notFound();
  const mod = publicMod(viewed.mod);

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
      <Link href="/mods" className="text-sm font-extrabold text-[var(--blue)]">
        ← Back to catalog
      </Link>
      {viewed.hidden ? (
        <p className="rounded-xl border border-[#c9a227]/40 bg-[rgba(40,32,12,0.55)] px-4 py-3 text-sm text-[#e6c35c]">
          This listing is hidden from the public catalog. Only you and catalog
          admins can open it.
        </p>
      ) : null}
      <section className="panel p-4 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <div className="flex min-w-0 items-start gap-3">
            {mod.thumbnailUrl ? (
              <img
                className="mod-thumb mod-thumb-lg"
                src={mod.thumbnailUrl}
                alt=""
                width={72}
                height={72}
              />
            ) : null}
            <div className="min-w-0">
              <p className="font-mono text-xs text-[var(--muted)]">{mod.id}</p>
              <h1 className="mt-1 text-2xl font-extrabold sm:text-3xl">
                {catalogDisplayTitle(mod.name, mod.filename)}
              </h1>
              <p className="mt-2 text-sm text-[var(--muted)]">
                {mod.author ? `${mod.author} · ` : ""}
                v{mod.latestVersion} · {formatBytes(mod.sizeBytes)} ·{" "}
                {formatDownloads(mod.downloadCount)} · Updated {formatDate(mod.publishedAt)}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
            {!viewed.hidden ? <InstallWithManagerButton id={mod.id} /> : null}
            <a className="btn btn-secondary" href={mod.downloadUrl}>
              Download zip
            </a>
          </div>
        </div>
        {mod.description ? (
          <p className="mt-5 max-w-3xl whitespace-pre-wrap text-[#f4f7fb]">
            {mod.description}
          </p>
        ) : (
          <p className="mt-5 text-sm text-[var(--muted)]">No description yet.</p>
        )}
        {!viewed.hidden ? (
          <p className="mt-4 text-xs text-[var(--muted)]">
            Install with Plugin Manager requires{" "}
            <a href="/" className="font-bold text-[var(--blue)] hover:underline">
              SpiritVale Plugin Manager
            </a>
            . Your browser will ask to open the app, then the zip is added to your
            library.
          </p>
        ) : null}
        <ModGallery images={mod.images} name={mod.name} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="section-title text-xl">Files</h2>
        <div className="table-wrap">
          <table className="catalog-table files-table">
            <thead>
              <tr>
                <th>Version</th>
                <th>Size</th>
                <th>Published</th>
                <th>Changelog</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(mod.versions.length ? mod.versions : [
                {
                  version: mod.latestVersion,
                  changelog: mod.changelog,
                  filename: mod.filename,
                  sha256: mod.sha256,
                  sizeBytes: mod.sizeBytes,
                  downloadUrl: mod.downloadUrl,
                  publishedAt: mod.publishedAt,
                },
              ]).map((entry) => (
                <tr key={entry.version} className="catalog-row">
                  <td data-label="Version" className="font-extrabold">
                    v{entry.version}
                  </td>
                  <td data-label="Size">{formatBytes(entry.sizeBytes)}</td>
                  <td data-label="Published">{formatDate(entry.publishedAt)}</td>
                  <td data-label="Changelog" className="max-w-xl text-sm text-[var(--muted)]">
                    {entry.changelog || "—"}
                  </td>
                  <td>
                    <a className="btn btn-secondary" href={entry.downloadUrl}>
                      Download
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

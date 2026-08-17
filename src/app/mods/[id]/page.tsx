import Link from "next/link";
import { notFound } from "next/navigation";
import { loadCatalog } from "@/lib/catalog";
import { formatBytes, formatDate, formatDownloads } from "@/lib/format";
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
  const catalog = await loadCatalog();
  const raw = catalog.mods[id];
  if (!raw) notFound();
  const mod = publicMod(raw);

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10">
      <Link href="/" className="text-sm font-extrabold text-[#55b7ea]">
        ← Back to catalog
      </Link>
      <section className="panel p-6">
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
              <p className="font-mono text-xs text-[#9aa3b8]">{mod.id}</p>
              <h1 className="mt-1 text-3xl font-extrabold">{mod.name}</h1>
              <p className="mt-2 text-sm text-[#9aa3b8]">
                v{mod.latestVersion} · {formatBytes(mod.sizeBytes)} ·{" "}
                {formatDownloads(mod.downloadCount)} · Updated {formatDate(mod.publishedAt)}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
            <InstallWithManagerButton id={mod.id} />
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
          <p className="mt-5 text-sm text-[#9aa3b8]">No description yet.</p>
        )}
        <p className="mt-4 text-xs text-[#9aa3b8]">
          Install with Mod Manager requires{" "}
          <a href="/" className="font-bold text-[#55b7ea] hover:underline">
            SpiritVale Mod Manager 0.1.4 or later
          </a>
          . Your browser will ask to open the app, then the zip is added to your
          library.
        </p>
        <ModGallery images={mod.images} name={mod.name} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="section-title text-xl">Files</h2>
        <div className="table-wrap">
          <table className="catalog-table">
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
                  <td className="font-extrabold">v{entry.version}</td>
                  <td>{formatBytes(entry.sizeBytes)}</td>
                  <td>{formatDate(entry.publishedAt)}</td>
                  <td className="max-w-xl text-sm text-[#9aa3b8]">
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

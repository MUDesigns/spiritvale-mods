import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CatalogPauseNotice } from "@/components/catalog-pause-notice";
import { ModImagesPanel } from "@/components/mod-images-panel";
import { ModMetaForm } from "@/components/mod-meta-form";
import { DeleteModButton, DeleteVersionButton, HideModButton } from "@/components/mod-owner-controls";
import { isCatalogPaused } from "@/lib/catalog-pause";
import { hasDatabase, listImagesByModIds, listUserMods } from "@/lib/catalog";
import {
  formatBytes,
  formatDate,
  versionStatusClass,
  versionStatusLabel,
} from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function MePage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  if (!hasDatabase()) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-10">
        <p className="text-[#9aa3b8]">Database is not configured yet.</p>
      </main>
    );
  }

  const paused = isCatalogPaused();
  const { owned, versions } = await listUserMods(userId);
  const imagesByMod = await listImagesByModIds(owned.map((mod) => mod.id));

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
      <div>
        <h1 className="text-2xl font-extrabold">My mods</h1>
        <p className="mt-2 text-sm text-[#9aa3b8]">
          {paused
            ? "The public catalog and new uploads are paused. Your private listings below are still visible to you only."
            : "Live files appear on the public catalog unless you hide them. Scanning and quarantined uploads are only visible here. You can hide/unhide a listing, edit its description, remove an older file, delete a listing, or add screenshots and pick a thumbnail."}
        </p>
      </div>

      {paused ? <CatalogPauseNotice compact /> : null}

      {owned.length === 0 && versions.length === 0 ? (
        <p className="text-[#9aa3b8]">You have not uploaded any mods yet.</p>
      ) : null}

      {owned.map((mod) => {
        const rows = versions.filter((row) => row.modId === mod.id);
        const latestLive = rows.find((row) => row.status === "live")?.version;
        const imageList = imagesByMod.get(mod.id) ?? {
          thumbnailImageId: null,
          images: [],
        };
        const thumbUrl =
          imageList.images.find((image) => image.id === imageList.thumbnailImageId)?.url ??
          imageList.images[0]?.url;
        return (
          <section key={mod.id} className="panel p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                {thumbUrl ? (
                  <img className="mod-thumb" src={thumbUrl} alt="" width={40} height={40} />
                ) : null}
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/mods/${mod.id}`}
                      className="text-xl font-extrabold hover:text-[#55b7ea]"
                    >
                      {mod.name}
                    </Link>
                    {mod.hidden ? (
                      <span className="rounded-full border border-[#c9a227]/40 bg-[rgba(40,32,12,0.55)] px-2 py-0.5 text-[0.68rem] font-extrabold tracking-wide text-[#e6c35c] uppercase">
                        Hidden
                      </span>
                    ) : null}
                  </div>
                  <p className="font-mono text-xs text-[#9aa3b8]">{mod.id}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {!paused ? (
                  <Link href="/upload" className="btn btn-secondary">
                    Upload new version
                  </Link>
                ) : null}
                <HideModButton id={mod.id} name={mod.name} hidden={Boolean(mod.hidden)} />
                <DeleteModButton id={mod.id} name={mod.name} />
              </div>
            </div>
            <ModMetaForm
              id={mod.id}
              name={mod.name}
              description={mod.description ?? ""}
            />
            <ModImagesPanel id={mod.id} initial={imageList} />
            {rows.length > 0 ? (
              <ul className="mt-5 flex flex-col gap-3">
                {rows.map((row) => (
                  <li
                    key={row.id}
                    className="rounded-xl border border-[var(--line)] px-4 py-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-extrabold">
                          v{row.version} · {row.filename}
                        </p>
                        <span className={`text-sm font-extrabold ${versionStatusClass(row.status)}`}>
                          {versionStatusLabel(row.status)}
                        </span>
                      </div>
                      <DeleteVersionButton
                        id={mod.id}
                        version={row.version}
                        filename={row.filename}
                        isLatestLive={row.version === latestLive}
                        remainingCount={rows.length}
                      />
                    </div>
                    <p className="mt-1 text-sm text-[#9aa3b8]">
                      {formatBytes(row.sizeBytes)} · {formatDate(row.publishedAt)}
                    </p>
                    {row.changelog ? (
                      <p className="mt-2 text-sm text-[#9aa3b8]">{row.changelog}</p>
                    ) : null}
                    {row.scanSummary ? (
                      <p className="mt-2 text-sm text-[#9aa3b8]">{row.scanSummary}</p>
                    ) : null}
                    {row.status === "live" ? (
                      <a className="mt-2 inline-block text-sm font-extrabold text-[#55b7ea]" href={row.downloadUrl}>
                        Download
                      </a>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        );
      })}

      {versions.filter((row) => !owned.some((mod) => mod.id === row.modId)).length > 0 ? (
        <section>
          <h2 className="mb-3 text-lg font-extrabold">Other uploads</h2>
          <ul className="grid gap-3">
            {versions
              .filter((row) => !owned.some((mod) => mod.id === row.modId))
              .map((row) => (
                <li key={row.id} className="panel p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="font-extrabold">
                      {row.modId} · v{row.version}
                    </h2>
                    <span className={`text-sm font-extrabold ${versionStatusClass(row.status)}`}>
                      {versionStatusLabel(row.status)}
                    </span>
                  </div>
                </li>
              ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}

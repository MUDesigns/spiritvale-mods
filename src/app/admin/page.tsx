import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { currentIsAdmin } from "@/lib/admin";
import { AdminGrantPanel } from "@/components/admin-grant-panel";
import { ModImagesPanel } from "@/components/mod-images-panel";
import { ModMetaForm } from "@/components/mod-meta-form";
import {
  ApproveVersionButton,
  DeleteModButton,
  DeleteVersionButton,
  HideModButton,
  RetryScanButton,
} from "@/components/mod-owner-controls";
import { hasDatabase, listAdminCatalog, listImagesByModIds } from "@/lib/catalog";
import {
  formatBytes,
  formatDate,
  versionStatusClass,
  versionStatusLabel,
} from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Catalog admin · SpiritVale Mods",
};

function ownerLabel(ownerUserId: string | null): string {
  if (!ownerUserId) return "Official / unassigned";
  return ownerUserId;
}

export default async function AdminPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  if (!(await currentIsAdmin())) notFound();
  if (!hasDatabase()) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-10">
        <p className="text-[var(--muted)]">Database is not configured yet.</p>
      </main>
    );
  }

  const { mods, versions } = await listAdminCatalog();
  const imagesByMod = await listImagesByModIds(mods.map((mod) => mod.id));
  const queue = versions.filter(
    (row) => row.status === "quarantined" || row.status === "scanning",
  );
  const modsById = new Map(mods.map((mod) => [mod.id, mod]));

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
      <div>
        <h1 className="text-2xl font-extrabold">Catalog admin</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Approve or reject quarantined uploads, edit listings, hide mods from
          the public catalog, and delete any user&apos;s mods or files. Approving
          copies the zip to the public catalog even if VirusTotal or zip checks
          failed. Grant other people admin with the panel below.
        </p>
      </div>

      <AdminGrantPanel />

      <section className="flex flex-col gap-3">
        <h2 className="section-title text-xl">Review queue</h2>
        {queue.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">Nothing is scanning or quarantined.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {queue.map((row) => {
              const mod = modsById.get(row.modId);
              const remaining = versions.filter((item) => item.modId === row.modId).length;
              return (
                <li key={row.id} className="panel p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-extrabold">
                        {mod?.name ?? row.modId} · v{row.version}
                      </p>
                      <p className="font-mono text-xs text-[var(--muted)]">{row.modId}</p>
                      <p className="mt-1 text-sm text-[var(--muted)]">
                        {row.filename} · {formatBytes(row.sizeBytes)} ·{" "}
                        {formatDate(row.publishedAt)}
                      </p>
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        Owner {ownerLabel(mod?.ownerUserId ?? row.uploaderUserId)}
                        {row.uploaderUserId && row.uploaderUserId !== mod?.ownerUserId
                          ? ` · Uploader ${row.uploaderUserId}`
                          : ""}
                      </p>
                      <p className={`mt-2 text-sm font-extrabold ${versionStatusClass(row.status)}`}>
                        {versionStatusLabel(row.status)}
                      </p>
                      {row.scanSummary ? (
                        <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--muted)]">
                          {row.scanSummary}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-start gap-2">
                      <ApproveVersionButton
                        id={row.modId}
                        version={row.version}
                        filename={row.filename}
                        scanSummary={row.scanSummary}
                      />
                      <RetryScanButton id={row.modId} version={row.version} />
                      <DeleteVersionButton
                        id={row.modId}
                        version={row.version}
                        filename={row.filename}
                        isLatestLive={false}
                        remainingCount={remaining}
                      />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="section-title text-xl">All listings</h2>
        {mods.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No mods in the catalog database.</p>
        ) : null}
        {mods.map((mod) => {
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
                        className="text-xl font-extrabold hover:text-[var(--blue)]"
                      >
                        {mod.name}
                      </Link>
                      {mod.hidden ? (
                        <span className="rounded-full border border-[#c9a227]/40 bg-[rgba(40,32,12,0.55)] px-2 py-0.5 text-[0.68rem] font-extrabold tracking-wide text-[#e6c35c] uppercase">
                          Hidden
                        </span>
                      ) : null}
                    </div>
                    <p className="font-mono text-xs text-[var(--muted)]">{mod.id}</p>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      Owner {ownerLabel(mod.ownerUserId)}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
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
                        <div className="flex flex-wrap items-start gap-2">
                          {row.status === "quarantined" || row.status === "scanning" ? (
                            <>
                              <ApproveVersionButton
                                id={mod.id}
                                version={row.version}
                                filename={row.filename}
                                scanSummary={row.scanSummary}
                              />
                              <RetryScanButton id={mod.id} version={row.version} />
                            </>
                          ) : null}
                          <DeleteVersionButton
                            id={mod.id}
                            version={row.version}
                            filename={row.filename}
                            isLatestLive={row.version === latestLive}
                            remainingCount={rows.length}
                          />
                        </div>
                      </div>
                      <p className="mt-1 text-sm text-[var(--muted)]">
                        {formatBytes(row.sizeBytes)} · {formatDate(row.publishedAt)}
                      </p>
                      {row.changelog ? (
                        <p className="mt-2 text-sm text-[var(--muted)]">{row.changelog}</p>
                      ) : null}
                      {row.scanSummary ? (
                        <p className="mt-2 text-sm text-[var(--muted)]">{row.scanSummary}</p>
                      ) : null}
                      {row.downloadUrl ? (
                        <a
                          className="mt-2 inline-block text-sm font-extrabold text-[var(--blue)]"
                          href={row.downloadUrl}
                        >
                          Download
                        </a>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-sm text-[var(--muted)]">No files on this listing.</p>
              )}
            </section>
          );
        })}
      </section>
    </main>
  );
}

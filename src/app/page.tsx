import { loadCatalog, queryPublicMods } from "@/lib/catalog";
import { CatalogBrowser } from "@/components/catalog-browser";
import { formatBytes } from "@/lib/format";
import { DISCORD_INVITE_URL } from "@/lib/discord";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [catalog, listing] = await Promise.all([loadCatalog(), queryPublicMods({ sort: "newest" })]);
  const app = catalog.app;

  return (
    <div className="min-h-full">
      <header className="border-b border-[var(--line)] bg-[#171b28]">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 sm:px-6 sm:py-10">
          <p className="text-sm font-extrabold tracking-[0.12em] text-[#55b7ea] uppercase">
            SpiritVale
          </p>
          <h1 className="text-3xl font-extrabold tracking-tight">Mods catalog</h1>
          <p className="max-w-2xl text-[#9aa3b8]">
            Download mods here and send them to SpiritVale Mod Manager with
            Install, or import zips yourself. Signed-in users can upload; they go
            live after a clean virus scan.
          </p>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-8 sm:px-6 sm:py-10">
        {app ? (
          <section className="panel p-4 sm:p-6">
            <h2 className="text-xl font-extrabold">Mod Manager {app.version}</h2>
            {app.changelog ? (
              <p className="mt-2 text-sm text-[#9aa3b8]">{app.changelog}</p>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-3">
              {app.installer ? (
                <a className="btn btn-primary" href={app.installer.downloadUrl}>
                  Download installer ({formatBytes(app.installer.sizeBytes)})
                </a>
              ) : null}
              {app.portable ? (
                <a className="btn btn-secondary" href={app.portable.downloadUrl}>
                  Portable zip ({formatBytes(app.portable.sizeBytes)})
                </a>
              ) : null}
            </div>
          </section>
        ) : null}

        <section className="panel flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="max-w-2xl">
            <h2 className="text-xl font-extrabold">Join the Discord</h2>
            <p className="mt-2 text-sm text-[#9aa3b8]">
              New versions, install problems, and WIP builds show up there before
              they settle into this catalog. Join, read the rules, and click
              Verify to unlock the rest of the server.
            </p>
          </div>
          <a className="btn btn-primary shrink-0 self-start sm:self-center" href={DISCORD_INVITE_URL}>
            Join Discord
          </a>
        </section>

        <CatalogBrowser initial={listing} />
      </main>
    </div>
  );
}

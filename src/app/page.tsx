import { loadCatalog, queryPublicMods } from "@/lib/catalog";
import { CatalogBrowser } from "@/components/catalog-browser";
import { CatalogPauseNotice } from "@/components/catalog-pause-notice";
import { formatBytes } from "@/lib/format";
import { DISCORD_INVITE_URL } from "@/lib/discord";
import { isCatalogPaused } from "@/lib/catalog-pause";

export const dynamic = "force-dynamic";

const NPCAP_DOWNLOAD_URL = "https://npcap.com/#download";

export default async function Home() {
  const paused = isCatalogPaused();
  const catalog = paused ? null : await loadCatalog();
  const app = catalog?.app ?? null;
  const initialMods = paused
    ? null
    : await queryPublicMods({ q: "", sort: "newest", page: 1, pageSize: 24 });

  return (
    <div className="min-h-full">
      <header className="border-b border-[var(--line)] bg-[#171b28]">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 sm:px-6 sm:py-10">
          <p className="text-sm font-extrabold tracking-[0.12em] text-[#55b7ea] uppercase">
            SpiritVale
          </p>
          <h1 className="text-3xl font-extrabold tracking-tight">
            {paused ? "Mods catalog paused" : "Mods catalog"}
          </h1>
          <p className="max-w-2xl text-[#9aa3b8]">
            {paused
              ? "Community listings and uploads are temporarily offline."
              : "External overlay plugins (listed as mods) for SpiritVale Plugin Manager. Install with the manager or download the zip. Passive overlays only, no game injection."}
          </p>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-8 sm:px-6 sm:py-10">
        {paused ? <CatalogPauseNotice /> : null}

        {!paused && app ? (
          <section className="panel p-4 sm:p-6">
            <h2 className="text-xl font-extrabold">Plugin Manager {app.version}</h2>
            <p className="mt-2 text-sm text-[#9aa3b8]">
              Passive overlay host for SpiritVale. It does not inject into the game or use
              BepInEx. Catalog mods are installed separately after you set up the manager.
            </p>
            <p className="mt-3 text-sm text-[#f4f7fb]">
              <span className="font-extrabold text-[#f0c14a]">Required:</span>{" "}
              <a
                className="font-bold text-[#55b7ea] hover:underline"
                href={NPCAP_DOWNLOAD_URL}
                target="_blank"
                rel="noreferrer"
              >
                Npcap
              </a>{" "}
              with WinPcap API-compatible mode enabled. Without Npcap, overlay
              mods cannot read game traffic.
            </p>
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
              <a
                className="btn btn-secondary"
                href={NPCAP_DOWNLOAD_URL}
                target="_blank"
                rel="noreferrer"
              >
                Download Npcap
              </a>
            </div>
          </section>
        ) : null}

        <section className="panel flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="max-w-2xl">
            <h2 className="text-xl font-extrabold">Join the Discord</h2>
            <p className="mt-2 text-sm text-[#9aa3b8]">
              {paused
                ? "Read the SpiritVale rules and follow policy updates in Discord."
                : "Get Plugin Manager help, release notes, and overlay mod support. Join, read the rules, and click Verify to unlock the rest of the server."}
            </p>
          </div>
          <a className="btn btn-primary shrink-0 self-start sm:self-center" href={DISCORD_INVITE_URL}>
            Join Discord
          </a>
        </section>

        {!paused && initialMods ? <CatalogBrowser initial={initialMods} /> : null}
      </main>
    </div>
  );
}

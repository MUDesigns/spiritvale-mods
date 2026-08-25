import Image from "next/image";
import { loadCatalog, queryPublicMods } from "@/lib/catalog";
import { CatalogPauseNotice } from "@/components/catalog-pause-notice";
import { FeaturedMods } from "@/components/featured-mods";
import { formatBytes } from "@/lib/format";
import { DISCORD_INVITE_URL } from "@/lib/discord";
import { isCatalogPaused } from "@/lib/catalog-pause";

export const dynamic = "force-dynamic";

const NPCAP_DOWNLOAD_URL = "https://npcap.com/#download";
const PLUGIN_DEVKIT_URL = "https://github.com/MUDesigns/SpiritVale-Plugin-Devkit";

export default async function Home() {
  const paused = isCatalogPaused();
  const catalog = paused ? null : await loadCatalog();
  const app = catalog?.app ?? null;
  const featured = paused
    ? null
    : await queryPublicMods({ q: "", sort: "downloads", page: 1, pageSize: 3 });

  return (
    <div className="home-page">
      <div className="home-bg" aria-hidden="true">
        <Image
          src="/ui/home-nebula.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
        />
      </div>

      <header className="home-hero">
        <p className="home-kicker">
          {paused ? "Catalog paused" : "Overlay plugins · no game injection"}
        </p>
        <h1>{paused ? "Mods catalog paused" : "SpiritVale Mods"}</h1>
        <p className="home-hero-copy">
          {paused
            ? "Community listings and uploads are temporarily offline."
            : "External overlay plugins for SpiritVale Plugin Manager. Install with the manager or download the zip. Passive overlays only, no game injection."}
        </p>
        <div className="home-hero-actions">
          {!paused && app?.installer ? (
            <a className="btn btn-primary" href={app.installer.downloadUrl}>
              Download installer ({formatBytes(app.installer.sizeBytes)})
            </a>
          ) : null}
          <a className="btn btn-secondary" href={paused ? DISCORD_INVITE_URL : "/mods"}>
            {paused ? "Join Discord" : "Browse mods"}
          </a>
        </div>
        {!paused && app ? (
          <p className="home-hero-meta">
            Plugin Manager {app.version}
            {" · "}
            Npcap required
            {" · "}
            Passive overlays only
          </p>
        ) : null}
      </header>

      <main className="home-main">
        {paused ? <CatalogPauseNotice /> : null}

        {!paused && app ? (
          <section className="panel home-feature">
            <div className="home-feature-copy">
              <p className="home-kicker">Get the host</p>
              <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
                Plugin Manager {app.version}
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-[var(--muted)] sm:text-base">
                Passive overlay host for SpiritVale. It does not inject into the game or use
                BepInEx. Catalog mods are installed separately after you set up the manager.
              </p>
              <p className="mt-3 text-sm text-[var(--foreground)]">
                <span className="font-extrabold text-[var(--gold)]">Required:</span>{" "}
                <a
                  className="font-bold text-[var(--blue)] hover:underline"
                  href={NPCAP_DOWNLOAD_URL}
                  target="_blank"
                  rel="noreferrer"
                >
                  Npcap
                </a>{" "}
                with WinPcap API-compatible mode enabled. Without Npcap, overlay mods cannot
                read game traffic.
              </p>
              {app.changelog ? (
                <p className="mt-2 text-sm text-[var(--muted)]">{app.changelog}</p>
              ) : null}
              <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
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
            </div>
            <ol className="home-steps">
              <li className="home-step">
                <span className="home-step-index">
                  <span className="home-step-dot" />
                  <span className="home-step-line" />
                </span>
                <div>
                  <h3>Download Plugin Manager</h3>
                  <p>Install the host first. Overlay mods are added from the catalog after setup.</p>
                </div>
              </li>
              <li className="home-step">
                <span className="home-step-index">
                  <span className="home-step-dot" />
                  <span className="home-step-line" />
                </span>
                <div>
                  <h3>Install Npcap</h3>
                  <p>Enable WinPcap API-compatible mode so overlays can read game traffic.</p>
                </div>
              </li>
              <li className="home-step">
                <span className="home-step-index">
                  <span className="home-step-dot" />
                  <span className="home-step-line" />
                </span>
                <div>
                  <h3>Install overlay mods</h3>
                  <p>Browse the catalog, then install with the manager or download the zip.</p>
                </div>
              </li>
            </ol>
          </section>
        ) : null}

        <div className="home-split">
          <section className="panel flex flex-col gap-4 p-5 sm:p-6">
            <div>
              <p className="home-kicker">Community</p>
              <h2 className="text-xl font-extrabold tracking-tight sm:text-2xl">Join the Discord</h2>
              <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
                {paused
                  ? "Read the SpiritVale rules and follow policy updates in Discord."
                  : "Get Plugin Manager help, release notes, and overlay mod support. Join, read the rules, and click Verify to unlock the rest of the server."}
              </p>
            </div>
            <a className="btn btn-primary self-start" href={DISCORD_INVITE_URL}>
              Join Discord
            </a>
          </section>

          <section className="panel flex flex-col gap-4 p-5 sm:p-6">
            <div>
              <p className="home-kicker">Build</p>
              <h2 className="text-xl font-extrabold tracking-tight sm:text-2xl">Make a plugin</h2>
              <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
                HUD plugins are HTML/TypeScript web packs for Plugin Manager. The Devkit has
                guides, a hello-world overlay, and a combat-feed example you can copy.
              </p>
            </div>
            <a
              className="btn btn-secondary self-start"
              href={PLUGIN_DEVKIT_URL}
              target="_blank"
              rel="noreferrer"
            >
              Open plugin Devkit
            </a>
          </section>
        </div>

        {!paused && featured ? <FeaturedMods mods={featured.mods} /> : null}
      </main>
    </div>
  );
}

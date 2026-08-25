import { loadCatalog, queryPublicMods } from "@/lib/catalog";
import { CatalogBrowser } from "@/components/catalog-browser";
import { CatalogPauseNotice } from "@/components/catalog-pause-notice";
import { isCatalogPaused } from "@/lib/catalog-pause";

export const dynamic = "force-dynamic";

export default async function ModsCatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const paused = isCatalogPaused();
  const { q = "" } = await searchParams;
  const catalog = paused ? null : await loadCatalog();
  const initialMods = paused
    ? null
    : await queryPublicMods({ q, sort: "newest", page: 1, pageSize: 24 });

  return (
    <div className="min-h-full">
      <header className="border-b border-[var(--line)]">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 sm:px-6 sm:py-10">
          <p className="text-sm font-extrabold tracking-[0.12em] text-[var(--blue)] uppercase">
            SpiritVale
          </p>
          <h1 className="text-3xl font-extrabold tracking-tight">
            {paused ? "Mods catalog paused" : "Mods catalog"}
          </h1>
          <p className="max-w-2xl text-[var(--muted)]">
            {paused
              ? "Community listings and uploads are temporarily offline."
              : "External overlay plugins for SpiritVale Plugin Manager. Install with the manager or download the zip. Passive overlays only, no game injection."}
          </p>
        </div>
      </header>
      <main className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-8 sm:px-6 sm:py-10">
        {paused ? <CatalogPauseNotice /> : null}
        {!paused && catalog?.app ? (
          <p className="text-sm text-[var(--muted)]">
            Need the host first? Get Plugin Manager {catalog.app.version} from the{" "}
            <a href="/" className="font-extrabold text-[var(--blue)] hover:underline">
              home page
            </a>
            .
          </p>
        ) : null}
        {!paused && initialMods ? (
          <CatalogBrowser initial={initialMods} initialQuery={q} />
        ) : null}
      </main>
    </div>
  );
}

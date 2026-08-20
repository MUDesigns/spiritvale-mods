import {
  CATALOG_PAUSE_INTRO,
  CATALOG_PAUSE_RULES_NOTE,
  CATALOG_PAUSE_TITLE,
} from "@/lib/catalog-pause";

export function CatalogPauseNotice({ compact = false }: { compact?: boolean }) {
  return (
    <section
      className={`panel border-[#c9a227]/35 bg-[rgba(40,32,12,0.55)] ${compact ? "p-4 sm:p-5" : "p-4 sm:p-6"}`}
      aria-labelledby="catalog-pause-heading"
    >
      <p className="text-sm font-extrabold tracking-[0.12em] text-[#e6c35c] uppercase">
        Official notice
      </p>
      <h2
        id="catalog-pause-heading"
        className={`mt-2 font-extrabold tracking-tight ${compact ? "text-xl" : "text-2xl"}`}
      >
        {CATALOG_PAUSE_TITLE}
      </h2>
      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-[#d7dde8]">
        {CATALOG_PAUSE_INTRO}
      </p>

      <div className="mt-6 max-w-3xl rounded-xl border border-[var(--line-strong)] bg-[rgba(12,16,24,0.65)] p-4 sm:p-5">
        <h3 className="text-lg font-extrabold text-[#f4f7fb]">Use of Mods &amp; Overlays</h3>
        <div className="mt-3 space-y-3 text-sm leading-relaxed text-[#c5ccd9]">
          <p>
            We’re continuing with a “use mods at your own risk” approach. Overlays
            and external tools that provide visual information or quality-of-life
            improvements are generally permitted, provided they do not interfere
            with, modify, or inject code into the game’s runtime.
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              DLL injection, BepInEx, runtime patching, or any “unauthorized” form
              of code injection into the game process is not permitted.
            </li>
          </ul>
          <p>
            Cheating tools, exploits, gameplay automation, or other unauthorized
            behavior that provides an unfair advantage may result in permanent
            suspension from SpiritVale.
          </p>
          <p>
            Our support staff cannot provide assistance for issues caused by
            third-party mods or tools. SpiritVale is not responsible for any
            damage, crashes, data loss, or other issues caused by installing or
            using third-party mods or tools. Use them at your own risk and
            discretion.
          </p>
          <p>{CATALOG_PAUSE_RULES_NOTE}</p>
        </div>
      </div>

      {!compact ? (
        <div className="mt-5">
          <a
            className="btn btn-primary"
            href="https://discord.com/channels/1257586742865956875/1375332037325492264/1540099251546357801"
          >
            Open Discord
          </a>
        </div>
      ) : null}
    </section>
  );
}

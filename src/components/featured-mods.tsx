import Link from "next/link";
import {
  catalogDisplayTitle,
  excerpt,
  formatDownloads,
} from "@/lib/format";
import type { PublicModSummary } from "@/lib/types";
import { InstallWithManagerButton } from "@/components/install-with-manager";

export function FeaturedMods({ mods }: { mods: PublicModSummary[] }) {
  if (mods.length === 0) return null;

  return (
    <section className="home-featured">
      <div className="home-featured-head">
        <h2>Top downloads</h2>
        <Link href="/mods" className="text-sm font-extrabold text-[var(--blue)] hover:underline">
          View all →
        </Link>
      </div>
      <ul className="home-featured-row">
        {mods.map((mod, index) => (
          <li key={mod.id}>
            <FeaturedTile mod={mod} lead={index === 0} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function FeaturedTile({ mod, lead }: { mod: PublicModSummary; lead: boolean }) {
  const title = catalogDisplayTitle(mod.name, mod.filename);
  return (
    <article className="home-featured-tile">
      <Link href={`/mods/${mod.id}`} className="featured-cover">
        {mod.thumbnailUrl ? (
          <img src={mod.thumbnailUrl} alt="" />
        ) : (
          <span className="featured-cover-empty" aria-hidden />
        )}
      </Link>
      {lead ? (
        <p className="home-featured-label">Most downloaded</p>
      ) : null}
      <Link
        href={`/mods/${mod.id}`}
        className="mt-2 block text-lg font-extrabold tracking-tight hover:text-[var(--blue)]"
      >
        {title}
      </Link>
      <p className="mt-1 text-sm text-[var(--muted)]">
        {formatDownloads(mod.downloadCount)} · v{mod.latestVersion}
      </p>
      {mod.description ? (
        <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-[var(--muted)]">
          {excerpt(mod.description, 120)}
        </p>
      ) : null}
      <div className="mt-auto flex flex-wrap gap-2 pt-3">
        <InstallWithManagerButton id={mod.id} compact />
        <a className="btn btn-secondary btn-compact" href={mod.downloadUrl}>
          Download
        </a>
      </div>
    </article>
  );
}

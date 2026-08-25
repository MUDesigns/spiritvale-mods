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

  const [lead, ...rest] = mods;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <h2 className="text-xl font-extrabold">Top downloads</h2>
        <Link
          href="/mods"
          className="text-sm font-extrabold text-[#55b7ea] hover:underline"
        >
          View all →
        </Link>
      </div>
      <div className="featured-mods">
        {lead ? <FeaturedLead mod={lead} /> : null}
        {rest.map((mod) => (
          <FeaturedSide key={mod.id} mod={mod} />
        ))}
      </div>
    </section>
  );
}

function FeaturedLead({ mod }: { mod: PublicModSummary }) {
  const title = catalogDisplayTitle(mod.name, mod.filename);
  return (
    <article className="featured-lead panel overflow-hidden">
      <Link href={`/mods/${mod.id}`} className="featured-cover">
        {mod.thumbnailUrl ? (
          <img src={mod.thumbnailUrl} alt="" />
        ) : (
          <span className="featured-cover-empty" aria-hidden />
        )}
      </Link>
      <div className="flex flex-1 flex-col gap-3 p-4 sm:p-5">
        <p className="text-xs font-extrabold tracking-[0.12em] text-[#f0c14a] uppercase">
          Most downloaded
        </p>
        <div className="min-w-0">
          <Link
            href={`/mods/${mod.id}`}
            className="text-2xl font-extrabold tracking-tight hover:text-[#55b7ea]"
          >
            {title}
          </Link>
          <p className="mt-1 text-sm text-[#9aa3b8]">
            {formatDownloads(mod.downloadCount)} · v{mod.latestVersion}
          </p>
        </div>
        {mod.description ? (
          <p className="text-sm leading-relaxed text-[#9aa3b8]">
            {excerpt(mod.description, 180)}
          </p>
        ) : null}
        <div className="mt-auto flex flex-wrap gap-2">
          <InstallWithManagerButton id={mod.id} compact />
          <a className="btn btn-secondary btn-compact" href={mod.downloadUrl}>
            Download
          </a>
        </div>
      </div>
    </article>
  );
}

function FeaturedSide({ mod }: { mod: PublicModSummary }) {
  const title = catalogDisplayTitle(mod.name, mod.filename);
  return (
    <article className="featured-side panel">
      <Link href={`/mods/${mod.id}`} className="featured-side-thumb">
        {mod.thumbnailUrl ? (
          <img src={mod.thumbnailUrl} alt="" />
        ) : (
          <span className="featured-cover-empty" aria-hidden />
        )}
      </Link>
      <div className="min-w-0 flex-1">
        <Link
          href={`/mods/${mod.id}`}
          className="font-extrabold hover:text-[#55b7ea]"
        >
          {title}
        </Link>
        <p className="mt-1 text-sm text-[#9aa3b8]">
          {formatDownloads(mod.downloadCount)} · v{mod.latestVersion}
        </p>
        {mod.description ? (
          <p className="mt-1 line-clamp-2 text-sm text-[#9aa3b8]">
            {excerpt(mod.description, 90)}
          </p>
        ) : null}
      </div>
    </article>
  );
}

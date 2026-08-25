import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { CatalogPauseNotice } from "@/components/catalog-pause-notice";
import { loadModForViewer } from "@/lib/catalog";
import { isCatalogPaused } from "@/lib/catalog-pause";
import { catalogDisplayTitle } from "@/lib/format";
import { isCatalogId } from "@/lib/ids";
import { managerInstallUrl } from "@/lib/manager-protocol";
import { LaunchManager } from "./launch-manager";

export const dynamic = "force-dynamic";

export default async function InstallPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isCatalogId(id)) notFound();

  if (isCatalogPaused()) {
    return (
      <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
        <Link href="/" className="text-sm font-extrabold text-[#55b7ea]">
          ← Back to home
        </Link>
        <CatalogPauseNotice compact />
      </main>
    );
  }

  const { userId } = await auth();
  const viewed = await loadModForViewer(id, userId);
  if (!viewed || viewed.hidden) notFound();
  const mod = viewed.mod;
  const launchUrl = managerInstallUrl(id);

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-4 px-4 py-16 sm:px-6">
      <LaunchManager url={launchUrl} />
      <h1 className="text-2xl font-extrabold">Opening Mod Manager</h1>
      <p className="text-[#9aa3b8]">
        Your browser should ask to open SpiritVale Mod Manager and install{" "}
        <strong className="text-[#f4f7fb]">{catalogDisplayTitle(mod.name, mod.filename)}</strong>
        .
      </p>
      <div className="flex flex-wrap gap-2">
        <a className="btn btn-primary" href={launchUrl}>
          Launch Mod Manager
        </a>
        <Link className="btn btn-secondary" href={`/mods/${id}`}>
          Mod page
        </Link>
      </div>
      <p className="text-xs text-[#9aa3b8]">
        Need the app first? Get SpiritVale Plugin Manager from the{" "}
        <Link className="font-bold text-[#55b7ea] hover:underline" href="/">
          home page
        </Link>
        .
      </p>
    </main>
  );
}

import { loadCatalog } from "@/lib/store";
import { publicMod } from "@/lib/types";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const dynamic = "force-dynamic";

export default async function Home() {
  const catalog = await loadCatalog();
  const mods = Object.values(catalog.mods)
    .map(publicMod)
    .sort((a, b) => a.name.localeCompare(b.name));
  const app = catalog.app;

  return (
    <div className="min-h-full">
      <header className="border-b border-white/10 bg-[#1a1f2c]">
        <div className="mx-auto flex max-w-5xl flex-col gap-2 px-6 py-10">
          <p className="text-sm font-semibold tracking-wide text-[#55b7ea]">SpiritVale</p>
          <h1 className="text-3xl font-bold tracking-tight">Mods catalog</h1>
          <p className="max-w-2xl text-[#9aa3b8]">
            Download mods and the Mod Manager here, or use SpiritVale Mod Manager to
            install and update automatically.
          </p>
        </div>
      </header>

      <main className="mx-auto flex max-w-5xl flex-col gap-10 px-6 py-10">
        {app ? (
          <section className="rounded-2xl border border-white/10 bg-[#1a1f2c] p-6">
            <h2 className="text-xl font-bold">Mod Manager {app.version}</h2>
            {app.changelog ? (
              <p className="mt-2 text-sm text-[#9aa3b8]">{app.changelog}</p>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-3">
              {app.installer ? (
                <a
                  className="rounded-full bg-[#55b7ea] px-4 py-2 text-sm font-bold text-[#12151f]"
                  href={app.installer.downloadUrl}
                >
                  Download installer ({formatBytes(app.installer.sizeBytes)})
                </a>
              ) : null}
              {app.portable ? (
                <a
                  className="rounded-full border border-white/20 px-4 py-2 text-sm font-bold"
                  href={app.portable.downloadUrl}
                >
                  Portable zip ({formatBytes(app.portable.sizeBytes)})
                </a>
              ) : null}
            </div>
          </section>
        ) : null}

        <section>
          <h2 className="mb-4 text-xl font-bold">Mods</h2>
          {mods.length === 0 ? (
            <p className="text-[#9aa3b8]">
              No mods published yet. Use SpiritVale Mod Publisher to upload the first
              build.
            </p>
          ) : (
            <ul className="grid gap-4">
              {mods.map((mod) => (
                <li
                  key={mod.id}
                  className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-[#1a1f2c] p-5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <h3 className="font-bold">{mod.name}</h3>
                    <p className="text-sm text-[#9aa3b8]">
                      v{mod.latestVersion} · {formatBytes(mod.sizeBytes)}
                    </p>
                    {mod.changelog ? (
                      <p className="mt-1 text-sm text-[#9aa3b8]">{mod.changelog}</p>
                    ) : null}
                  </div>
                  <a
                    className="rounded-full bg-[#55b7ea] px-4 py-2 text-center text-sm font-bold text-[#12151f]"
                    href={mod.downloadUrl}
                  >
                    Download zip
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}

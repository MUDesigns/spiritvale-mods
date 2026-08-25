import { DISCORD_INVITE_URL } from "@/lib/discord";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <p>
          SpiritVale Mods catalog. Browse{" "}
          <a href="/mods" className="font-extrabold text-[#55b7ea] hover:underline">
            mods
          </a>
          , join the{" "}
          <a href={DISCORD_INVITE_URL} className="font-extrabold text-[#55b7ea] hover:underline">
            Discord
          </a>{" "}
          for releases, support, and WIP showcase.
        </p>
      </div>
    </footer>
  );
}

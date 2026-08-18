import { managerInstallUrl } from "@/lib/manager-protocol";

export function InstallWithManagerButton({
  id,
  compact = false,
  className,
}: {
  id: string;
  compact?: boolean;
  className?: string;
}) {
  return (
    <a
      className={
        className ?? (compact ? "btn btn-secondary btn-compact" : "btn btn-primary")
      }
      href={managerInstallUrl(id)}
      title="Opens SpiritVale Mod Manager and adds this zip to your library"
    >
      {compact ? "Install" : "Install with Mod Manager"}
    </a>
  );
}

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
      title="Opens SpiritVale Plugin Manager and installs this mod"
    >
      {compact ? "Install" : "Install with Plugin Manager"}
    </a>
  );
}

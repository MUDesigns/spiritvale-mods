import { Resend } from "resend";
import { ADMIN_ALERT_EMAIL, SITE_URL } from "@/lib/constants";

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return null;
  return new Resend(key);
}

export async function sendQuarantineAlert(input: {
  modId: string;
  version: string;
  filename: string;
  sha256: string;
  uploaderUserId: string;
  uploaderEmail?: string | null;
  reason: string;
  vtUrl?: string | null;
}): Promise<void> {
  const resend = getResend();
  if (!resend) {
    console.error("RESEND_API_KEY is not set; skipping quarantine email.", input);
    return;
  }

  const from =
    process.env.RESEND_FROM?.trim() || "SpiritVale Mods <beth.t@example.com>";
  const vtLine = input.vtUrl ? `\nVirusTotal: ${input.vtUrl}` : "";
  const { error } = await resend.emails.send({
    from,
    to: [ADMIN_ALERT_EMAIL],
    subject: `[SpiritVale Mods] Quarantined ${input.modId} ${input.version}`,
    text: [
      "A community upload was quarantined and is not listed on the catalog.",
      "",
      `Review: ${SITE_URL}/admin`,
      "",
      `Mod id: ${input.modId}`,
      `Version: ${input.version}`,
      `Filename: ${input.filename}`,
      `SHA-256: ${input.sha256}`,
      `Uploader Clerk id: ${input.uploaderUserId}`,
      `Uploader email: ${input.uploaderEmail ?? "(unknown)"}`,
      `Reason: ${input.reason}`,
      vtLine.trim(),
    ]
      .filter(Boolean)
      .join("\n"),
  });

  if (error) {
    console.error("Failed to send quarantine email:", error);
  }
}

import { createHash } from "node:crypto";
import { clerkClient } from "@clerk/nextjs/server";
import { getVersion, markVersionStatus } from "@/lib/catalog";
import { sendQuarantineAlert } from "@/lib/mail";
import { deleteStoredBlob, publishModZip, readStoredBlob } from "@/lib/store";
import { inspectZipBuffer } from "@/lib/zip";

const VT_BASE = "https://www.virustotal.com/api/v3";
const VT_MIN_INTERVAL_MS = 16_000;
const VT_POLL_ATTEMPTS = 12;
const DIRECT_UPLOAD_MAX = 32 * 1024 * 1024;

function vtKey(): string | null {
  return process.env.VIRUSTOTAL_API_KEY?.trim() || null;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function vtRequest(path: string, init?: RequestInit): Promise<Response> {
  await sleep(VT_MIN_INTERVAL_MS);
  const headers = new Headers(init?.headers);
  headers.set("x-apikey", vtKey()!);
  return fetch(`${VT_BASE}${path}`, { ...init, headers });
}

function statsFromReport(report: {
  data?: {
    id?: string;
    attributes?: {
      last_analysis_stats?: {
        malicious?: number;
        suspicious?: number;
      };
    };
  };
}): { malicious: number; suspicious: number; id?: string } {
  const stats = report.data?.attributes?.last_analysis_stats ?? {};
  return {
    malicious: Number(stats.malicious ?? 0),
    suspicious: Number(stats.suspicious ?? 0),
    id: report.data?.id,
  };
}

async function lookupHash(sha256: string) {
  const response = await vtRequest(`/files/${sha256}`);
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`VirusTotal lookup failed (${response.status})`);
  }
  return (await response.json()) as Parameters<typeof statsFromReport>[0];
}

async function uploadFile(buffer: Buffer, filename: string): Promise<string> {
  const body = new FormData();
    body.set("file", new Blob([new Uint8Array(buffer)]), filename);

  if (buffer.length <= DIRECT_UPLOAD_MAX) {
    const response = await vtRequest("/files", { method: "POST", body });
    if (!response.ok) {
      throw new Error(`VirusTotal upload failed (${response.status})`);
    }
    const json = (await response.json()) as { data?: { id?: string } };
    const id = json.data?.id;
    if (!id) throw new Error("VirusTotal upload returned no analysis id.");
    return id;
  }

  const urlResponse = await vtRequest("/files/upload_url");
  if (!urlResponse.ok) {
    throw new Error(`VirusTotal upload URL failed (${urlResponse.status})`);
  }
  const urlJson = (await urlResponse.json()) as { data?: string };
  const uploadUrl = urlJson.data;
  if (!uploadUrl) throw new Error("VirusTotal did not return an upload URL.");

  await sleep(VT_MIN_INTERVAL_MS);
  const uploaded = await fetch(uploadUrl, { method: "POST", body });
  if (!uploaded.ok) {
    throw new Error(`VirusTotal large upload failed (${uploaded.status})`);
  }
  const uploadedJson = (await uploaded.json()) as { data?: { id?: string } };
  const id = uploadedJson.data?.id;
  if (!id) throw new Error("VirusTotal large upload returned no analysis id.");
  return id;
}

async function pollAnalysis(analysisId: string): Promise<void> {
  for (let attempt = 0; attempt < VT_POLL_ATTEMPTS; attempt++) {
    const response = await vtRequest(`/analyses/${analysisId}`);
    if (!response.ok) {
      throw new Error(`VirusTotal analysis failed (${response.status})`);
    }
    const json = (await response.json()) as {
      data?: { attributes?: { status?: string } };
    };
    if (json.data?.attributes?.status === "completed") return;
  }
  throw new Error("VirusTotal analysis timed out.");
}

async function uploaderEmail(userId: string): Promise<string | null> {
  try {
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    return user.emailAddresses[0]?.emailAddress ?? null;
  } catch {
    return null;
  }
}

export async function scanVersion(modId: string, version: string): Promise<void> {
  const row = await getVersion(modId, version);
  if (!row) return;

  const email = row.uploaderUserId
    ? await uploaderEmail(row.uploaderUserId)
    : null;

  const quarantine = async (reason: string, vtUrl?: string | null) => {
    const current = await getVersion(modId, version);
    if (!current || current.status === "live") return;
    await markVersionStatus({
      modId,
      version,
      status: "quarantined",
      scanSummary: reason,
      vtId: vtUrl ?? undefined,
    });
    await sendQuarantineAlert({
      modId,
      version,
      filename: row.filename,
      sha256: row.sha256,
      uploaderUserId: row.uploaderUserId ?? "(unknown)",
      uploaderEmail: email,
      reason,
      vtUrl,
    });
    const { notifyDiscord } = await import("@/lib/discord-bridge");
    await notifyDiscord({
      type: "scan.quarantined",
      modId,
      version,
      name: row.filename,
      reason,
    });
  };

  try {
    const buffer = await readStoredBlob(row.blobPath, row.downloadUrl);
    const sha256 = createHash("sha256").update(buffer).digest("hex");
    if (sha256 !== row.sha256.toLowerCase()) {
      await quarantine(`SHA-256 mismatch (computed ${sha256}).`);
      return;
    }

    const zipError = await inspectZipBuffer(buffer);
    if (zipError) {
      await quarantine(zipError);
      return;
    }

    const key = vtKey();
    if (!key) {
      await quarantine("VirusTotal is not configured (VIRUSTOTAL_API_KEY).");
      return;
    }

    let report = await lookupHash(sha256);
    let analysisId: string | undefined;
    if (!report) {
      analysisId = await uploadFile(buffer, row.filename);
      await pollAnalysis(analysisId);
      report = await lookupHash(sha256);
    }
    if (!report) {
      await quarantine("VirusTotal returned no report after upload.");
      return;
    }

    const stats = statsFromReport(report);
    const vtUrl = `https://www.virustotal.com/gui/file/${sha256}`;
    if (stats.malicious > 0 || stats.suspicious > 0) {
      await quarantine(
        `VirusTotal detections: malicious=${stats.malicious}, suspicious=${stats.suspicious}.`,
        vtUrl,
      );
      return;
    }

    if (!(await getVersion(modId, version))) {
      try {
        await deleteStoredBlob(row.blobPath);
      } catch {
        // Quarantine copy may already be gone.
      }
      return;
    }

    const publicPath = `mods/${modId}/${version}/${row.filename}`;
    const copied = await publishModZip(row.blobPath, publicPath);
    if (!(await getVersion(modId, version))) {
      try {
        await deleteStoredBlob(publicPath);
      } catch {
        // Public copy may not exist if copy was a no-op.
      }
      try {
        await deleteStoredBlob(row.blobPath);
      } catch {
        // Quarantine copy may already be gone.
      }
      return;
    }
    await markVersionStatus({
      modId,
      version,
      status: "live",
      downloadUrl: copied.downloadUrl || copied.url,
      blobPath: publicPath,
      scanSummary: "VirusTotal clean (malicious=0, suspicious=0).",
      vtId: sha256,
    });
    const { notifyModLive } = await import("@/lib/discord-bridge");
    await notifyModLive({
      modId,
      version,
      ownerUserId: row.uploaderUserId,
    });
    try {
      await deleteStoredBlob(row.blobPath);
    } catch {
      // Keep quarantine copy if delete fails; public copy is live.
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown scan error.";
    await quarantine(message);
  }
}

import { createHmac, timingSafeEqual } from "node:crypto";
import { SITE_URL } from "@/lib/constants";

export type UploadTokenPayload = {
  pathname: string;
  maxBytes: number;
  expiresAt: number;
  userId?: string;
};

function secret(): string {
  const value =
    process.env.UPLOAD_SECRET?.trim() ||
    process.env.PUBLISH_TOKEN?.trim() ||
    process.env.CLERK_SECRET_KEY?.trim() ||
    "";
  if (!value) {
    throw new Error("UPLOAD_SECRET or PUBLISH_TOKEN is required for uploads.");
  }
  return value;
}

function b64url(value: string | Buffer): string {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromB64url(value: string): Buffer {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(padded, "base64");
}

export function signUploadToken(payload: UploadTokenPayload): string {
  const body = b64url(JSON.stringify(payload));
  const sig = b64url(createHmac("sha256", secret()).update(body).digest());
  return `${body}.${sig}`;
}

export function verifyUploadToken(token: string): UploadTokenPayload {
  const [body, sig] = token.split(".");
  if (!body || !sig) {
    throw new Error("Invalid upload token.");
  }
  const expected = b64url(createHmac("sha256", secret()).update(body).digest());
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new Error("Invalid upload token.");
  }
  const payload = JSON.parse(fromB64url(body).toString("utf8")) as UploadTokenPayload;
  if (!payload.pathname || !payload.maxBytes || !payload.expiresAt) {
    throw new Error("Invalid upload token.");
  }
  if (payload.expiresAt < Date.now()) {
    throw new Error("Upload token expired.");
  }
  return payload;
}

export function requestOrigin(request: Request): string {
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const forwardedProto =
    request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || "https";
  if (forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }
  try {
    return new URL(request.url).origin;
  } catch {
    return SITE_URL.replace(/\/$/, "");
  }
}

export function catalogUploadUrl(pathname: string, origin?: string): string {
  const base = (origin || SITE_URL).replace(/\/$/, "");
  return `${base}/api/upload/blob?pathname=${encodeURIComponent(pathname)}`;
}

export function issueUpload(
  payload: Omit<UploadTokenPayload, "expiresAt"> & { ttlMs?: number; origin?: string },
) {
  const expiresAt = Date.now() + (payload.ttlMs ?? 60 * 60 * 1000);
  const clientToken = signUploadToken({
    pathname: payload.pathname,
    maxBytes: payload.maxBytes,
    userId: payload.userId,
    expiresAt,
  });
  return {
    pathname: payload.pathname,
    clientToken,
    uploadUrl: catalogUploadUrl(payload.pathname, payload.origin),
    validUntil: expiresAt,
    maximumSizeInBytes: payload.maxBytes,
  };
}

export const COMMUNITY_MAX_BYTES = 50 * 1024 * 1024;
export const IMAGE_MAX_BYTES = 8 * 1024 * 1024;
export const APP_MAX_BYTES = 512 * 1024 * 1024;
export const MAX_IMAGES_PER_MOD = 16;
export const IMAGE_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;
export const RATE_LIMIT_MAX = 4;
export const RATE_LIMIT_WINDOW_MS = 5_000;
export const API_KEY_PREFIX = "svm_";
export const MAX_API_KEYS_PER_USER = 5;
export const MAX_VERSIONS_PER_MOD = 25;
export const DESCRIPTION_MAX = 8000;
export const CATALOG_PAGE_SIZE = 20;
export const CATALOG_PAGE_SIZE_MAX = 50;
export const ZIP_MAX_ENTRIES = 200;
export const ZIP_MAX_UNCOMPRESSED_BYTES = 200 * 1024 * 1024;
export const ZIP_MAX_RATIO = 100;
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://www.spiritvalemods.com";
export const DEFAULT_ADMIN_EMAIL = "matt03803@gmail.com";
export const ADMIN_ALERT_EMAIL =
  process.env.ADMIN_ALERT_EMAIL?.trim() || DEFAULT_ADMIN_EMAIL;

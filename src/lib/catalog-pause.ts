/** Catalog pause flag. Overlay Plugin Manager listings are live; set true only for emergencies. */
export const CATALOG_PAUSED = false;

export const CATALOG_PAUSE_TITLE = "Catalog paused";

export const CATALOG_PAUSE_INTRO =
  "The SpiritVale Mods catalog is temporarily offline. The site stays up so you can read policy notes and download the Plugin Manager when available.";

export const CATALOG_PAUSE_RULES_NOTE =
  "For more information on permitted and prohibited behavior, please review the SpiritVale Rules in Discord (#rules).";

export const CATALOG_PAUSE_API_ERROR =
  "The SpiritVale Mods catalog and uploads are temporarily paused.";

export function isCatalogPaused(): boolean {
  return CATALOG_PAUSED;
}

export function catalogPausedResponse(): Response {
  return Response.json({ error: CATALOG_PAUSE_API_ERROR }, { status: 503 });
}

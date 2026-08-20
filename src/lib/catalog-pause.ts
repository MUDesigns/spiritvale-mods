/** Temporary pause while SpiritVale disallows BepInEx / runtime injection. */
export const CATALOG_PAUSED = true;

export const CATALOG_PAUSE_TITLE = "Catalog paused";

export const CATALOG_PAUSE_INTRO =
  "SpiritVale has clarified that BepInEx, DLL injection, and other runtime code injection are not permitted. This catalog and community uploads are paused for now. The site stays online so you can read their statement below.";

export const CATALOG_PAUSE_RULES_NOTE =
  "For more information on permitted and prohibited behavior, please review the SpiritVale Rules in Discord (#rules).";

export const CATALOG_PAUSE_API_ERROR =
  "The SpiritVale Mods catalog and uploads are paused. BepInEx and other runtime injection are not permitted by SpiritVale.";

export function isCatalogPaused(): boolean {
  return CATALOG_PAUSED;
}

export function catalogPausedResponse(): Response {
  return Response.json({ error: CATALOG_PAUSE_API_ERROR }, { status: 503 });
}

/**
 * Central locale registry.
 *
 * Adding a new language:
 *   1. Create lib/locales/<code>.ts  (copy an existing file as template)
 *   2. Import it here and add one line to `locales`
 *   3. That's it — Lang type, language picker and i18n hook update automatically
 */

import de, { meta as deMeta } from './locales/de';
import en, { meta as enMeta } from './locales/en';
import pl, { meta as plMeta } from './locales/pl';

export type { TranslationSet, LocaleMeta } from './locales/_types';

// ── Registry ────────────────────────────────────────────────────────────────
// Add new locales here. Lang is derived automatically from the keys.
export const locales = {
  de: { translations: de, ...deMeta },
  en: { translations: en, ...enMeta },
  pl: { translations: pl, ...plMeta },
} as const;

export type Lang = keyof typeof locales;

/** Flat translation map per language, for the i18n hook. */
export const translations = Object.fromEntries(
  Object.entries(locales).map(([code, { translations: t }]) => [code, t])
) as Record<Lang, ReturnType<typeof de extends never ? never : () => typeof de>>;

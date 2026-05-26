import { I18n } from 'i18n-js';
import * as Localization from 'expo-localization';

import esCO from './es-CO.json';

const i18n = new I18n({ 'es-CO': esCO, es: esCO });

// Detect device locale, fall back to es-CO
const deviceLocale = Localization.getLocales()[0]?.languageTag ?? 'es-CO';
i18n.locale = deviceLocale.startsWith('es') ? 'es-CO' : 'es-CO'; // Only es-CO for MVP
i18n.enableFallback = true;
i18n.defaultLocale = 'es-CO';

export function t(key: string, options?: Record<string, unknown>): string {
  return i18n.t(key, options);
}

export default i18n;

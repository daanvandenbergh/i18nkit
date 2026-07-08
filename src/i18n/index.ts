/**
 * Public surface of the i18nkit core (the `.` entry). The star is the {@link I18n} class - a
 * consumer constructs one instance and reaches every feature through it. The mapped-type
 * vocabulary is exported for annotations, and the two locale-free resolvers (`createTranslator`,
 * `translate`) are exported as escape hatches for resolving a text you already hold without an
 * instance. Detection and routing are reached as `I18n` methods, not standalone, so there is one
 * obvious way to do each.
 */
export { I18n, type LocaleOf } from "./i18n.js";
export { createTranslator, translate } from "./translate.js";
export type {
    I18nConfig,
    LanguageText,
    LanguageTextCatalog,
    LanguageTextFn,
    LocaleInfo,
    ResolvedLocale,
    Translator,
} from "./types.js";

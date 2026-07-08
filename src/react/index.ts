/**
 * React adapter for i18nkit (the `./react` entry). Framework-agnostic React: a provider, hooks,
 * an accessible language picker, and a locale-aware link - none of which import `next/*`, so they
 * work in any React setup. Pair with the core `@daanvandenbergh/i18nkit` entry (the `I18n` class)
 * and, for the picker, `import "@daanvandenbergh/i18nkit/styles.css"`.
 */
export {
    I18nProvider,
    useI18n,
    useLocale,
    useSetLocale,
    useTranslator,
    type I18nProviderProps,
} from "./provider.js";
export { LanguagePicker, type LanguagePickerProps } from "./LanguagePicker.js";
export { Flag, localeFlag } from "./flags.js";
export { LocaleLink, type LocaleLinkProps } from "./LocaleLink.js";

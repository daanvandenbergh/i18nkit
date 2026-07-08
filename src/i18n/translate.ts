/**
 * The resolver: turns a {@link LanguageText}/{@link LanguageTextFn} into a plain string for a
 * given locale. Kept framework-free (types-only import) so the identical call shape works on the
 * server, in the browser, and at the edge.
 */
import type { LanguageText, LanguageTextFn, Translator } from "./types.js";

/**
 * Build a {@link Translator} bound to a single locale. The returned function reads the entry for
 * `locale` and, if it is a builder function, applies the arguments. Usually reached through
 * `i18n.translator(locale)` (which pins the locale to the instance's union) rather than directly.
 *
 * @typeParam L - the locale union the text objects are keyed by.
 * @param locale - the locale every returned call resolves against.
 * @returns the overloaded translator function.
 */
export function createTranslator<L extends string>(locale: L): Translator<L> {
    function boundTranslate(text: LanguageText<L>): string;
    function boundTranslate<A extends readonly unknown[]>(text: LanguageTextFn<L, A>, ...args: A): string;
    function boundTranslate(
        text: LanguageText<L> | LanguageTextFn<L, readonly unknown[]>,
        ...args: readonly unknown[]
    ): string {
        const value = (text as Record<L, string | ((...a: readonly unknown[]) => string)>)[locale];
        return typeof value === "function" ? value(...args) : value;
    }
    return boundTranslate;
}

/**
 * Resolve a single static text without building a bound {@link Translator} - handy for one-off
 * lookups. For parameterized text or repeated resolution, prefer `i18n.translator(locale)`.
 *
 * @typeParam L - the locale union the text object is keyed by.
 * @param text - the {@link LanguageText} to resolve.
 * @param locale - the locale to resolve against.
 * @returns the string for that locale.
 */
export function translate<L extends string>(text: LanguageText<L>, locale: L): string {
    return text[locale];
}

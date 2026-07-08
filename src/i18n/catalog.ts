/**
 * Catalog construction helpers. The type-level machinery that enforces per-locale coverage lives
 * in {@link import("./types.js").LanguageTextCatalog} and is applied by the `I18n` instance's
 * `defineTextCatalog`/`defineText` methods; this file holds the one runtime helper that builds a
 * text object, {@link uniform}.
 */
import type { LanguageText } from "./types.js";

/**
 * Build a {@link LanguageText} whose value is identical in every locale - for a brand word or a
 * symbol that is the same across languages (e.g. `"Acme"`, `"←"`). Reached as `i18n.uniform(value)`,
 * which supplies the instance's locale codes.
 *
 * @typeParam L - the locale union to cover.
 * @param value - the string to use for every locale.
 * @param codes - every locale code in `L`.
 * @returns a {@link LanguageText} carrying `value` under each code.
 */
export function uniform<L extends string>(value: string, codes: readonly L[]): LanguageText<L> {
    const out = {} as Record<L, string>;
    for (const code of codes) {
        out[code] = value;
    }
    return out as LanguageText<L>;
}

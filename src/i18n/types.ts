/**
 * The pure type core of i18nkit. Every user-facing string is a {@link LanguageText} (static)
 * or a {@link LanguageTextFn} (parameterized): an object with exactly one entry per locale in
 * the caller's locale union `L`. Because these are mapped types over `L`, adding a locale to
 * an {@link I18n} instance's config grows `L`, which turns every catalog entry still missing
 * that locale into a compile error - that is the whole point: 100% type-safe coverage.
 *
 * This file has zero imports (no `react`, no `node:*`) so it can be shared by server, client,
 * and edge code alike.
 */

/**
 * The URL scheme for the default locale:
 * - `"prefix-except-default"` (the default): the default locale is served at bare URLs
 *   (`/pricing`) and every other locale under its `htmlLang` prefix (`/nl/pricing`).
 * - `"prefix-all"`: every locale, including the default, carries its prefix (`/en/pricing`,
 *   `/nl/pricing`), so there is no bare-URL locale.
 */
export type RoutingStrategy = "prefix-except-default" | "prefix-all";

/**
 * Static metadata describing one locale - used to render the picker, set `<html lang>`, and
 * pick an `Intl` formatting locale. This is configuration, not translated UI copy.
 *
 * The locale's own key in the config map (e.g. `"en"`) is its code; `htmlLang` and `locale`
 * default to that key so a BCP-47-keyed config can omit them entirely.
 */
export interface LocaleInfo {
    /**
     * The locale's own name (endonym) shown in the picker in every UI language alike (e.g.
     * "English", "Nederlands"). A plain string on purpose - a language's name is not itself translated.
     */
    label: string;
    /**
     * BCP-47 primary subtag for the document `<html lang>` attribute and the URL prefix (e.g.
     * "en"). Defaults to the locale's key in the config map.
     */
    htmlLang?: string | undefined;
    /**
     * Full BCP-47 locale for `Intl` date/number formatting (e.g. "en-GB" -> "12 Jan 2026";
     * "nl-NL" -> "12 jan 2026"). Defaults to {@link htmlLang}, then the locale's key. Kept
     * separate from {@link htmlLang} because the document tag is primary-subtag only while
     * formatting needs a concrete regional convention.
     */
    locale?: string | undefined;
}

/**
 * A fully-resolved locale entry: {@link LocaleInfo} with its `code` and with `htmlLang`/`locale`
 * filled in from their defaults. This is the shape exposed on an {@link I18n}'s `locales` map and
 * `list` array, so consumers (the picker, routing) always read concrete values.
 *
 * @typeParam L - the locale union this entry belongs to.
 */
export interface ResolvedLocale<L extends string> {
    /** The locale code (the key this entry had in the config map). */
    code: L;
    /** The endonym label, copied from {@link LocaleInfo.label}. */
    label: string;
    /** The resolved BCP-47 `<html lang>` / URL-prefix subtag (never undefined). */
    htmlLang: string;
    /** The resolved full BCP-47 `Intl` formatting locale (never undefined). */
    locale: string;
}

/**
 * The configuration object passed to `new I18n(...)`. The locale union `L` is inferred from the
 * keys of {@link I18nConfig.locales}; `default` is wrapped in `NoInfer` so it never widens `L`.
 *
 * @typeParam L - the locale union, inferred from `locales`' keys.
 */
export interface I18nConfig<L extends string> {
    /**
     * The supported locales, keyed by their code, in the order the picker should list them
     * (insertion order is preserved). The set of keys defines the locale union `L`.
     */
    locales: Record<L, LocaleInfo>;
    /**
     * The fallback locale for detection/resolution: used when a cookie value or `Accept-Language`
     * is missing, invalid, or unrecognized. It is not a per-key translation fallback - the catalog
     * types require a string for every locale, so a translation is never missing at runtime.
     */
    default: NoInfer<L>;
    /**
     * Name of the cookie the picker writes and locale detection reads. Site-scoped and readable
     * by client script (not httpOnly). Defaults to `"locale"`.
     */
    cookie?: string | undefined;
    /**
     * Absolute site origin (e.g. `"https://example.com"`) used to build absolute URLs in
     * `hreflangAlternates`. Optional; only that helper needs it.
     */
    origin?: string | undefined;
    /**
     * Path prefixes that must never be localized (e.g. `["/api"]`), matched segment-aware so
     * `/api` and `/api/x` are excluded but `/apis` is not. Defaults to `[]`.
     */
    nonLocalizedPrefixes?: readonly string[] | undefined;
    /**
     * The URL scheme for the default locale (see {@link RoutingStrategy}). `"prefix-except-default"`
     * serves the default locale at bare URLs; `"prefix-all"` prefixes every locale including the
     * default. Defaults to `"prefix-except-default"`.
     */
    strategy?: RoutingStrategy | undefined;
}

/**
 * A static piece of user-facing text: exactly one string per locale in `L`.
 *
 * @typeParam L - the locale union every key must cover.
 * @example { en: "Answer my first call free", nl: "Beantwoord mijn eerste oproep gratis" }
 */
export type LanguageText<L extends string> = { readonly [K in L]: string };

/**
 * A parameterized piece of user-facing text: one builder function per locale in `L`. Use this
 * wherever a string interpolates a runtime value, so each locale keeps control of word order.
 *
 * @typeParam L - the locale union every key must cover.
 * @typeParam A - the builder's argument tuple (inferred at the call site).
 * @example { en: (name: string) => `Good morning, ${name}`, nl: (name: string) => `Goedemorgen, ${name}` }
 */
export type LanguageTextFn<L extends string, A extends readonly unknown[]> = {
    readonly [K in L]: (...args: A) => string;
};

/**
 * The shape a co-located copy catalog is constrained to, so TypeScript forces every entry to
 * carry all locale keys of `L` while each entry keeps its precise literal type (needed for
 * argument inference in a {@link Translator}). The `readonly never[]` argument keeps the
 * function arm contravariant, so any parameterized builder satisfies the constraint.
 *
 * @typeParam L - the locale union every entry must cover.
 */
export type LanguageTextCatalog<L extends string> = Record<
    string,
    LanguageText<L> | LanguageTextFn<L, readonly never[]>
>;

/**
 * A translate function bound to one locale. Overloaded so the same call resolves both static and
 * parameterized text:
 * - `translate(text)` for a {@link LanguageText} -> the string.
 * - `translate(text, ...args)` for a {@link LanguageTextFn} -> the built string.
 *
 * @typeParam L - the locale union the text objects are keyed by.
 */
export interface Translator<L extends string> {
    /**
     * Resolve a static text to its string for the bound locale.
     *
     * @param text - the {@link LanguageText} to resolve.
     * @returns the string for the bound locale.
     */
    (text: LanguageText<L>): string;
    /**
     * Resolve a parameterized text, applying the arguments its per-locale builder expects.
     *
     * @param text - the {@link LanguageTextFn} to resolve.
     * @param args - the arguments its builder expects.
     * @returns the built string for the bound locale.
     */
    <A extends readonly unknown[]>(text: LanguageTextFn<L, A>, ...args: A): string;
}

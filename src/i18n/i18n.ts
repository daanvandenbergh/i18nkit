/**
 * The `I18n` class - the single public surface of i18nkit's core. A consumer constructs one
 * instance from their locale config and authors + resolves every translation through it, so the
 * instance's locale union `L` (inferred from the config) flows into every method and enforces
 * 100% coverage at each call site.
 *
 * The class is a thin, config-bound facade over the pure functions in the sibling modules
 * (`catalog`, `translate`, `detect`, `routing`), which stay independently testable and
 * framework-free.
 */
import * as catalog from "./catalog.js";
import * as detect from "./detect.js";
import * as routing from "./routing.js";
import * as text from "./translate.js";
import type {
    I18nConfig,
    LanguageText,
    LanguageTextCatalog,
    LanguageTextFn,
    ResolvedLocale,
    RoutingStrategy,
    Translator,
} from "./types.js";

/** The default cookie name when the config does not override it. */
const DEFAULT_COOKIE = "locale";

/**
 * Recover the locale union of an {@link I18n} instance type, for annotating helpers that receive
 * one: `function greet(i18n: I18n<Locale>, l: LocaleOf<typeof i18n>) {}`. In app code the simpler
 * `type Locale = keyof typeof i18n.locales` is usually enough.
 *
 * @typeParam T - an `I18n<L>` instance type.
 */
export type LocaleOf<T> = T extends I18n<infer L> ? L : never;

/**
 * A type-safe i18n instance bound to one locale set. Create it once and export it:
 *
 * ```ts
 * export const i18n = new I18n({
 *     locales: { en: { label: "English" }, nl: { label: "Nederlands", htmlLang: "nl", locale: "nl-NL" } },
 *     default: "en",
 * });
 * export type Locale = keyof typeof i18n.locales; // "en" | "nl"
 * ```
 *
 * @typeParam L - the locale union, inferred from the constructor's `locales` keys.
 */
export class I18n<L extends string> {
    /** Every configured locale, fully resolved, keyed by code. `keyof this.locales` is the locale union. */
    readonly locales: Record<L, ResolvedLocale<L>>;
    /** Every configured locale in declaration order - the order the picker lists them. */
    readonly list: readonly ResolvedLocale<L>[];
    /** The fallback locale for detection/resolution (unknown cookie, unmatched `Accept-Language`). */
    readonly default: L;
    /** The cookie name the picker writes and locale detection reads. */
    readonly cookie: string;
    /** The absolute site origin for {@link hreflangAlternates}, or undefined if not configured. */
    readonly origin: string | undefined;
    /** Path prefixes that are never localized. */
    readonly nonLocalizedPrefixes: readonly string[];
    /** The URL scheme for the default locale (`"prefix-except-default"` or `"prefix-all"`). */
    readonly strategy: RoutingStrategy;

    /** Every locale code, cached for {@link uniform}. */
    readonly #codes: readonly L[];
    /** The routing config passed to every routing helper. */
    readonly #routing: routing.RoutingConfig<L>;

    /**
     * Build an i18n instance.
     *
     * @param config - the locale set and options (see {@link I18nConfig}).
     * @throws Error when `locales` is empty, `default` is not one of the configured locales, or two
     *     locales resolve to the same case-insensitive `htmlLang`.
     */
    constructor(config: I18nConfig<L>) {
        const codes = Object.keys(config.locales) as L[];
        if (codes.length === 0) {
            throw new Error("I18n: `locales` must declare at least one locale.");
        }
        if (!codes.includes(config.default)) {
            throw new Error(
                `I18n: default locale "${config.default}" is not one of the configured locales (${codes.join(", ")}).`,
            );
        }
        this.list = codes.map((code) => {
            const info = config.locales[code];
            const htmlLang = info.htmlLang ?? code;
            return { code, label: info.label, htmlLang, locale: info.locale ?? htmlLang };
        });
        // URL routing matches locale segments case-insensitively (`/en-gb` resolves to `en-GB`), so
        // two locales whose htmlLang differ only by case would share one URL prefix and leave one
        // locale unreachable by URL. Fail fast at construction rather than fail silently at runtime.
        const seenHtmlLang = new Map<string, L>();
        for (const entry of this.list) {
            const key = entry.htmlLang.toLowerCase();
            const clash = seenHtmlLang.get(key);
            if (clash !== undefined) {
                throw new Error(
                    `I18n: locales "${clash}" and "${entry.code}" both resolve to htmlLang "${key}" (case-insensitive); each locale needs a distinct htmlLang.`,
                );
            }
            seenHtmlLang.set(key, entry.code);
        }
        this.locales = Object.fromEntries(this.list.map((entry) => [entry.code, entry])) as Record<
            L,
            ResolvedLocale<L>
        >;
        this.default = config.default;
        this.cookie = config.cookie ?? DEFAULT_COOKIE;
        // Strip trailing slashes so a caller passing `origin: "https://x.com/"` does not yield a
        // double slash in canonical/hreflang URLs (`https://x.com//pricing`), which harms SEO.
        this.origin = config.origin?.replace(/\/+$/, "");
        this.nonLocalizedPrefixes = config.nonLocalizedPrefixes ?? [];
        this.strategy = config.strategy ?? "prefix-except-default";
        this.#codes = codes;
        this.#routing = {
            locales: this.list,
            default: this.default,
            nonLocalizedPrefixes: this.nonLocalizedPrefixes,
            strategy: this.strategy,
            origin: this.origin,
        };
    }

    // --- Authoring (type-level coverage enforcement) --------------------------------------------

    /**
     * Define a co-located catalog of copy. Every entry must carry a translation for every locale
     * in `L`, or it is a compile error; the returned object keeps its precise literal type so a
     * {@link Translator} can infer each parameterized entry's arguments. This is an identity
     * function - all the work is in the type constraint.
     *
     * @typeParam C - the catalog literal, constrained to {@link LanguageTextCatalog}.
     * @param catalog - the catalog object.
     * @returns the same object, precisely typed.
     */
    defineTextCatalog<const C extends LanguageTextCatalog<L>>(catalog: C): C {
        return catalog;
    }

    /**
     * Define one standalone text - a static per-locale map, or a per-locale builder for
     * parameterized copy. Every locale in `L` must be present or it is a compile error. Identity
     * at runtime; the overloads preserve literal/argument types.
     *
     * @param text - the {@link LanguageText} or {@link LanguageTextFn}.
     * @returns the same object, precisely typed.
     */
    defineText<const T extends LanguageText<L>>(text: T): T;
    defineText<A extends readonly unknown[]>(text: LanguageTextFn<L, A>): LanguageTextFn<L, A>;
    defineText(text: unknown): unknown {
        return text;
    }

    /**
     * Build a {@link LanguageText} whose value is identical in every locale (a brand word, a
     * symbol). Coverage is complete by construction.
     *
     * @param value - the string used for every locale.
     * @returns a {@link LanguageText} for `L`.
     */
    uniform(value: string): LanguageText<L> {
        return catalog.uniform(value, this.#codes);
    }

    // --- Resolution -----------------------------------------------------------------------------

    /**
     * Build a {@link Translator} bound to `locale` - the ergonomic path: bind once, resolve many.
     *
     * @param locale - the locale to bind.
     * @returns a translator for that locale.
     */
    translator(locale: L): Translator<L> {
        return text.createTranslator(locale);
    }

    /**
     * Resolve one static text for a locale without binding a {@link Translator}. For parameterized
     * text or repeated use, prefer {@link translator}.
     *
     * @param textValue - the {@link LanguageText} to resolve.
     * @param locale - the locale to resolve against.
     * @returns the string for that locale.
     */
    translate(textValue: LanguageText<L>, locale: L): string {
        return text.translate(textValue, locale);
    }

    // --- Detection ------------------------------------------------------------------------------

    /**
     * Narrow an untrusted value (e.g. a cookie) to a valid locale, falling back to {@link default}.
     *
     * @param raw - the candidate value.
     * @returns a guaranteed-valid locale.
     */
    resolveLocale(raw: string | undefined): L {
        return detect.resolveLocale(raw, this.list, this.default);
    }

    /**
     * Pick the best locale from an HTTP `Accept-Language` header, falling back to {@link default}.
     *
     * @param header - the raw header value (or null/undefined).
     * @returns the best supported locale.
     */
    matchAcceptLanguage(header: string | null | undefined): L {
        return detect.matchAcceptLanguage(header, this.list, this.default);
    }

    // --- Locale metadata ------------------------------------------------------------------------

    /**
     * The BCP-47 `<html lang>` subtag for a locale (e.g. `"nl"`).
     *
     * @param locale - the locale.
     * @returns its `htmlLang`.
     */
    htmlLangFor(locale: L): string {
        return this.locales[locale]?.htmlLang ?? locale;
    }

    /**
     * The full BCP-47 `Intl` formatting locale for a locale (e.g. `"nl-NL"`), for
     * `new Intl.DateTimeFormat(i18n.intlLocaleFor(locale))`.
     *
     * @param locale - the locale.
     * @returns its `Intl` locale.
     */
    intlLocaleFor(locale: L): string {
        return this.locales[locale]?.locale ?? this.htmlLangFor(locale);
    }

    // --- Routing (config-bound wrappers over the routing module) --------------------------------

    /**
     * The URL prefix for a locale: `""` for the default locale, `"/<htmlLang>"` otherwise.
     *
     * @param locale - the locale.
     * @returns the leading URL segment.
     */
    prefixFor(locale: L): string {
        return routing.prefixFor(this.#routing, locale);
    }

    /**
     * The locale a URL path segment denotes (via `htmlLang`), or null.
     *
     * @param segment - the first path segment, without slashes.
     * @returns the locale, or null.
     */
    localeForSegment(segment: string): L | null {
        return routing.localeForSegment(this.#routing, segment);
    }

    /**
     * Whether a pathname takes a locale prefix (i.e. is not under {@link nonLocalizedPrefixes}).
     *
     * @param pathname - the URL pathname.
     * @returns true when the path is localized.
     */
    isLocalizedPath(pathname: string): boolean {
        return routing.isLocalizedPath(this.#routing, pathname);
    }

    /**
     * Localize an internal href for a locale (`/pricing` -> `/nl/pricing`).
     *
     * @param href - the link target.
     * @param locale - the active locale.
     * @returns the localized href.
     */
    localizeHref(href: string, locale: L): string {
        return routing.localizeHref(this.#routing, href, locale);
    }

    /**
     * Rewrite a pathname to another locale. On a URL-routed site, wire this into the provider's
     * `onChange` to navigate a locale change (e.g. from `<LanguagePicker>`) to the target URL - the
     * cookie alone does not switch locale when the path prefix decides it.
     *
     * @param pathname - the current pathname.
     * @param next - the locale to switch to.
     * @returns the pathname in the target locale.
     */
    switchLocalePath(pathname: string, next: L): string {
        return routing.switchLocalePath(this.#routing, pathname, next);
    }

    /**
     * Strip any locale prefix from a pathname (`/nl/x` -> `/x`).
     *
     * @param pathname - the current pathname.
     * @returns the unprefixed pathname.
     */
    stripLocalePrefix(pathname: string): string {
        return routing.stripLocalePrefix(this.#routing, pathname);
    }

    /**
     * Canonical + hreflang alternates for a page (requires `origin` in the config). A non-localized
     * path yields a single canonical with only an `x-default`.
     *
     * @param path - the pathname (bare or already-locale-prefixed; it is reduced to the bare form).
     * @param locale - the active locale.
     * @returns the `{ canonical, languages }` alternates object.
     * @throws Error when the config has no `origin`.
     */
    hreflangAlternates(path: string, locale: L): { canonical: string; languages: Record<string, string> } {
        return routing.hreflangAlternates(this.#routing, path, locale);
    }
}

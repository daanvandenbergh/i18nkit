/**
 * Pure, config-driven URL-locale routing, ported from the SwiftGuard i18n core and generalized
 * over any locale set. The URL scheme is "as-needed": the default locale lives at bare URLs
 * (`/pricing`) and every other locale under its `htmlLang` prefix (`/nl/pricing`); the default
 * locale's own prefix never appears. Dependency-free (imports only `./types.js`) so it can be
 * bundled into edge middleware. Reached as instance methods (`i18n.localizeHref(...)` etc.).
 */
import type { ResolvedLocale, RoutingStrategy } from "./types.js";

/**
 * The routing configuration a routing function needs - a structural subset of an {@link I18n}
 * instance, so the instance can pass itself. Kept separate from the full config so the routing
 * functions stay usable in isolation.
 *
 * @typeParam L - the locale union.
 */
export interface RoutingConfig<L extends string> {
    /** Every resolved locale, for `htmlLang` <-> code mapping. */
    readonly locales: readonly ResolvedLocale<L>[];
    /** The default locale (served at bare URLs, no prefix). */
    readonly default: L;
    /** Path prefixes that are never localized (e.g. `["/api"]`). */
    readonly nonLocalizedPrefixes: readonly string[];
    /** The URL scheme for the default locale; see {@link RoutingStrategy}. */
    readonly strategy: RoutingStrategy;
    /** Absolute site origin for {@link hreflangAlternates} (e.g. `"https://example.com"`). */
    readonly origin?: string | undefined;
}

/**
 * Look up a locale's `htmlLang`, falling back to the code itself when unknown.
 *
 * @param config - the routing config.
 * @param locale - the locale to look up.
 * @returns the locale's `htmlLang` subtag.
 */
function htmlLangOf<L extends string>(config: RoutingConfig<L>, locale: L): string {
    return config.locales.find((info) => info.code === locale)?.htmlLang ?? locale;
}

/**
 * Whether a pathname belongs to the localized zone, i.e. is not under any
 * {@link RoutingConfig.nonLocalizedPrefixes} entry. Segment-aware: `/api` and `/api/x` are
 * non-localized, `/apis` is localized.
 *
 * @param config - the routing config.
 * @param pathname - the URL pathname (no query/hash).
 * @returns true when the path takes a locale prefix.
 */
export function isLocalizedPath<L extends string>(config: RoutingConfig<L>, pathname: string): boolean {
    return !config.nonLocalizedPrefixes.some(
        (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    );
}

/**
 * Map a URL path segment to the locale it denotes (via each locale's `htmlLang`, e.g. `"nl"`),
 * or null when the segment is not a locale.
 *
 * @param config - the routing config.
 * @param segment - the first path segment, without slashes.
 * @returns the matching locale code, or null.
 */
export function localeForSegment<L extends string>(config: RoutingConfig<L>, segment: string): L | null {
    // Compare case-insensitively so a lowercased URL (`/en-gb/x`) still matches a region-subtag
    // locale (`htmlLang: "en-GB"`), mirroring how `matchAcceptLanguage` lowercases both sides.
    const lower = segment.toLowerCase();
    return config.locales.find((info) => info.htmlLang.toLowerCase() === lower)?.code ?? null;
}

/**
 * The URL prefix for a locale: `"/<htmlLang>"` (e.g. `"/nl"`), or `""` for the default locale under
 * the `"prefix-except-default"` strategy (bare URLs). Under `"prefix-all"` the default locale is
 * prefixed too, so this never returns `""`.
 *
 * The `htmlLang` is lowercased for the URL, so a region/script-subtag locale (`htmlLang: "en-GB"`)
 * yields the conventional lowercase prefix `"/en-gb"`, matching the case-insensitive segment parsing
 * in {@link localeForSegment} (it round-trips). The document `<html lang>` value keeps its configured
 * BCP-47 casing - read that via `htmlLangFor`, not from the URL.
 *
 * @param config - the routing config.
 * @param locale - the locale.
 * @returns the leading URL segment (lowercased), or `""`.
 */
export function prefixFor<L extends string>(config: RoutingConfig<L>, locale: L): string {
    const prefixed = config.strategy === "prefix-all" || locale !== config.default;
    return prefixed ? `/${htmlLangOf(config, locale).toLowerCase()}` : "";
}

/**
 * Localize an internal href for a locale: `/pricing` -> `/nl/pricing` when `nl` is active. Passes
 * through unchanged: the default locale, hrefs that are not site-absolute (`mailto:`, `#hash`,
 * external, protocol-relative `//`), non-localized targets, and hrefs that already carry a locale
 * prefix. The prefix is inserted before the first `?` or `#`, and `"/"` becomes the bare prefix
 * (`"/nl"`, never `"/nl/"`).
 *
 * @param config - the routing config.
 * @param href - the link target as written at the call site.
 * @param locale - the active locale.
 * @returns the (possibly prefixed) href.
 */
export function localizeHref<L extends string>(config: RoutingConfig<L>, href: string, locale: L): string {
    const prefix = prefixFor(config, locale);
    if (!prefix || !href.startsWith("/") || href.startsWith("//")) {
        return href;
    }
    const queryIdx = href.indexOf("?");
    const hashIdx = href.indexOf("#");
    const stopIdx =
        queryIdx === -1 ? hashIdx : hashIdx === -1 ? queryIdx : Math.min(queryIdx, hashIdx);
    const path = stopIdx === -1 ? href : href.slice(0, stopIdx);
    const rest = stopIdx === -1 ? "" : href.slice(stopIdx);
    if (!isLocalizedPath(config, path)) {
        return href;
    }
    // `path` is guaranteed "/"-prefixed and non-empty here, so split("/")[1] is always present.
    if (localeForSegment(config, path.split("/")[1])) {
        return href;
    }
    return path === "/" ? `${prefix}${rest}` : `${prefix}${path}${rest}`;
}

/**
 * Rewrite a pathname to another locale's URL: strips any existing locale segment and applies the
 * target locale's prefix. On a URL-routed site the locale lives in the path, so wire this into the
 * provider's `onChange` to move a locale change (e.g. from `<LanguagePicker>`) onto the target URL:
 * `onChange={(next) => router.push(i18n.switchLocalePath(pathname, next))}`. Turns `/nl/pricing`
 * into `/pricing` and back.
 *
 * @param config - the routing config.
 * @param pathname - the current URL pathname.
 * @param next - the locale to switch to.
 * @returns the pathname for the same page in the target locale.
 */
export function switchLocalePath<L extends string>(
    config: RoutingConfig<L>,
    pathname: string,
    next: L,
): string {
    const stripped = stripLocalePrefix(config, pathname);
    const prefix = prefixFor(config, next);
    // A non-localized path (e.g. /api/*) never takes a locale prefix - mirror localizeHref, so
    // the picker does not navigate to a route that does not exist.
    if (!prefix || !isLocalizedPath(config, stripped)) {
        return stripped;
    }
    return stripped === "/" ? prefix : `${prefix}${stripped}`;
}

/**
 * Strip any locale prefix from a pathname (`/nl/dashboard` -> `/dashboard`, `/nl` -> `/`). Use
 * before comparing a live pathname against bare hrefs (e.g. nav active-state highlighting), or as
 * the primitive {@link switchLocalePath} builds on. Strips regardless of strategy - unlike
 * "switch to the default locale", which under `"prefix-all"` would re-apply the default's prefix.
 *
 * @param config - the routing config.
 * @param pathname - the current URL pathname.
 * @returns the pathname without its locale prefix.
 */
export function stripLocalePrefix<L extends string>(config: RoutingConfig<L>, pathname: string): string {
    const segment = pathname.split("/")[1] ?? "";
    return localeForSegment(config, segment) ? pathname.slice(segment.length + 1) || "/" : pathname;
}

/**
 * Canonical + hreflang alternates for a page, shaped to plug straight into a framework's metadata
 * (typed structurally so this module stays framework-free). The canonical is the active locale's
 * own URL; the `languages` map lists every locale by `htmlLang` plus `x-default` pointing at the
 * bare (default-locale) URL. Adding a locale extends every page's hreflang automatically.
 *
 * @param config - the routing config; its `origin` must be set.
 * @param path - the page's bare (unprefixed) pathname, e.g. `"/pricing"`.
 * @param locale - the active locale (decides the canonical).
 * @returns the `{ canonical, languages }` alternates object.
 * @throws Error when the config has no `origin`.
 */
export function hreflangAlternates<L extends string>(
    config: RoutingConfig<L>,
    path: string,
    locale: L,
): { canonical: string; languages: Record<string, string> } {
    const { origin } = config;
    if (!origin) {
        throw new Error(
            "hreflangAlternates requires `origin` to be set in the I18n config (e.g. new I18n({ ..., origin: 'https://example.com' })).",
        );
    }
    // Tolerate a caller passing the already-prefixed pathname (routers often hand you `/nl/x`):
    // reduce it to the bare form so alternates are built from a single canonical path.
    const bare = stripLocalePrefix(config, path);
    // A non-localized path has a single real URL - do not fabricate per-locale alternates for it.
    if (!isLocalizedPath(config, bare)) {
        const url = `${origin}${bare}`;
        return { canonical: url, languages: { "x-default": url } };
    }
    const urlFor = (code: L): string => {
        const prefix = prefixFor(config, code);
        // At the root, a prefixed locale is its own bare URL (`/nl`, not `/nl/`); only a locale
        // with no prefix keeps the bare `/`.
        return `${origin}${prefix}${bare === "/" && prefix ? "" : bare}`;
    };
    const languages: Record<string, string> = {};
    for (const info of config.locales) {
        languages[info.htmlLang] = urlFor(info.code);
    }
    languages["x-default"] = urlFor(config.default);
    return { canonical: urlFor(locale), languages };
}

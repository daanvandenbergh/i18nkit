/**
 * Pure locale detection, config-driven and framework-free: narrow an untrusted value (a cookie or
 * `[lang]` segment) to a real locale, and pick the best locale from an HTTP `Accept-Language`
 * header. Reached as `i18n.resolveLocale(...)` / `i18n.matchAcceptLanguage(...)`; these functions are
 * internal to the module and are not re-exported from the package entry.
 */
import type { ResolvedLocale } from "./types.js";

/**
 * Narrow an untrusted value (a cookie value, or a locale code from anywhere) to a known locale,
 * falling back to `fallback` when it is missing or unrecognized. Matches on the locale `code`
 * (exact); for matching a URL segment against a locale's `htmlLang`, use `localeForSegment` in
 * the routing module instead.
 *
 * @typeParam L - the locale union.
 * @param raw - the candidate value, e.g. from a cookie.
 * @param locales - every resolved locale of the instance.
 * @param fallback - the locale to return when `raw` is missing or unknown.
 * @returns a guaranteed-valid locale.
 */
export function resolveLocale<L extends string>(
    raw: string | undefined,
    locales: readonly ResolvedLocale<L>[],
    fallback: L,
): L {
    return locales.some((info) => info.code === raw) ? (raw as L) : fallback;
}

/**
 * Detect the best-matching locale from an HTTP `Accept-Language` header, so a first-time visitor
 * with no cookie lands in their own language. Tags are ranked by their `q` weight (default 1) and
 * matched on the primary subtag against each locale's `htmlLang` (so `en-GB` and `en-US` both
 * match `en`). Falls back to `fallback` when the header is absent or names only unsupported
 * languages.
 *
 * @typeParam L - the locale union.
 * @param header - the raw `Accept-Language` header value (or null/undefined).
 * @param locales - every resolved locale of the instance.
 * @param fallback - the locale to return when nothing matches.
 * @returns the best supported locale.
 */
export function matchAcceptLanguage<L extends string>(
    header: string | null | undefined,
    locales: readonly ResolvedLocale<L>[],
    fallback: L,
): L {
    if (!header) {
        return fallback;
    }
    const ranked = header
        .split(",")
        .map((part) => {
            const [tag, ...params] = part.trim().split(";");
            // Parameter names are case-insensitive (RFC 7231), so accept `q=` and `Q=`.
            const qParam = params.find((p) => p.trim().toLowerCase().startsWith("q="));
            const q = qParam ? Number.parseFloat(qParam.trim().slice(2)) : 1;
            const full = tag.trim().toLowerCase();
            // Clamp to the RFC 7231 range [0,1]: a malformed `q>1` (`q=1.5`, `q=1e3`) must not
            // outrank a legitimate `q=1`, and a negative q clamps to 0 (dropped by the filter
            // below). An unparseable weight (`q=abc` -> NaN) still drops the tag.
            return { full, primary: full.split("-")[0], q: Number.isNaN(q) ? 0 : Math.min(Math.max(q, 0), 1) };
        })
        .filter((entry) => entry.primary && entry.q > 0)
        .sort((a, b) => b.q - a.q);
    for (const { full, primary } of ranked) {
        // Prefer an exact tag match, so `en-GB` beats a bare `en` locale and `zh-Hant` is kept
        // distinct from `zh-Hans`; only then fall back to matching on the primary subtag (so a
        // bare `en` request still finds an `en-GB` locale).
        const exact = locales.find((info) => info.htmlLang.toLowerCase() === full);
        if (exact) {
            return exact.code;
        }
        const primaryHit = locales.find((info) => info.htmlLang.toLowerCase().split("-")[0] === primary);
        if (primaryHit) {
            return primaryHit.code;
        }
    }
    return fallback;
}

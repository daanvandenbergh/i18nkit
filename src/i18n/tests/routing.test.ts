import { describe, expect, it } from "vitest";

import { I18n } from "../index.js";

const i18n = new I18n({
    locales: { en: { label: "English" }, nl: { label: "Nederlands" } },
    default: "en",
    nonLocalizedPrefixes: ["/api", "/error-preview"],
    origin: "https://example.com",
});

describe("prefixFor", () => {
    it("is empty for the default locale and /<htmlLang> otherwise", () => {
        expect(i18n.prefixFor("en")).toBe("");
        expect(i18n.prefixFor("nl")).toBe("/nl");
    });

    it("falls back to the code itself for an unknown locale (defensive, for untyped callers)", () => {
        expect(i18n.prefixFor("xx" as "en" | "nl")).toBe("/xx");
    });
});

describe("localeForSegment", () => {
    it("maps a segment to its locale, or null", () => {
        expect(i18n.localeForSegment("nl")).toBe("nl");
        expect(i18n.localeForSegment("en")).toBe("en");
        expect(i18n.localeForSegment("pricing")).toBeNull();
    });
});

describe("isLocalizedPath", () => {
    it("excludes non-localized prefixes, segment-aware", () => {
        expect(i18n.isLocalizedPath("/pricing")).toBe(true);
        expect(i18n.isLocalizedPath("/api")).toBe(false);
        expect(i18n.isLocalizedPath("/api/users")).toBe(false);
        expect(i18n.isLocalizedPath("/apis")).toBe(true);
        expect(i18n.isLocalizedPath("/error-preview")).toBe(false);
        expect(i18n.isLocalizedPath("/error-previews")).toBe(true);
    });
});

describe("localizeHref", () => {
    it("returns the href unchanged for the default locale", () => {
        expect(i18n.localizeHref("/pricing", "en")).toBe("/pricing");
    });

    it("prefixes for a non-default locale", () => {
        expect(i18n.localizeHref("/pricing", "nl")).toBe("/nl/pricing");
    });

    it("turns the root into the bare prefix", () => {
        expect(i18n.localizeHref("/", "nl")).toBe("/nl");
    });

    it("inserts the prefix before a query or hash", () => {
        expect(i18n.localizeHref("/p?x=1", "nl")).toBe("/nl/p?x=1");
        expect(i18n.localizeHref("/p#h", "nl")).toBe("/nl/p#h");
        expect(i18n.localizeHref("/?x=1", "nl")).toBe("/nl?x=1");
    });

    it("inserts the prefix before whichever of ? or # comes first", () => {
        expect(i18n.localizeHref("/p?x=1#h", "nl")).toBe("/nl/p?x=1#h");
        expect(i18n.localizeHref("/p#h?x=1", "nl")).toBe("/nl/p#h?x=1");
    });

    it("passes through non-site, protocol-relative, and non-localized hrefs", () => {
        expect(i18n.localizeHref("mailto:a@b.com", "nl")).toBe("mailto:a@b.com");
        expect(i18n.localizeHref("//cdn.example.com/x", "nl")).toBe("//cdn.example.com/x");
        expect(i18n.localizeHref("#top", "nl")).toBe("#top");
        expect(i18n.localizeHref("/api/users", "nl")).toBe("/api/users");
    });

    it("does not double-prefix an already-localized href", () => {
        expect(i18n.localizeHref("/nl/pricing", "nl")).toBe("/nl/pricing");
    });
});

describe("switchLocalePath", () => {
    it("switches between locales, stripping any existing prefix", () => {
        expect(i18n.switchLocalePath("/nl/pricing", "en")).toBe("/pricing");
        expect(i18n.switchLocalePath("/pricing", "nl")).toBe("/nl/pricing");
    });

    it("is idempotent for the same locale", () => {
        expect(i18n.switchLocalePath("/nl/pricing", "nl")).toBe("/nl/pricing");
    });

    it("handles the roots", () => {
        expect(i18n.switchLocalePath("/nl", "en")).toBe("/");
        expect(i18n.switchLocalePath("/", "nl")).toBe("/nl");
    });

    it("does not localize a non-localized path (and recovers an accidentally-prefixed one)", () => {
        expect(i18n.switchLocalePath("/api/users", "nl")).toBe("/api/users");
        expect(i18n.switchLocalePath("/nl/api/users", "nl")).toBe("/api/users");
    });

    it("handles an empty pathname", () => {
        expect(i18n.switchLocalePath("", "nl")).toBe("/nl");
    });
});

describe("stripLocalePrefix", () => {
    it("removes any locale prefix", () => {
        expect(i18n.stripLocalePrefix("/nl/dashboard")).toBe("/dashboard");
        expect(i18n.stripLocalePrefix("/dashboard")).toBe("/dashboard");
        expect(i18n.stripLocalePrefix("/nl")).toBe("/");
    });
});

describe("hreflangAlternates", () => {
    it("builds the canonical and languages map including x-default", () => {
        const alternates = i18n.hreflangAlternates("/pricing", "nl");
        expect(alternates.canonical).toBe("https://example.com/nl/pricing");
        expect(alternates.languages).toEqual({
            en: "https://example.com/pricing",
            nl: "https://example.com/nl/pricing",
            "x-default": "https://example.com/pricing",
        });
    });

    it("handles the root path without a trailing slash for prefixed locales", () => {
        const alternates = i18n.hreflangAlternates("/", "en");
        expect(alternates.canonical).toBe("https://example.com/");
        expect(alternates.languages).toEqual({
            en: "https://example.com/",
            nl: "https://example.com/nl",
            "x-default": "https://example.com/",
        });
    });

    it("reduces an already-prefixed path to its bare form", () => {
        expect(i18n.hreflangAlternates("/nl/pricing", "nl")).toEqual(
            i18n.hreflangAlternates("/pricing", "nl"),
        );
    });

    it("returns a single canonical (no per-locale alternates) for a non-localized path", () => {
        expect(i18n.hreflangAlternates("/api/users", "nl")).toEqual({
            canonical: "https://example.com/api/users",
            languages: { "x-default": "https://example.com/api/users" },
        });
    });

    it("throws when origin is not configured", () => {
        const noOrigin = new I18n({
            locales: { en: { label: "E" }, nl: { label: "N" } },
            default: "en",
        });
        expect(() => noOrigin.hreflangAlternates("/x", "nl")).toThrow(/origin/);
    });
});

describe("prefix-all strategy", () => {
    const all = new I18n({
        locales: { en: { label: "English" }, nl: { label: "Nederlands" } },
        default: "en",
        strategy: "prefix-all",
        nonLocalizedPrefixes: ["/api"],
        origin: "https://example.com",
    });

    it("prefixes the default locale too", () => {
        expect(all.prefixFor("en")).toBe("/en");
        expect(all.prefixFor("nl")).toBe("/nl");
    });

    it("localizes the default locale's hrefs", () => {
        expect(all.localizeHref("/pricing", "en")).toBe("/en/pricing");
        expect(all.localizeHref("/pricing", "nl")).toBe("/nl/pricing");
    });

    it("turns the root into the bare prefix for the default locale", () => {
        expect(all.localizeHref("/", "en")).toBe("/en");
    });

    it("does not double-prefix an already-localized default href", () => {
        expect(all.localizeHref("/en/pricing", "en")).toBe("/en/pricing");
    });

    it("passes non-localized hrefs through unchanged", () => {
        expect(all.localizeHref("/api/users", "en")).toBe("/api/users");
    });

    it("switches between prefixed locales", () => {
        expect(all.switchLocalePath("/en/pricing", "nl")).toBe("/nl/pricing");
        expect(all.switchLocalePath("/nl/pricing", "en")).toBe("/en/pricing");
    });

    it("switches the roots", () => {
        expect(all.switchLocalePath("/en", "nl")).toBe("/nl");
        expect(all.switchLocalePath("/", "en")).toBe("/en");
    });

    it("strips any locale prefix, including the default's", () => {
        expect(all.stripLocalePrefix("/en/dashboard")).toBe("/dashboard");
        expect(all.stripLocalePrefix("/nl/dashboard")).toBe("/dashboard");
        expect(all.stripLocalePrefix("/en")).toBe("/");
    });

    it("builds hreflang alternates with a prefixed x-default", () => {
        expect(all.hreflangAlternates("/pricing", "en")).toEqual({
            canonical: "https://example.com/en/pricing",
            languages: {
                en: "https://example.com/en/pricing",
                nl: "https://example.com/nl/pricing",
                "x-default": "https://example.com/en/pricing",
            },
        });
    });

    it("handles the root path without a trailing slash for every locale", () => {
        expect(all.hreflangAlternates("/", "en")).toEqual({
            canonical: "https://example.com/en",
            languages: {
                en: "https://example.com/en",
                nl: "https://example.com/nl",
                "x-default": "https://example.com/en",
            },
        });
    });

    it("still yields a single canonical for a non-localized path", () => {
        expect(all.hreflangAlternates("/api/users", "en")).toEqual({
            canonical: "https://example.com/api/users",
            languages: { "x-default": "https://example.com/api/users" },
        });
    });
});

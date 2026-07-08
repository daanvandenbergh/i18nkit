import { describe, expect, it } from "vitest";

import { I18n } from "../index.js";

const i18n = new I18n({
    locales: { en: { label: "English", htmlLang: "en" }, nl: { label: "Nederlands", htmlLang: "nl" } },
    default: "en",
});

describe("resolveLocale", () => {
    it("passes valid locale codes through", () => {
        expect(i18n.resolveLocale("en")).toBe("en");
        expect(i18n.resolveLocale("nl")).toBe("nl");
    });

    it("falls back to the default for unknown, empty, or undefined values", () => {
        expect(i18n.resolveLocale("fr")).toBe("en");
        expect(i18n.resolveLocale("")).toBe("en");
        expect(i18n.resolveLocale(undefined)).toBe("en");
    });
});

describe("matchAcceptLanguage", () => {
    it("returns the default for null, undefined, or empty headers", () => {
        expect(i18n.matchAcceptLanguage(null)).toBe("en");
        expect(i18n.matchAcceptLanguage(undefined)).toBe("en");
        expect(i18n.matchAcceptLanguage("")).toBe("en");
    });

    it("matches on the primary subtag", () => {
        expect(i18n.matchAcceptLanguage("nl")).toBe("nl");
        expect(i18n.matchAcceptLanguage("en-US,en;q=0.9")).toBe("en");
        expect(i18n.matchAcceptLanguage("nl-NL,nl;q=0.8")).toBe("nl");
    });

    it("ranks by q-weight over listing order", () => {
        expect(i18n.matchAcceptLanguage("en;q=0.5,nl;q=0.9")).toBe("nl");
    });

    it("ignores tags with q=0", () => {
        expect(i18n.matchAcceptLanguage("nl;q=0,en;q=0.1")).toBe("en");
    });

    it("accepts a case-insensitive q parameter (Q=)", () => {
        expect(i18n.matchAcceptLanguage("en;Q=0.1,nl;q=0.9")).toBe("nl");
    });

    it("is case-insensitive", () => {
        expect(i18n.matchAcceptLanguage("NL")).toBe("nl");
        expect(i18n.matchAcceptLanguage("EN-GB")).toBe("en");
    });

    it("falls back when only unsupported languages are offered", () => {
        expect(i18n.matchAcceptLanguage("fr,de;q=0.9")).toBe("en");
    });

    it("matches a multi-part htmlLang, and a bare request falls back to its primary subtag", () => {
        const zh = new I18n({
            locales: { hant: { label: "繁體中文", htmlLang: "zh-Hant" }, en: { label: "English", htmlLang: "en" } },
            default: "en",
        });
        expect(zh.matchAcceptLanguage("zh-Hant,zh;q=0.9")).toBe("hant");
        expect(zh.matchAcceptLanguage("zh")).toBe("hant");
    });

    it("prefers an exact regional match over declaration order", () => {
        const en = new I18n({
            locales: {
                us: { label: "US English", htmlLang: "en-US" },
                gb: { label: "UK English", htmlLang: "en-GB" },
            },
            default: "us",
        });
        expect(en.matchAcceptLanguage("en-GB")).toBe("gb");
        expect(en.matchAcceptLanguage("en-US")).toBe("us");
        // A bare `en` request has no exact match, so it falls back to the first primary-subtag match.
        expect(en.matchAcceptLanguage("en")).toBe("us");
    });

    it("distinguishes script variants (zh-Hant vs zh-Hans)", () => {
        const zh = new I18n({
            locales: {
                hans: { label: "简体", htmlLang: "zh-Hans" },
                hant: { label: "繁體", htmlLang: "zh-Hant" },
            },
            default: "hans",
        });
        expect(zh.matchAcceptLanguage("zh-Hant")).toBe("hant");
        expect(zh.matchAcceptLanguage("zh-Hans")).toBe("hans");
    });

    it("treats an unparseable q weight as zero and drops the tag", () => {
        expect(i18n.matchAcceptLanguage("en;q=abc,nl;q=0.5")).toBe("nl");
    });

    it("skips entries with an empty primary subtag", () => {
        expect(i18n.matchAcceptLanguage(",nl")).toBe("nl");
    });
});

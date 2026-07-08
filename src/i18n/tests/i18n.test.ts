import { describe, expect, expectTypeOf, it } from "vitest";

import { I18n, type LanguageText, type LocaleInfo, type ResolvedLocale } from "../index.js";

const i18n = new I18n({
    locales: {
        en: { label: "English", htmlLang: "en", locale: "en-GB" },
        nl: { label: "Nederlands", htmlLang: "nl", locale: "nl-NL" },
    },
    default: "en",
});

describe("construction", () => {
    it("builds an ordered list in declaration order", () => {
        expect(i18n.list.map((entry) => entry.code)).toEqual(["en", "nl"]);
    });

    it("fully resolves each locale entry", () => {
        expect(i18n.locales.en).toEqual({ code: "en", label: "English", htmlLang: "en", locale: "en-GB" });
        expect(i18n.locales.nl).toEqual({ code: "nl", label: "Nederlands", htmlLang: "nl", locale: "nl-NL" });
    });

    it("defaults htmlLang from the key and locale from htmlLang when omitted", () => {
        const j = new I18n({
            locales: { en: { label: "English" }, pt: { label: "Português", htmlLang: "pt" } },
            default: "en",
        });
        expect(j.locales.en).toEqual({ code: "en", label: "English", htmlLang: "en", locale: "en" });
        expect(j.locales.pt).toEqual({ code: "pt", label: "Português", htmlLang: "pt", locale: "pt" });
    });

    it("exposes the default locale and the default cookie name", () => {
        expect(i18n.default).toBe("en");
        expect(i18n.cookie).toBe("locale");
    });

    it("honors a custom cookie name and origin", () => {
        const j = new I18n({
            locales: { en: { label: "E" } },
            default: "en",
            cookie: "lang",
            origin: "https://example.com",
        });
        expect(j.cookie).toBe("lang");
        expect(j.origin).toBe("https://example.com");
    });

    it("throws when no locales are declared", () => {
        expect(() => new I18n({ locales: {} as Record<string, LocaleInfo>, default: "en" })).toThrow(
            /at least one/,
        );
    });

    it("throws when the default is not one of the configured locales", () => {
        expect(
            () =>
                new I18n({
                    locales: { en: { label: "E" }, nl: { label: "N" } } as Record<string, LocaleInfo>,
                    default: "fr",
                }),
        ).toThrow(/default locale/);
    });
});

describe("metadata helpers", () => {
    it("htmlLangFor returns the BCP-47 subtag", () => {
        expect(i18n.htmlLangFor("en")).toBe("en");
        expect(i18n.htmlLangFor("nl")).toBe("nl");
    });

    it("intlLocaleFor returns the full Intl locale", () => {
        expect(i18n.intlLocaleFor("en")).toBe("en-GB");
        expect(i18n.intlLocaleFor("nl")).toBe("nl-NL");
    });

    it("falls back to the given code for an unknown locale (defensive, for untyped callers)", () => {
        expect(i18n.htmlLangFor("xx" as "en" | "nl")).toBe("xx");
        expect(i18n.intlLocaleFor("xx" as "en" | "nl")).toBe("xx");
    });
});

describe("authoring helpers", () => {
    it("defineTextCatalog returns the same object reference", () => {
        const catalog = { title: { en: "A", nl: "B" } };
        expect(i18n.defineTextCatalog(catalog)).toBe(catalog);
    });

    it("defineText returns the same object reference (static and parameterized)", () => {
        const staticText = { en: "A", nl: "B" };
        const fnText = { en: (n: number) => `${n}`, nl: (n: number) => `${n}` };
        expect(i18n.defineText(staticText)).toBe(staticText);
        expect(i18n.defineText(fnText)).toBe(fnText);
    });

    it("uniform fills every locale with the same value", () => {
        expect(i18n.uniform("Acme")).toEqual({ en: "Acme", nl: "Acme" });
    });
});

describe("type-level guarantees", () => {
    it("recovers the locale union from the instance", () => {
        expectTypeOf<keyof typeof i18n.locales>().toEqualTypeOf<"en" | "nl">();
    });

    it("uniform is a full LanguageText for the union", () => {
        expectTypeOf(i18n.uniform("x")).toEqualTypeOf<LanguageText<"en" | "nl">>();
    });

    it("list entries are ResolvedLocale for the union", () => {
        expectTypeOf(i18n.list[0]).toEqualTypeOf<ResolvedLocale<"en" | "nl">>();
    });
});

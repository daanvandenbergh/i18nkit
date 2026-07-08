import { describe, expect, it } from "vitest";

import { I18n, createTranslator, translate } from "../index.js";

const i18n = new I18n({
    locales: { en: { label: "English" }, nl: { label: "Nederlands" } },
    default: "en",
});

const TX = i18n.defineTextCatalog({
    title: { en: "Customers", nl: "Klanten" },
    greeting: { en: (name: string) => `Hi ${name}`, nl: (name: string) => `Hoi ${name}` },
    range: {
        en: (from: number, to: number, total: number) => `Showing ${from}-${to} of ${total}`,
        nl: (from: number, to: number, total: number) => `${from}-${to} van ${total} weergegeven`,
    },
});

describe("translator", () => {
    it("resolves static text for the bound locale", () => {
        expect(i18n.translator("en")(TX.title)).toBe("Customers");
        expect(i18n.translator("nl")(TX.title)).toBe("Klanten");
    });

    it("resolves single-argument parameterized text", () => {
        expect(i18n.translator("en")(TX.greeting, "Ada")).toBe("Hi Ada");
        expect(i18n.translator("nl")(TX.greeting, "Ada")).toBe("Hoi Ada");
    });

    it("resolves multi-argument parameterized text with per-locale word order", () => {
        expect(i18n.translator("en")(TX.range, 1, 20, 137)).toBe("Showing 1-20 of 137");
        expect(i18n.translator("nl")(TX.range, 1, 20, 137)).toBe("1-20 van 137 weergegeven");
    });
});

describe("translate (one-off)", () => {
    it("resolves a single static text via the instance and the standalone helper", () => {
        expect(i18n.translate(TX.title, "nl")).toBe("Klanten");
        expect(translate(TX.title, "en")).toBe("Customers");
    });
});

describe("createTranslator (standalone)", () => {
    it("binds a translator without an instance", () => {
        const translator = createTranslator<"en" | "nl">("nl");
        expect(translator(TX.title)).toBe("Klanten");
        expect(translator(TX.greeting, "Sam")).toBe("Hoi Sam");
    });
});

describe("defineText", () => {
    it("preserves argument inference on the parameterized form", () => {
        const greet = i18n.defineText({
            en: (name: string) => `Hi ${name}`,
            nl: (name: string) => `Hoi ${name}`,
        });
        expect(i18n.translator("en")(greet, "Ada")).toBe("Hi Ada");
    });
});

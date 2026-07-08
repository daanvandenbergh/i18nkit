import { describe, expect, it } from "vitest";

import * as root from "../index.js";
import { I18n } from "../index.js";

/**
 * The root `.` entry (src/index.ts) re-exports the i18n core. This pins that its runtime surface
 * stays wired up, so a broken barrel fails a test rather than only surfacing to consumers.
 */
describe("root barrel (. entry)", () => {
    it("re-exports the i18n core runtime surface", () => {
        expect(typeof root.I18n).toBe("function");
        expect(typeof root.createTranslator).toBe("function");
        expect(typeof root.translate).toBe("function");
    });

    it("constructs a working instance through the root export", () => {
        const i18n = new I18n({ locales: { en: { label: "English" } }, default: "en" });
        expect(i18n.default).toBe("en");
        expect(i18n.translate({ en: "Hi" }, "en")).toBe("Hi");
    });
});

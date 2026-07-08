// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { I18n } from "../../i18n/index.js";
import { Flag, I18nProvider, LanguagePicker, localeFlag } from "../index.js";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(() => {
    act(() => root.unmount());
    container.remove();
});

/** Render a node into the test root. */
function render(node: React.ReactNode): void {
    act(() => root.render(node));
}

/** The rendered `<svg>` for a locale's flag, or null when none is drawn. */
function flagSvg(code: string): SVGSVGElement | null {
    render(<Flag code={code} />);
    return container.querySelector("svg");
}

describe("Flag", () => {
    it("draws a flag for a bare language code via its conventional region", () => {
        // en -> United Kingdom (the Union Jack has several distinct paths).
        const svg = flagSvg("en");
        expect(svg).not.toBeNull();
        expect(svg?.querySelectorAll("rect").length ?? 0).toBeGreaterThan(0);
    });

    it("draws a flag for every region in the built-in set", () => {
        const regions = [
            "gb", "us", "nl", "de", "ru", "hu", "bg", "at", "lt", "ee", "pl", "ua", "id",
            "lv", "es", "th", "fr", "it", "ie", "be", "ro", "se", "dk", "fi", "no", "is",
            "pt", "cz", "gr", "ch", "jp", "cn", "vn", "tr", "kr", "in", "il", "br",
        ];
        for (const region of regions) {
            // A locale like "xx-<region>" forces resolution by the explicit region subtag.
            const svg = flagSvg(`xx-${region}`);
            expect(svg, `expected a flag for region ${region}`).not.toBeNull();
        }
    });

    it("prefers an explicit region subtag over the language default", () => {
        // pt -> Portugal (green/red), pt-BR -> Brazil (a yellow rhombus over green).
        const pt = flagSvg("pt");
        expect(pt?.querySelector('rect[fill="#046A38"]')).not.toBeNull();
        const br = flagSvg("pt-BR");
        expect(br?.querySelector('path[fill="#FFDF00"]')).not.toBeNull();
    });

    it("falls back to the language default when the region has no flag", () => {
        // es-MX: no Mexico flag -> Spanish default (Spain), so a flag still renders.
        expect(flagSvg("es-MX")).not.toBeNull();
        // en-CA: no Canada flag -> English default (United Kingdom).
        expect(flagSvg("en-CA")).not.toBeNull();
    });

    it("handles underscores and script subtags", () => {
        expect(flagSvg("en_US")).not.toBeNull();
        // zh-Hans-CN: script subtag skipped, region cn used.
        expect(flagSvg("zh-Hans-CN")).not.toBeNull();
        // zh-Hant: no region -> Chinese default (China).
        expect(flagSvg("zh-Hant")).not.toBeNull();
    });

    it("renders nothing for a locale with no known flag", () => {
        expect(flagSvg("xx")).toBeNull();
        expect(flagSvg("sr")).toBeNull();
        expect(flagSvg("qya-ZZ")).toBeNull();
    });
});

describe("localeFlag", () => {
    it("returns a flag node for a known locale and null for an unknown one", () => {
        expect(localeFlag("fr")).not.toBeNull();
        expect(localeFlag("xx")).toBeNull();
    });

    it("wires into the picker so known locales get a flag and unknown ones do not", () => {
        const i18n = new I18n({
            locales: { en: { label: "English" }, xx: { label: "Klingon" } },
            default: "en",
        });
        render(
            <I18nProvider i18n={i18n} locale="en">
                <LanguagePicker renderFlag={localeFlag} />
            </I18nProvider>,
        );
        // Trigger (active locale "en") shows a flag.
        expect(container.querySelector(".i18nkit-picker__trigger .i18nkit-picker__flag svg")).not.toBeNull();
        act(() => container.querySelector<HTMLElement>(".i18nkit-picker__trigger")?.click());
        const items = [...container.querySelectorAll<HTMLElement>(".i18nkit-picker__item")];
        expect(items).toHaveLength(2);
        const en = items.find((i) => i.textContent?.includes("English"));
        const xx = items.find((i) => i.textContent?.includes("Klingon"));
        // "en" draws a flag; the unknown "xx" draws no flag span at all.
        expect(en?.querySelector(".i18nkit-picker__flag svg")).not.toBeNull();
        expect(xx?.querySelector(".i18nkit-picker__flag")).toBeNull();
    });
});

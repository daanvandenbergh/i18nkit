// @vitest-environment jsdom
import { act } from "react";
import type { ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { I18n } from "../../i18n/index.js";
import { I18nProvider, useI18n, useLocale, useSetLocale, useTranslator } from "../index.js";

// Silence React's "not configured to support act" warning.
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const i18n = new I18n({
    locales: { en: { label: "English" }, nl: { label: "Nederlands" } },
    default: "en",
});
const TX = i18n.defineTextCatalog({ hi: { en: "Hi", nl: "Hoi" } });

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
    document.cookie = "locale=; max-age=0; path=/";
});

/** Render an element into the test root, flushing effects. */
function render(element: ReactElement): void {
    act(() => root.render(element));
}

describe("hooks outside a provider", () => {
    it("throw a clear error", () => {
        function Probe(): null {
            useLocale();
            return null;
        }
        const spy = vi.spyOn(console, "error").mockImplementation(() => {});
        expect(() => render(<Probe />)).toThrow(/I18nProvider/);
        spy.mockRestore();
    });
});

describe("provided values", () => {
    it("exposes the active locale and a translator bound to it", () => {
        let seenLocale = "";
        let seenHi = "";
        function Probe(): null {
            seenLocale = useLocale();
            seenHi = useTranslator()(TX.hi);
            return null;
        }
        render(
            <I18nProvider i18n={i18n} locale="nl">
                <Probe />
            </I18nProvider>,
        );
        expect(seenLocale).toBe("nl");
        expect(seenHi).toBe("Hoi");
    });

    it("exposes the instance via useI18n", () => {
        let seen: I18n<string> | null = null;
        function Probe(): null {
            seen = useI18n();
            return null;
        }
        render(
            <I18nProvider i18n={i18n} locale="en">
                <Probe />
            </I18nProvider>,
        );
        expect(seen).toBe(i18n);
    });
});

describe("setLocale", () => {
    it("writes the locale cookie and calls onChange", () => {
        const onChange = vi.fn();
        let setLocale: (next: string) => void = () => {};
        function Probe(): null {
            setLocale = useSetLocale();
            return null;
        }
        render(
            <I18nProvider i18n={i18n} locale="en" onChange={onChange}>
                <Probe />
            </I18nProvider>,
        );
        act(() => setLocale("nl"));
        expect(document.cookie).toContain("locale=nl");
        expect(onChange).toHaveBeenCalledWith("nl");
    });

    it("is a no-op when the locale is unchanged", () => {
        const onChange = vi.fn();
        let setLocale: (next: string) => void = () => {};
        function Probe(): null {
            setLocale = useSetLocale();
            return null;
        }
        render(
            <I18nProvider i18n={i18n} locale="en" onChange={onChange}>
                <Probe />
            </I18nProvider>,
        );
        act(() => setLocale("en"));
        expect(onChange).not.toHaveBeenCalled();
        expect(document.cookie).not.toContain("locale=");
    });
});

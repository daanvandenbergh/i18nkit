// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { I18n } from "../../i18n/index.js";
import { I18nProvider, LanguagePicker } from "../index.js";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const i18n = new I18n({
    locales: { en: { label: "English" }, nl: { label: "Nederlands" } },
    default: "en",
});

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

/** Mount the picker inside a provider with the given active locale + onChange. */
function mount(locale: "en" | "nl", onChange: (next: "en" | "nl") => void): void {
    act(() =>
        root.render(
            <I18nProvider i18n={i18n} locale={locale} onChange={onChange}>
                <LanguagePicker />
            </I18nProvider>,
        ),
    );
}

/** Query one element inside the picker, asserting it exists. */
function query(selector: string): HTMLElement {
    const el = container.querySelector<HTMLElement>(selector);
    if (!el) {
        throw new Error(`expected to find "${selector}"`);
    }
    return el;
}

function openPanel(): void {
    act(() => query(".i18nkit-picker__trigger").click());
}

describe("LanguagePicker", () => {
    it("shows the active locale label on the trigger and starts closed", () => {
        mount("en", () => {});
        expect(query(".i18nkit-picker__current").textContent).toBe("English");
        expect(container.querySelector(".i18nkit-picker__panel")).toBeNull();
    });

    it("opens on click and lists every locale with the active one marked current", () => {
        mount("nl", () => {});
        openPanel();
        const items = container.querySelectorAll<HTMLElement>(".i18nkit-picker__item");
        expect(items).toHaveLength(2);
        expect([...items].map((i) => i.querySelector(".i18nkit-picker__label")?.textContent)).toEqual([
            "English",
            "Nederlands",
        ]);
        const current = [...items].filter((i) => i.getAttribute("aria-current") === "true");
        expect(current).toHaveLength(1);
        expect(current[0]?.textContent).toContain("Nederlands");
    });

    it("gives the trigger an accessible name with the active locale, and labels the list", () => {
        mount("nl", () => {});
        expect(query(".i18nkit-picker__trigger").getAttribute("aria-label")).toBe(
            "Change language: Nederlands",
        );
        openPanel();
        const panel = query(".i18nkit-picker__panel");
        expect(panel.getAttribute("role")).toBe("group");
        expect(panel.getAttribute("aria-label")).toBe("Change language");
    });

    it("is a disclosure, not a menu: no aria-haspopup promising menu semantics it lacks", () => {
        mount("en", () => {});
        // The panel is a role="group" of buttons (arrow-key menu nav is not implemented), so the
        // trigger must not advertise aria-haspopup (== "menu") - only aria-expanded/aria-controls.
        expect(query(".i18nkit-picker__trigger").hasAttribute("aria-haspopup")).toBe(false);
    });

    it("reflects open state on the trigger's aria-expanded", () => {
        mount("en", () => {});
        expect(query(".i18nkit-picker__trigger").getAttribute("aria-expanded")).toBe("false");
        openPanel();
        expect(query(".i18nkit-picker__trigger").getAttribute("aria-expanded")).toBe("true");
    });

    it("applies a custom className and toggles closed on a second trigger click", () => {
        act(() =>
            root.render(
                <I18nProvider i18n={i18n} locale="en">
                    <LanguagePicker className="custom" />
                </I18nProvider>,
            ),
        );
        expect(container.querySelector(".i18nkit-picker.custom")).not.toBeNull();
        openPanel();
        expect(container.querySelector(".i18nkit-picker__panel")).not.toBeNull();
        act(() => query(".i18nkit-picker__trigger").click());
        expect(container.querySelector(".i18nkit-picker__panel")).toBeNull();
    });

    it("calls onChange with the chosen locale and closes", () => {
        const onChange = vi.fn();
        mount("en", onChange);
        openPanel();
        const nlItem = [...container.querySelectorAll<HTMLElement>(".i18nkit-picker__item")].find((i) =>
            i.textContent?.includes("Nederlands"),
        );
        act(() => nlItem?.click());
        expect(onChange).toHaveBeenCalledWith("nl");
        expect(container.querySelector(".i18nkit-picker__panel")).toBeNull();
    });

    it("closes on Escape", () => {
        mount("en", () => {});
        openPanel();
        expect(container.querySelector(".i18nkit-picker__panel")).not.toBeNull();
        act(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })));
        expect(container.querySelector(".i18nkit-picker__panel")).toBeNull();
    });

    it("closes on an outside pointer-down", () => {
        mount("en", () => {});
        openPanel();
        expect(container.querySelector(".i18nkit-picker__panel")).not.toBeNull();
        act(() => document.body.dispatchEvent(new Event("pointerdown", { bubbles: true })));
        expect(container.querySelector(".i18nkit-picker__panel")).toBeNull();
    });

    it("shows the raw code for an unknown active locale and hides an empty heading", () => {
        act(() =>
            root.render(
                <I18nProvider i18n={i18n} locale={"xx" as "en" | "nl"}>
                    <LanguagePicker headingLabel="" />
                </I18nProvider>,
            ),
        );
        expect(query(".i18nkit-picker__current").textContent).toBe("xx");
        openPanel();
        expect(container.querySelector(".i18nkit-picker__heading")).toBeNull();
    });

    it("stays open on a pointer-down inside the picker", () => {
        mount("en", () => {});
        openPanel();
        act(() =>
            query(".i18nkit-picker__panel").dispatchEvent(new Event("pointerdown", { bubbles: true })),
        );
        expect(container.querySelector(".i18nkit-picker__panel")).not.toBeNull();
    });

    it("returns focus to the trigger on Escape and on selecting a locale", () => {
        mount("en", () => {});
        openPanel();
        act(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })));
        expect(document.activeElement).toBe(query(".i18nkit-picker__trigger"));

        openPanel();
        const nlItem = [...container.querySelectorAll<HTMLElement>(".i18nkit-picker__item")].find((i) =>
            i.textContent?.includes("Nederlands"),
        );
        act(() => nlItem?.click());
        expect(document.activeElement).toBe(query(".i18nkit-picker__trigger"));
    });

    it("prepends a flag on the trigger and on every open list item when renderFlag is provided", () => {
        act(() =>
            root.render(
                <I18nProvider i18n={i18n} locale="en">
                    <LanguagePicker renderFlag={(l) => <i data-flag={l} />} />
                </I18nProvider>,
            ),
        );
        expect(
            query(".i18nkit-picker__trigger .i18nkit-picker__flag i").getAttribute("data-flag"),
        ).toBe("en");
        openPanel();
        const itemFlags = [
            ...container.querySelectorAll<HTMLElement>(".i18nkit-picker__panel .i18nkit-picker__flag i"),
        ];
        expect(itemFlags.map((f) => f.getAttribute("data-flag"))).toEqual(["en", "nl"]);
    });
});

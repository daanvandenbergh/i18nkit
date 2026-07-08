// @vitest-environment jsdom
import { act, createElement } from "react";
import type { ReactElement, ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { I18n } from "../../i18n/index.js";
import { I18nProvider, LocaleLink } from "../index.js";

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
});

/** Mount a node inside a provider at the given active locale. */
function mount(locale: "en" | "nl", node: ReactNode): void {
    act(() =>
        root.render(
            <I18nProvider i18n={i18n} locale={locale}>
                {node}
            </I18nProvider>,
        ),
    );
}

describe("LocaleLink", () => {
    it("renders a plain anchor with the href unchanged for the default locale", () => {
        mount("en", <LocaleLink href="/pricing">Pricing</LocaleLink>);
        const anchor = container.querySelector("a");
        expect(anchor?.getAttribute("href")).toBe("/pricing");
        expect(anchor?.textContent).toBe("Pricing");
    });

    it("localizes the href for a non-default locale", () => {
        mount("nl", <LocaleLink href="/pricing">Pricing</LocaleLink>);
        expect(container.querySelector("a")?.getAttribute("href")).toBe("/nl/pricing");
    });

    it("passes through className and data attributes", () => {
        mount("nl", (
            <LocaleLink href="/x" className="nav" data-test="1">
                X
            </LocaleLink>
        ));
        const anchor = container.querySelector("a");
        expect(anchor?.getAttribute("class")).toBe("nav");
        expect(anchor?.getAttribute("data-test")).toBe("1");
    });

    it("renders a custom component via `as`, passing it the localized href", () => {
        function Custom({ href, children }: { href?: string; children?: ReactNode }): ReactElement {
            return createElement("button", { "data-href": href }, children);
        }
        mount("nl", (
            <LocaleLink href="/pricing" as={Custom}>
                Go
            </LocaleLink>
        ));
        const button = container.querySelector("button");
        expect(button?.getAttribute("data-href")).toBe("/nl/pricing");
        expect(button?.textContent).toBe("Go");
    });
});

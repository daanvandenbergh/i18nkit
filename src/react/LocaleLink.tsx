"use client";

/**
 * A locale-aware link: a link written `href="/pricing"` on a `/nl/...` page renders as
 * `/nl/pricing`, following the active locale. Localizes the href through the active
 * {@link I18n} instance's `localizeHref`, then renders a plain `<a>` by default - or any framework
 * link component passed via `as` (Next's `Link`, Astro's `<a>`, etc.), which receives the localized
 * value as its `href` prop.
 */
import { createElement } from "react";
import type { AnchorHTMLAttributes, ElementType, ReactElement } from "react";

import { useI18n, useLocale } from "./provider.js";

/**
 * Props for {@link LocaleLink}: every standard anchor attribute (except `href`, which is
 * localized) plus the polymorphic `as`.
 */
export interface LocaleLinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
    /** The link target, written unprefixed (e.g. `"/pricing"`); localized to the active locale. */
    href: string;
    /**
     * The component to render. Defaults to `"a"`. Pass your framework's link component; it receives
     * the localized value as its `href` prop and all other props unchanged.
     */
    as?: ElementType | undefined;
}

/**
 * Render a locale-aware link.
 *
 * @param props - see {@link LocaleLinkProps}.
 * @returns the rendered link element.
 */
export function LocaleLink({ href, as, ...rest }: LocaleLinkProps): ReactElement {
    const i18n = useI18n();
    const locale = useLocale();
    const localized = i18n.localizeHref(href, locale);
    const Component: ElementType = as ?? "a";
    return createElement(Component, { href: localized, ...rest });
}

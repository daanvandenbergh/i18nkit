"use client";

/**
 * The React seam. `I18nProvider` carries the active locale (resolved however the app likes -
 * from the URL, a cookie, or the server) down to descendants, which read it via {@link useLocale}
 * / {@link useTranslator} and change it via {@link useSetLocale}.
 *
 * This layer is framework-agnostic: it never imports `next/*`. Navigation on locale change is the
 * app's concern, injected through the provider's `onChange` prop (e.g. a Next `router.refresh`, a
 * React Router navigate, or a full reload). The provider does persist the choice to the configured
 * cookie first, so a server resolver sees it before any navigation the app triggers.
 */
import { createContext, useContext, useMemo, useRef } from "react";
import type { ReactElement, ReactNode } from "react";

import type { I18n, Translator } from "../i18n/index.js";

/**
 * The value carried by the i18n context. The locale union is erased to `string` here (a React
 * context cannot be generic); the hooks re-apply a caller-supplied union. Precise per-catalog
 * coverage is enforced at authoring time by `i18n.defineTextCatalog`, not here.
 */
interface I18nContextValue {
    /** The active {@link I18n} instance (locale union erased). */
    i18n: I18n<string>;
    /** The active locale for this render. */
    locale: string;
    /** A {@link Translator} bound to the active locale. */
    translator: Translator<string>;
    /** Persist and request a locale change. */
    setLocale: (next: string) => void;
}

const I18nContext = createContext<I18nContextValue | null>(null);

/**
 * Props for {@link I18nProvider}.
 *
 * @typeParam L - the app's locale union (inferred from `i18n`).
 */
export interface I18nProviderProps<L extends string> {
    /** The app's {@link I18n} instance. */
    i18n: I18n<L>;
    /** The active locale for this render (the single source of truth). */
    locale: L;
    /**
     * Called after the locale cookie is written when the user picks a new locale. Do the app's
     * navigation here. On a URL-routed site (the locale lives in the path) you MUST navigate to the
     * new locale's URL - `onChange={(next) => router.push(i18n.switchLocalePath(pathname, next))}` -
     * because the path prefix, not the cookie, decides the locale, so a bare `router.refresh()` /
     * `location.reload()` would reload the same URL and not switch. Only a cookie-only site (no
     * locale in the URL) can use a plain refresh/reload, which re-reads the cookie. Optional.
     */
    onChange?: ((next: L) => void) | undefined;
    /** The subtree that can read the locale. */
    children: ReactNode;
}

/**
 * Provide the active locale to a subtree.
 *
 * @typeParam L - the app's locale union.
 * @param props - see {@link I18nProviderProps}.
 * @returns the provider element.
 */
export function I18nProvider<L extends string>({
    i18n,
    locale,
    onChange,
    children,
}: I18nProviderProps<L>): ReactElement {
    // Hold `onChange` in a ref so an inline prop (a new identity each render) does not bust the
    // memo below and re-render every consumer.
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;
    const value = useMemo<I18nContextValue>(
        () => ({
            i18n: i18n as I18n<string>,
            locale,
            translator: i18n.translator(locale) as Translator<string>,
            setLocale: (next: string): void => {
                if (next === locale) {
                    return;
                }
                if (typeof document !== "undefined") {
                    // Encode the value defensively; a valid BCP-47 locale is unchanged, but an app
                    // may forward unvalidated input, and a raw `;` would inject cookie attributes.
                    document.cookie = `${i18n.cookie}=${encodeURIComponent(next)}; path=/; max-age=31536000; samesite=lax`;
                }
                onChangeRef.current?.(next as L);
            },
        }),
        [i18n, locale],
    );
    return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/**
 * Read the i18n context, throwing a clear error when used outside an {@link I18nProvider}.
 *
 * @returns the context value.
 */
function useI18nContext(): I18nContextValue {
    const ctx = useContext(I18nContext);
    if (!ctx) {
        throw new Error("i18nkit: hooks must be used within <I18nProvider>.");
    }
    return ctx;
}

/**
 * The active {@link I18n} instance. Handy for reading `i18n.list`, routing helpers, etc. in a
 * component. Pass your `Locale` union as the type argument to recover the precise instance type.
 *
 * @typeParam L - the app's locale union (defaults to `string`).
 * @returns the instance.
 */
export function useI18n<L extends string = string>(): I18n<L> {
    return useI18nContext().i18n as I18n<L>;
}

/**
 * The active locale. Pass your `Locale` union as the type argument for a precise return type.
 *
 * @typeParam L - the app's locale union (defaults to `string`).
 * @returns the active locale.
 */
export function useLocale<L extends string = string>(): L {
    return useI18nContext().locale as L;
}

/**
 * A {@link Translator} bound to the active locale: `const translate = useTranslator();`, then
 * `translate(TX.title)`.
 *
 * @typeParam L - the app's locale union (defaults to `string`).
 * @returns the translator.
 */
export function useTranslator<L extends string = string>(): Translator<L> {
    return useI18nContext().translator as Translator<L>;
}

/**
 * The locale setter: persists the choice to the cookie and runs the provider's `onChange`.
 *
 * @typeParam L - the app's locale union (defaults to `string`).
 * @returns a function that switches the active locale.
 */
export function useSetLocale<L extends string = string>(): (next: L) => void {
    return useI18nContext().setLocale as (next: L) => void;
}

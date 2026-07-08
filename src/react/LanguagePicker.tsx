"use client";

/**
 * A self-contained, accessible locale dropdown: its own open state, click-away, and Escape
 * handling, so it drops into any client surface. Reads the active locale and the locale list from
 * the {@link I18nProvider} context and switches via {@link useSetLocale}.
 *
 * Framework-agnostic: it shows each locale's endonym label by default. Pass `renderFlag` to prepend
 * a flag node per locale - use the shipped {@link localeFlag} for the built-in flag set
 * (`renderFlag={localeFlag}`) or supply your own. A `renderFlag` that returns `null` for a locale
 * (as `localeFlag` does for locales without a known flag) simply shows no flag for it. Style it with
 * the shipped stylesheet (`import "@daanvandenbergh/i18nkit/styles.css"`), fully overridable through
 * its `--i18nkit-*` CSS custom properties.
 */
import { useEffect, useId, useRef, useState } from "react";
import type { ReactElement, ReactNode } from "react";

import { useI18n, useLocale, useSetLocale } from "./provider.js";

/**
 * Props for {@link LanguagePicker}. All optional - `<LanguagePicker />` works out of the box.
 */
export interface LanguagePickerProps {
    /** Accessible name for the trigger button. Default `"Change language"`. */
    changeLanguageLabel?: string | undefined;
    /** Heading shown above the locale list; pass `""` to hide it. Default `"Language"`. */
    headingLabel?: string | undefined;
    /** Render a flag (or any node) for a locale code, shown before its label. Default: none. */
    renderFlag?: ((locale: string) => ReactNode) | undefined;
    /** Extra class name added to the wrapper, for positioning/scoping. */
    className?: string | undefined;
}

/**
 * Render the language picker.
 *
 * @param props - see {@link LanguagePickerProps}.
 * @returns the picker control.
 */
export function LanguagePicker({
    changeLanguageLabel = "Change language",
    headingLabel = "Language",
    renderFlag,
    className,
}: LanguagePickerProps = {}): ReactElement {
    const i18n = useI18n();
    const locale = useLocale();
    const setLocale = useSetLocale();
    const [open, setOpen] = useState(false);
    const wrapRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const menuId = useId();

    // Dismiss on outside pointer-down or Escape while open. Escape returns focus to the trigger
    // (keyboard dismissal); an outside pointer-down leaves focus wherever the user clicked.
    useEffect(() => {
        if (!open) {
            return;
        }
        function onPointerDown(event: PointerEvent): void {
            if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) {
                setOpen(false);
            }
        }
        function onKey(event: KeyboardEvent): void {
            if (event.key === "Escape") {
                setOpen(false);
                triggerRef.current?.focus();
            }
        }
        document.addEventListener("pointerdown", onPointerDown);
        window.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("pointerdown", onPointerDown);
            window.removeEventListener("keydown", onKey);
        };
    }, [open]);

    /** Selects a locale, closes the list, and returns focus to the trigger. */
    function choose(code: string): void {
        setLocale(code);
        setOpen(false);
        triggerRef.current?.focus();
    }

    const active = i18n.locales[locale];
    const activeLabel = active ? active.label : locale;
    const triggerFlag = renderFlag ? renderFlag(locale) : null;

    return (
        <div className={className ? `i18nkit-picker ${className}` : "i18nkit-picker"} ref={wrapRef}>
            <button
                type="button"
                ref={triggerRef}
                className="i18nkit-picker__trigger"
                onClick={() => setOpen((v) => !v)}
                aria-label={`${changeLanguageLabel}: ${activeLabel}`}
                aria-haspopup="true"
                aria-expanded={open}
                aria-controls={open ? menuId : undefined}
            >
                {triggerFlag ? <span className="i18nkit-picker__flag">{triggerFlag}</span> : null}
                <span className="i18nkit-picker__current">{activeLabel}</span>
                <svg
                    className={
                        open
                            ? "i18nkit-picker__caret i18nkit-picker__caret--open"
                            : "i18nkit-picker__caret"
                    }
                    width={10}
                    height={10}
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden
                    focusable={false}
                >
                    <path
                        d="M6 9l6 6 6-6"
                        stroke="currentColor"
                        strokeWidth={2.2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                </svg>
            </button>

            {open ? (
                <div
                    className="i18nkit-picker__panel"
                    id={menuId}
                    role="group"
                    aria-label={changeLanguageLabel}
                >
                    {headingLabel ? <div className="i18nkit-picker__heading">{headingLabel}</div> : null}
                    {i18n.list.map((info) => {
                        const itemFlag = renderFlag ? renderFlag(info.code) : null;
                        return (
                        <button
                            key={info.code}
                            type="button"
                            className="i18nkit-picker__item"
                            aria-current={info.code === locale ? "true" : undefined}
                            onClick={() => choose(info.code)}
                        >
                            {itemFlag ? (
                                <span className="i18nkit-picker__flag">{itemFlag}</span>
                            ) : null}
                            <span className="i18nkit-picker__label">{info.label}</span>
                            {info.code === locale ? (
                                <svg
                                    className="i18nkit-picker__check"
                                    width={16}
                                    height={16}
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    aria-hidden
                                    focusable={false}
                                >
                                    <path
                                        d="M20 6L9 17l-5-5"
                                        stroke="currentColor"
                                        strokeWidth={2.4}
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />
                                </svg>
                            ) : null}
                        </button>
                        );
                    })}
                </div>
            ) : null}
        </div>
    );
}

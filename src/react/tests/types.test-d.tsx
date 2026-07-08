/**
 * Type-safety regression tests for the React adapter. Validated by `tsc` (`npm run typecheck`),
 * not run by vitest. See `src/i18n/tests/types.test-d.ts` for the mechanism.
 */
import { I18n } from "../../i18n/index.js";
import { I18nProvider, LocaleLink } from "../index.js";

const i18n = new I18n({
    locales: { en: { label: "English" }, nl: { label: "Nederlands" } },
    default: "en",
});

// OK: locale and onChange are constrained to the instance's union.
const valid = (
    <I18nProvider i18n={i18n} locale="en" onChange={(next) => next.padStart(2)}>
        <span />
    </I18nProvider>
);

const badLocale = (
    // @ts-expect-error - "de" is not a locale of this I18n<"en" | "nl"> instance
    <I18nProvider i18n={i18n} locale="de">
        <span />
    </I18nProvider>
);

// OK: a localized link with a valid href.
const link = <LocaleLink href="/pricing">Pricing</LocaleLink>;

// @ts-expect-error - href is required
const linkWithoutHref = <LocaleLink>Pricing</LocaleLink>;

void valid;
void badLocale;
void link;
void linkWithoutHref;

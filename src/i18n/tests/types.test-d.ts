/**
 * Type-safety regression tests. These are validated by `tsc` (`npm run typecheck`), NOT run by
 * vitest (the `.test-d.ts` name is excluded from the vitest glob on purpose).
 *
 * Each `@ts-expect-error` asserts that an invalid construct is rejected by the compiler. If the
 * type-safety guarantee ever regresses, the expected error disappears, `tsc` reports the now-unused
 * `@ts-expect-error` directive, and `typecheck` fails - so the guarantee tests itself.
 *
 * KNOWN GAPS (inherent to the design; the load-bearing guarantee - "a MISSING translation always
 * errors", so adding a locale errors every incomplete catalog - holds fully and is what the cases
 * below pin down):
 *   1. A *typo'd* (unknown) locale key inside `defineTextCatalog`/`defineText` is NOT flagged -
 *      generic constraint satisfaction does not run excess-property checks.
 *   2. Per-locale builders of one entry may have *inconsistent argument signatures* (e.g. `en`
 *      takes two args, `nl` takes one); each arm is typed independently. The resolved call type is
 *      the intersection, so a caller is still checked - only the author is not forced into parity.
 *   3. The React hooks default their type parameter to `string` (`useTranslator()` -> `Translator<string>`),
 *      which is intentionally permissive; pass your `Locale` union (`useTranslator<Locale>()`) for the
 *      precise type. Authoring safety lives at `defineTextCatalog`/`defineText`, not at the hook.
 */
import { I18n } from "../index.js";

const i18n = new I18n({
    locales: { en: { label: "English" }, nl: { label: "Nederlands" } },
    default: "en",
});

// --- defineTextCatalog: every entry must cover every locale ---------------------------------------

// OK: a complete catalog compiles.
i18n.defineTextCatalog({ title: { en: "Customers", nl: "Klanten" } });

i18n.defineTextCatalog({
    // @ts-expect-error - entry is missing the `nl` translation
    title: { en: "Customers" },
});

i18n.defineTextCatalog({
    // @ts-expect-error - entry is missing the `en` translation
    subtitle: { nl: "Klanten" },
});

// --- defineText: static and parameterized both require full coverage ------------------------------

// OK: complete static and parameterized texts.
i18n.defineText({ en: "Hi", nl: "Hoi" });
const greet = i18n.defineText({ en: (n: string) => `Hi ${n}`, nl: (n: string) => `Hoi ${n}` });

// @ts-expect-error - missing the `nl` translation
i18n.defineText({ en: "Hi" });

// @ts-expect-error - parameterized text missing the `nl` builder
i18n.defineText({ en: (n: string) => `Hi ${n}` });

// --- Translator: argument inference on parameterized text -----------------------------------------

const translate = i18n.translator("en");
translate(greet, "Ada"); // OK

// @ts-expect-error - wrong argument type (number, expected string)
translate(greet, 123);

// @ts-expect-error - missing the required argument
translate(greet);

// --- Only declared locales are accepted where a locale is expected --------------------------------

// @ts-expect-error - "de" is not a declared locale
i18n.translator("de");

// @ts-expect-error - "de" is not a declared locale
i18n.htmlLangFor("de");

// @ts-expect-error - "de" is not a declared locale
i18n.translate({ en: "a", nl: "b" }, "de");

// --- Adding a locale errors every catalog still missing it ----------------------------------------

const trilingual = new I18n({
    locales: { en: { label: "English" }, nl: { label: "Nederlands" }, de: { label: "Deutsch" } },
    default: "en",
});

trilingual.defineTextCatalog({
    // @ts-expect-error - the three-locale instance now requires a `de` translation
    title: { en: "Customers", nl: "Klanten" },
});

// --- Routing strategy: only the two declared literals are accepted --------------------------------

// OK: a declared strategy compiles.
new I18n({ locales: { en: { label: "English" } }, default: "en", strategy: "prefix-all" });

new I18n({
    locales: { en: { label: "English" } },
    default: "en",
    // @ts-expect-error - "nonsense" is not a RoutingStrategy
    strategy: "nonsense",
});

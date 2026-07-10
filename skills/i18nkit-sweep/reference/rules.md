# i18nkit-sweep rules - what is a violation, what is not

This is the adjudicator for the sweep. A **violation** is any *user-facing text* in the project's
source that reaches the UI as a bare string instead of being resolved through an i18nkit
translator. The whole point of the system: the locale set is a union `L` (inferred from the keys of
`new I18n({ locales })`) and `LanguageText<L>` is a **mapped type over `L`**, so adding a locale
turns every un-translated entry into a compile error. A bare literal silently escapes that
guarantee - so it is a bug, always. There is no linter for this by design; this sweep is the
enforcement.

## The one question that decides every case

> **If the project shipped one more locale tomorrow, would this exact string have to change?**

- **Yes** -> it is user-facing copy and MUST be a `LanguageText<L>` / `LanguageTextFn<L, A>` resolved
  via a translator. If it is a bare literal, it is a **violation**.
- **No** (it is a name, URL, enum value, CSS class, id, dev-only error, log line, or other
  machine/data string) -> not copy, **not a violation**. Do not flag it.

When genuinely unsure, keep the finding but mark `confidence: low` and say why - the aggregation
pass re-checks those. Precision matters: a flood of false positives is worse than a short, correct
list.

## How correct code looks (so you recognize the absence of it)

- Copy lives in a co-located catalog built with the project's `I18n` instance:
  `export const TX = i18n.defineTextCatalog({ title: { en: "Customers", nl: "Klanten" } });`
  (import `i18n` from the consumer's config module, e.g. `import { i18n } from "@/i18n"`). Every
  configured locale must be present or it does not compile. Parameterized entries are functions per
  locale: `{ en: (n: string) => \`${n} deleted\`, nl: (n: string) => \`${n} verwijderd\` }`.
- **Core / server** (framework-agnostic): resolve the active locale yourself - from a cookie or the
  `Accept-Language` header via `i18n.resolveLocale(...)` / `i18n.matchAcceptLanguage(...)` - then
  bind a translator: `const translate = i18n.translator(locale);` and call `translate(TX.title)`.
  A one-off resolve without binding is `i18n.translate(TX.title, locale)`. There is **no**
  dedicated server helper; the locale is the caller's to resolve.
- **React**: `const translate = useTranslator();` (from `@daanvandenbergh/i18nkit/react`) returns a
  translator already bound to the active locale from context (`I18nProvider`).
- In JSX: `{translate(TX.title)}`, `placeholder={translate(TX.ph)}`, `aria-label={translate(TX.close)}`,
  `toast(translate(TX.saved))`, `setError(translate(TX.required))`. Interpolation:
  `translate(TX.subtitle, orgName)`.
- A word that is deliberately identical in every locale (a brand token) is authored with
  `i18n.uniform("...")` - a real `LanguageText<L>`, not a bare literal.
- Note any `.js` suffix on i18nkit / internal imports (NodeNext ESM) - it is correct, not a build
  artifact. Never flag an import specifier.

**A UI file that renders copy but imports no seam (`useTranslator` / `i18n.translator` /
`defineTextCatalog`) and never calls a translator is the #1 place bare copy hides.** Read those
first (the finder's "SUSPECT FILES").

## MUST be `LanguageText` (flag if bare) - the full list

1. **JSX text children** - headings, paragraphs, button/link labels, list items, empty states,
   badges, any words rendered between tags: `<h1>Customers</h1>`, `>Save changes<`.
2. **User-facing attribute values**: `aria-label`, `alt` (non-empty, non-decorative), `placeholder`,
   `title`. These are read aloud by screen readers or shown on hover - they are copy.
3. **Toasts, validation messages, and any error string shown to a user**: `toast("Saved")`,
   `setError("Name is required")`, an error message returned from a **server action** or an **API
   route** that the UI renders.
4. **Page SEO metadata**: `title`, `description`, and OpenGraph/Twitter fields, whether in a static
   `export const metadata` or a `generateMetadata()` return.
5. **Human-readable strings in JSON-LD** (`application/ld+json`): `name`, `description`, `headline`,
   `serviceType`, FAQ question/answer text, etc.
6. **Backend/server-generated copy that reaches a user** - transactional **email** subjects,
   headings and body text, and **product/catalog** titles/descriptions shown at checkout. i18nkit's
   type layer (`@daanvandenbergh/i18nkit`) is dependency-free and importable anywhere, so this copy
   is in scope. Flag it as `category: backend-copy`. In the `fix`, note that a backend job/webhook
   has **no request-scoped locale** (no cookie/headers), so wrapping also needs a **language source**
   - the recipient's / org's locale passed in; say so.

## NOT `LanguageText` (never flag) - the exceptions

- **The per-locale values inside a `defineTextCatalog` entry** (`en: "..."`, `nl: (n) => ...`).
  Those literals *are* the translations - the correct end state, not a violation. (The finder
  pre-filters locale-code-keyed lines; never re-flag them.)
- **Anything already resolved**: `{translate(TX.x)}`, `translate(TX.x, arg)`,
  `i18n.translate(TX.x, locale)`, `i18n.uniform("...")`, or a variable holding an already-resolved
  string (e.g. a server action returns `{ ok:false, error }` where `error` was already built with a
  translator; the JSX that renders `result.error` is **correct**, not bare).
- **User / DB / content data**: a customer's real name, address, phone, invoice number, transcript.
  Also placeholder/demo/sample data (`_data.ts`-style stand-in content, sample names): it is
  stand-in content, not product copy, so it is exempt like real DB data.
- **The entire blog area when the project uses `@daanvandenbergh/scribekit`**: MDX article bodies
  **and their front-matter-derived fields** (title, excerpt, author, tags) are content, localized
  **file-per-language in a per-slug folder** by scribekit - each post is a folder `<contentDir>/<slug>/`
  whose default body `<slug>/<defaultLocale>.mdx` gets a same-slug translation beside it (e.g.
  `blog/<slug>/nl.mdx`), never wrapped in a translator. The post's `<slug>/hero.js` is likewise
  **content/data, not a translator seam**: its per-locale `text` map (`en`/`nl` `title`/`subtitle`) is
  hero copy localized file-style, so **do not flag its string literals as bare copy**. Do not flag
  literals that are article content or come from a post's front-matter or `hero.js`. (The blog's own
  page-shell chrome - a hardcoded nav label or empty state in a route/component - would still be copy,
  but the blog area is content-dominated; treat it as the low-yield exception.) Translation
  *completeness* - a missing locale body, or a locale absent from a `hero.js` `text` map - is not a
  translator concern and is checked separately by the sweep's scribekit-parity step, not flagged here.
- **The brand / product name** rendered as text (e.g. the wordmark) - a proper noun, not translated.
  If it must be a `LanguageText<L>` for a seam, the sanctioned form is `i18n.uniform("Brand")`.
- **Language endonyms** - a locale's own name, i.e. the `label` on each entry in the `I18n`
  `locales` config, and any language-name chips (a language's own name is never translated).
- **Non-copy attributes**: `className`, `href`, `src`, `role`, `id`, `name`, `type`, `key`, `value`
  (of `<option>`/inputs), `htmlFor`, `rel`, `target`, `autoComplete`, `data-*`, `viewBox`, and
  **technical ARIA** (`aria-hidden`, `aria-expanded`, `aria-controls`, `aria-current`). `alt=""`
  (decorative image) is correct - leave it.
- **Developer-only strings never rendered to an end user**: `throw new Error("...")` in server/lib
  code that only gets logged or is mapped to a `LanguageText` at the action layer (e.g.
  `"Authentication required"` -> caught and re-messaged), React hook invariants
  (`throw new Error("useX must be used within <ProviderX>")`), assertions, and every `log.*(...)` /
  `console.*(...)` message. (Distinguish these from backend copy that a user *does* see - emails,
  product catalog - which IS in scope, item 6 above.)
- **Machine/config strings**: database index `name:` options, collection names, enum discriminants,
  lookup keys, ids, URLs, currency/tax codes - data, not copy.
- **Non-linguistic tokens**: pure punctuation/symbol separators (`·`, `/`, `→`, `•`), the em-dash
  fallback `"-"`, mask glyphs (`placeholder="••••••••"`), lone numbers, currency symbols, single
  characters.
- **JSON-LD data fields**: `streetAddress`, `addressCountry`/`addressLocality`, `postalCode`,
  `email`, `telephone`, `url`, ids, `availableLanguage: ["en","nl"]`, price/currency codes - these
  are data, not copy. Only the human-readable fields (above) are.

## Gray-zone judgment calls

- **`throw new Error("...")`**: violation *only if* the thrown message can reach the UI. Backend
  throws (mapped to `LanguageText` at the action layer, or only logged) and hook/dev invariants are
  **not** violations. A `throw` inside a **client** component whose message is shown in a toast/error
  UI **is**. When you can't tell, `confidence: low`.
- **`<option value="lead">Lead</option>`**: the `value` attribute stays bare (it's a machine key);
  the child text `Lead` is copy and must be `{translate(TX.statusLead)}`.
- **Rich text** (a sentence with an inline `<b>`/`<span>`/`<a>`): correct form is several
  `LanguageText` fragments composed in JSX (`{translate(TX.a)}<b>{translate(TX.b)}</b>{translate(TX.c)}`).
  That is **not** the forbidden concatenation. The forbidden thing is a resolved string glued to a
  **raw literal** (`translate(TX.a) + " more text"`) or JSX text sitting next to a `{translate(...)}`.
- **`aria-label` with a value that is data, not copy** (e.g. `aria-label={customer.name}`): not a
  violation - it's data. `aria-label="Close"` (a literal) is.
- **Proper-noun-adjacent tokens** - product **tier names** (`"Brand Starter/Pro/Scale"`), **place
  names** in JSON-LD (`areaServed name: "Europe"`), and similar: these sit between brand/data and
  copy. Lean toward treating them as brand/data (usually shipped untranslated); if you do flag them,
  use `confidence: medium` with a one-line note - never `high`. Don't let them pad the list.
- **Test files, `.d.ts`, `.stories.*`, `.test-d.*`**: not user-facing; skip them.

## Finding format (return exactly this per violation)

```
- file: src/app/customers/CustomerList.tsx
  line: 42
  snippet: <h2>Recent activity</h2>
  category: jsx-text            # jsx-text | attribute | toast-or-error | metadata | json-ld | backend-copy
  why: bare JSX heading rendered to the user; must resolve via translate(TX.*)
  fix: add `recentActivity: { en: "Recent activity", nl: "..." }` to the file's TX catalog and render `{translate(TX.recentActivity)}`
  confidence: high              # high | medium | low
```

Group nothing, sort nothing - just emit one block per violation. If a file is clean, say so
(`<path>: clean`) so the orchestrator knows it was actually read, not skipped.

## How a fix is applied (only under `--fix`; the default run is report-only)

1. Find or create the file's co-located `export const TX = i18n.defineTextCatalog({ ... });`
   (import `i18n` from the consumer's config module).
2. Add an entry. Static -> `{ en: "...", nl: "..." }`. Interpolated ->
   `{ en: (x) => \`...${x}...\`, nl: (x) => \`...${x}...\` }`. Convert HTML entities to the literal
   Unicode char (`&middot;` -> `·`, `&rsquo;` -> `'`).
3. Ensure the call site has a translator: `const translate = i18n.translator(locale);` (core/server,
   with the locale resolved by the caller) or `const translate = useTranslator();` (React, from
   `@daanvandenbergh/i18nkit/react`).
4. Replace the literal with `{translate(TX.key)}` (or `translate(TX.key, arg)` for interpolation, or
   the attribute form `attr={translate(TX.key)}`).
5. **Locale-safe wrapping (critical):** a bare source literal is (only) the **default**-locale text.
   A `defineTextCatalog` entry must cover **every** configured locale or it will not compile - and
   you must **never invent** the other locales' translations (a fake `nl` value silently ships wrong
   copy and defeats the whole guarantee). So:
   - If the project has a **single** configured locale, wrapping is lossless: apply it.
   - If **multi-locale** and the other translations are genuinely known, fill them all and apply.
   - Otherwise **do not auto-wrap**: list the finding as `needs-translation` (default-locale value
     ready, other locales awaiting a human) and leave the literal unchanged.
6. Never create per-language source-file copies; never hardcode one locale's value at a call site; a
   `LanguageText` value is always a plain string, never JSX.
7. After any applied wrap, `npm run typecheck` (fallback `npx tsc --noEmit`) must stay green.

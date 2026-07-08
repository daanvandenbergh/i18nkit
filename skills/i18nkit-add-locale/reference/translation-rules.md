# i18nkit-add-locale rules - what a correct translation is, and what the compiler can't see

This is the adjudicator for adding a locale. The job has two halves with very different guarantees,
and getting the split right is the whole skill:

1. **Catalog entries are compiler-enforced.** Every user-facing string already lives in a
   `LanguageText<L>` / `LanguageTextFn<L, A>` - a mapped type over the locale union `L`. Adding the
   new code to `new I18n({ locales })` grows `L`, so `tsc` reports every entry still missing the new
   key as a compile error. That error list **is** the exhaustive worklist: when `tsc` is green, every
   catalog entry provably covers the new locale. You do not hunt for these - the compiler hands them
   to you, exactly.
2. **A few things the compiler cannot see** and that therefore need a direct check: `@daanvandenbergh/blogkit`
   post files (content, localized file-per-language in a per-slug folder - one body per language plus a
   per-post `hero.js` - with **no** silent fallback, so a missing file is a broken page), hardcoded
   locale-code lists in app code (static params, hreflang, sitemaps, middleware matchers) that enumerate
   locales literally instead of from `i18n.list`, and whether the new locale has a built-in picker flag.
   None of these move `L`, so none of them error.

The bar is **a real, shippable, grammatically-flawless translation that carries the source's meaning
and intent** for every entry, with anything genuinely uncertain flagged for a human - never a silent
guess. A fabricated or sloppy translation is worse than a flagged gap: it compiles green and ships
wrong copy to real users, which is exactly the failure the type system exists to prevent. Translate
confidently where the language and the copy are unambiguous; flag where they are not.

## Translate for meaning and intent - never word-for-word - in flawless native grammar

**This is the heart of the job and the easiest thing to get wrong - read it before you translate a
single string.** Do **not** translate literally. A word-for-word rendering of the source is the single
most common way to ship copy that is technically "translated" and still wrong: it drags the source
language's grammar, idiom, and word order into a language where they read as broken, foreign, or
unintentionally comic - and a native customer notices *instantly*, the same way you would notice a
clumsily-translated foreign product. Your task is not to swap words; it is to carry the **meaning and
intent** across so the result reads as though it were originally written in the target language, not
translated into it.

- **Read the context first - always.** Look at what surrounds each entry: is this string a button, a
  heading, a tooltip, a validation error, a legal line, a marketing promise? Who reads it, in what
  moment, and what is the product trying to make that customer understand, feel, or do here? The same
  English word is translated differently in a three-word CTA than in an error message. You are bringing
  the author's intent to the customer - translate the *purpose* of the string, not just its characters.
- **Prefer the phrasing a native speaker would actually use over the one closest to the source.** Very
  often the right translation is **not** the direct one: an idiom becomes a different idiom (or plain
  language), a slogan is rewritten to land in the target culture (this is transcreation, not
  translation), a construction that is natural in the source reads stiff or wrong in the target and must
  be reshaped. When the natural native phrasing diverges from the literal source, **choose the natural
  one every time.** Faithful to meaning beats faithful to words.
- **Grammar must be 100% correct - there is no "good enough".** Every ending, agreement, gender, case,
  article, plural, contraction, accent, and diacritic must be right. A single grammatical error is the
  tell that a page was machine-translated and it corrodes trust in the entire product the way a typo on
  the homepage does. Hold every entry to the standard of a professional native writer, not a dictionary.
  Where correct grammar depends on a runtime value - the grammatical gender of an interpolated noun,
  plural agreement with a count, a case ending that changes with the inserted word - the string shape
  may not be able to stay correct for all inputs: treat that as a real linguistic problem, flag it
  `needs-review`, and describe it, rather than shipping a form that is only sometimes grammatical.
- **When meaning can't be preserved faithfully without more context** - an ambiguous source string, a
  term of art, a pun, a brand voice you cannot verify - translate to your best judgment and flag it
  `needs-review` with the *specific* doubt. Meaning you are unsure of is exactly what a human confirms;
  never paper over it with a confident literal guess.

The two requirements hold **together**: the source's meaning and intent must survive, **and** the result
must be grammatically flawless, natural native copy. A translation that satisfies only one of them is a
defect, not a draft - a beautiful literal sentence with wrong intent fails, and a correct-meaning
sentence with broken grammar fails.

## Editing the I18n config (the switch that turns on the compiler)

Add one entry to the instance's `locales` map (conventionally in `app/i18n.ts`):

```ts
locales: {
    en: { label: "English" },
    nl: { label: "Nederlands", htmlLang: "nl", locale: "nl-NL" },
    de: { label: "Deutsch", htmlLang: "de", locale: "de-DE" },   // <- the new entry
},
```

- **`label` is the endonym** - the locale's own native name, shown in the picker in every UI language
  alike (`Deutsch`, `Français`, `Português (Brasil)`, `日本語`). It is **not** copy and is **not**
  translated into the other UI languages. Get the native spelling right (correct diacritics, script).
- **`htmlLang`** is the BCP-47 document subtag and the URL prefix (`/de/...`). Use the primary subtag
  (`de`, `fr`), or a primary-region form (`pt-BR`) only when the site deliberately distinguishes
  regional variants in its URLs. It defaults to the map key, so it can be omitted when the key is
  already the subtag you want.
- **`locale`** is the full BCP-47 `Intl` formatting locale (`de-DE`, `fr-FR`, `pt-BR`) used for
  dates/numbers. Set it when the region matters for formatting; it defaults to `htmlLang`.
- **Insertion order is the picker order** - place the new entry where it should appear in the list.
- **Do not touch `default`.** Adding a locale never changes the fallback locale.

Add the entry in one place only. Every downstream method (`translator`, `localizeHref`,
`resolveLocale`, the picker, hreflang) reads the instance, so nothing else in well-built consumer code
needs a second edit for the locale to *exist* - the remaining work is filling in its translations.

## Translating a catalog entry - preserve every structural token, translate the copy for meaning

This section is the mechanics; it sits **under** the meaning-and-grammar principle above, never against
it. "Preserve structure" means keep the code intact (params, `${...}`, fragments, object shape) - it
does **not** mean translate the words literally. Translate the copy for meaning and intent, in flawless
grammar, *while* keeping every structural token below exactly as it is.

You are adding **one new key** to an existing entry. Never remove or reword the other locales' values,
never reformat the object, never add or delete entries.

- **Static text** (`LanguageText`): add the new key with the translated string.
  `{ en: "Save changes", nl: "Wijzigingen opslaan" }` -> add `de: "Änderungen speichern"`.
- **Parameterized text** (`LanguageTextFn`): every locale shares **one** argument tuple `A`. Add a
  builder with the **same parameter types and arity** as the sibling locales - you may rename the
  parameters, but never add, drop, or retype one, or `A` changes and it will not compile. Translate
  the template body and **reorder the words freely for the target grammar** - that is the entire
  reason this is a function per locale (each language keeps its own word order). Use **every**
  interpolated value the siblings use; dropping one silently loses that data.
  `{ en: (name: string) => \`Welcome back, ${name}\` }` -> add
  `de: (name: string) => \`Willkommen zurück, ${name}\``. Keep every `${...}` expression byte-identical
  (they are code, not words).
- **Split rich text** (a sentence deliberately broken into several `LanguageText` fragments composed
  in JSX): translate **each fragment**, keeping the same number of fragments. The natural break point
  may fall at a different word in the target language - that is fine; translate for meaning across the
  fragments, do not force a word-for-word alignment that reads wrong.
- **HTML entities -> the literal Unicode char** (`&middot;` -> `·`, `&rsquo;` -> `'`, `&nbsp;` -> a real
  non-breaking space), matching how the other locales are authored.
- **Match register and tone.** Read the existing locales first to gauge the voice (marketing vs.
  formal, `du` vs. `Sie`, `tu` vs. `vous`) and keep the new locale consistent with it across the whole
  catalog. Consistency of address form matters as much as literal accuracy.
- **Numbers, dates, currency** are formatted at runtime via `i18n.intlLocaleFor(locale)` - never bake
  a formatted number or a currency symbol into the translated string.

## Never translate these (leave them exactly as they are)

- **`i18n.uniform("...")` entries.** `uniform` generates the value for **every** locale code at
  runtime, so the new locale is already covered - these never appear in the `tsc` error list. Do not
  "add a key" to them; do not convert them.
- **Brand and product names, proper nouns, the wordmark.** A product name is not translated (`"Acme
  Pro"` stays `"Acme Pro"`). If a name is genuinely rendered differently in the target market, that is
  a `needs-review` call for a human, not a guess.
- **Machine/data values** that were never copy in the first place: enum keys, ids, URLs, CSS classes,
  `<option value>` keys, currency/tax codes. These are not in the catalogs and do not concern you.
- **Existing locales' values.** You are only ever adding the new key.

## Flag - do not silently translate - when

Add the new key with your best translation **and** list the entry as `needs-review` (with a one-line
reason) whenever the copy is: a marketing slogan or tagline where literal translation reads wrong, a
legally-loaded phrase (consent, liability, pricing terms), domain jargon or an industry term of art, a
UI string whose length constraint could break layout in the target language, or anything where meaning
is genuinely ambiguous without product context. Provide the draft so the human reviews rather than
writes from scratch, but make the uncertainty explicit. Never leave an entry blank to "compile later" -
a blank does not compile, and a fabricated confident translation of legal/brand copy is the one
outcome worse than a flagged draft.

## blogkit post translation - the compiler-invisible content half

If the project uses `@daanvandenbergh/blogkit`, adding a locale to i18nkit does **not** create the
blog's translations - blogkit localizes **file-per-language inside a per-slug folder**, and it has
**no** silent fallback, so every post needs a body file for the new locale or that page is broken.

Each post is a **folder**: `<contentDir>/<slug>/` holds one `<locale><ext>` body per language (the
default is `<slug>/<defaultLocale><ext>`, e.g. `en.mdx`; a neutral `<slug>/post<ext>` is the fallback
name), plus a single `<slug>/hero.js` that renders every language's hero. (Extension defaults to `.mdx`.)

1. **Add the new locale to the `Blog` config** (`locales[]` with its `code`/`label`) so blogkit serves
   it, and cross-check that its locale set now matches the `I18n` locales - a divergence between the two
   is its own finding.
2. **For every post folder**, create the translated body `<contentDir>/<slug>/<newcode><ext>` beside the
   default - **same slug** (routing depends on the folder name), translated:
   - **Front-matter**: translate the human fields (`title`, `excerpt`/`description`, and `tags` only if
     the site shows localized tag labels - otherwise leave tags as shared keys). Keep every front-matter
     **key** and every non-copy value (dates, slugs, ids) unchanged.
   - **Body**: translate prose. Leave code blocks, inline code, identifiers, URLs, and MDX component
     names/props untouched. Keep the heading structure and any anchors.
   - **Hero** (`<slug>/hero.js`): the hero is **not** a carried-over image path - it is one i18n-style
     data file per post, `export default (locale) => ({ gradient, ...text[locale] })`, whose `text` map
     holds each language's `title`/`subtitle`. Add the new locale's entry to that `text` map, **reusing
     the post's single shared `gradient`** (never re-pick it) so the language renders with matching art.
     A per-locale JPEG is then rendered to `public/assets/blog/<slug>/hero.<newcode>.jpg` and the new
     `<newcode><ext>`'s `image:` front-matter pointed at **its own** file - never at another locale's
     JPEG (each hero bakes in that language's text). Rendering runs headless Chrome, so hand it to
     blogkit's `hero_image.md`; if a post's `hero.js` is still the single-language plain-object form,
     converting it to the `(locale) => params` map is likewise blogkit's job. Flag a `hero locale gap`
     if a post's `hero.js` (or its rendered JPEG) is missing the new locale, and a `broken hero
     reference` if a translation's `image:` has no file under `public/` or points at another locale's JPEG.
3. Translating full article bodies is content authoring - for anything beyond short posts, hand the
   precise per-post worklist to the author and point at blogkit's own `skills/blogkit` writing skill and
   its `hero_image.md` skill rather than machine-translating a long article silently. (If the project
   annotates `hero.js` with `@satisfies {Record<Locale, …>}` and runs `checkJs`, `tsc` may also surface
   a missing locale there - a bonus, not the mechanism you rely on.)

## Hardcoded locale lists - the other compiler-invisible gap

Well-built consumer code enumerates locales from `i18n.list` / `i18n.locales`, so adding a locale flows
through automatically. A **literal** list of codes does not - it is the anti-pattern that leaves the new
locale half-wired. Look for and update: `generateStaticParams` returning a fixed `[{ locale: "en" }, ...]`,
hreflang/sitemap builders iterating a bare `["en","nl"]`, a middleware matcher listing locale prefixes,
or a `switch`/map keyed on locale codes. The bundled `scripts/scan.sh` surfaces these as leads; confirm
each by reading the file - the fix is either to add the new code or (better, noted as advice) to derive
the list from `i18n.list`.

## What "done" looks like - the report

- **The config diff**: the exact `locales` entry added (code, label, htmlLang, locale).
- **`tsc` is green**: state it explicitly - that is the proof that every catalog entry now covers the
  new locale. (Run the consumer's `npm run typecheck`, fallback `npx tsc --noEmit`.)
- **A translated-entries count** and a **`needs-review` list**: every entry translated, with the flagged
  ones called out by `file:line` and reason, so a human reviews exactly those and not the whole set.
- **blogkit result**: posts created / handed off, plus any hero locale gap or broken hero reference; or
  "blogkit not detected - skipped".
- **Compile-invisible coverage**: the hardcoded-list leads that were fixed or left as advice, and a
  one-line note if the new locale has **no built-in picker flag** (the picker falls back to its label;
  a custom `renderFlag` can supply one) - not a bug, just so nothing is silently missing.

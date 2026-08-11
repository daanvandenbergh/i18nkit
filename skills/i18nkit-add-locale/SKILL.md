---
name: i18nkit-add-locale
description: Add one new locale to a project already built on i18nkit and carry every translation through - the compiler-guided counterpart to i18nkit-sweep. Adding the code to `new I18n({ locales })` grows the locale union `L`, so `tsc` turns every `defineTextCatalog` / `defineText` / `LanguageText` entry still missing that locale into a compile error: an exhaustive, exact worklist of what to translate, handed to you by the compiler. This skill edits the I18n config, then translates every erroring entry - preserving interpolation params, `${...}` placeholders, split rich-text fragments, and leaving brand / `i18n.uniform` words untouched - fanning the work across parallel agents when there are many, and loops `tsc` to green. It also covers what the compiler cannot see: for `@daanvandenbergh/scribekit` it enumerates and creates the translated body beside the default in each post's per-slug folder (front-matter + body), extends the post's single `hero.js` i18n map with the new locale (its hero rendered via scribekit's hero skill), and it hunts hardcoded locale lists (static params, hreflang, sitemaps, middleware) that name codes literally. Use this whenever the user wants to add, support, or ship a new language or locale, translate the whole site / app into another language, internationalize into German / French / Spanish / Japanese / etc., launch in a new country or market, or asks "how do we add <language>?" - even if they never name i18nkit. It EXTENDS an already-wrapped codebase to a new locale; if bare untranslated strings might still exist, run i18nkit-sweep FIRST so the compiler can see them, then this. Takes the new locale code and an optional endonym label.
user-invokable: true
argument-hint: "<locale> [endonym]   e.g. de  |  fr \"Français\"  |  pt-BR \"Português (Brasil)\""
---

# i18nkit-add-locale

Extend a project already built on i18nkit to **one new locale**, end to end: add the locale to the
config, translate every catalog entry the compiler now flags, and close the two gaps the compiler
cannot see (scribekit posts, hardcoded locale lists). This is the **inverse of i18nkit-sweep**. The sweep
has no compiler signal - it hunts the *absence* of a translator and needs a team reading every file.
Adding a locale is the opposite: the moment the new code enters `new I18n({ locales })`, the locale
union `L` grows and `LanguageText<L>` is a mapped type over it, so `tsc` reports **every** un-covered
entry as a compile error. The worklist is exact and free; the skill's job is to fill it with **real**
translations and to not miss the handful of things that live outside the type system.

The bar is **100% coverage with shippable quality**: `tsc` green proves nothing is structurally
missing, and every translation both **carries the source's meaning and intent** (never a literal
word-for-word swap - see the principle below) and is **grammatically flawless native copy**, or is
explicitly flagged for a human - never a silent guess (a fabricated translation compiles green and
ships wrong copy, the exact failure the types exist to prevent).

**Translate for meaning, not word-for-word, in perfect grammar - this is non-negotiable and the
easiest thing to get wrong.** A literal rendering drags the source language's grammar and idiom into
the target and reads as broken to a native customer; the right translation is often *not* the direct
one (an idiom becomes a different idiom, a slogan is transcreated to land in the target culture, a
stiff construction is reshaped to how a native actually speaks). Read what surrounds each string - what
it is, who reads it, what the product means to convey to the customer - and translate that *intent*,
with 100% correct grammar (every agreement, gender, case, plural, accent). `reference/translation-rules.md`
carries the full principle; it is the first thing every translation agent must internalise.

## The authority

`reference/translation-rules.md` (in this skill's own directory) is the adjudicator: the compiler-vs-
uncatchable split, how to edit the config, exactly how to translate each entry shape (static,
parameterized, split rich text) while preserving params / placeholders / structure, what to **never**
translate (`uniform`, brand, endonyms, data), when to flag `needs-review` instead of guessing, and the
scribekit + hardcoded-list rules. **Read it now.** Let `<skill-dir>` be this skill's own directory
(the folder holding this SKILL.md); resolve it to an absolute path and pass
`<skill-dir>/reference/translation-rules.md` to every translation agent - it is what keeps quality
high. (The skill is a drop-in: it carries its own rules and script, nothing here hardcodes a path.)

## Inputs

Everything after `/i18nkit-add-locale` is one raw string. Parse in prose:
1. The **first token is the new locale code** (`de`, `fr`, `pt-BR`, `ja`). Required. If it is missing,
   ask which language to add rather than guessing.
2. The **remainder, if any, is the endonym label** (`"Français"`, `"Português (Brasil)"`) - the
   locale's own native name for the picker. If omitted, supply the correct native name yourself and
   show it for confirmation in Phase 0 (get diacritics / script right).

## Phase 0 - Locate the config and confirm the entry

Find the consumer's `I18n` instance: `new I18n({ locales: {...}, default: "..." })` (conventionally
`app/i18n.ts`, often `export const i18n` with `type Locale = keyof typeof i18n.locales`). Read it to
learn the **existing locales** (the keys of `locales`) and the **default**. Then decide the new entry:
- `label` - the endonym (from the argument, or the correct native name you supply).
- `htmlLang` - the BCP-47 document subtag / URL prefix (primary subtag `de`; a regional form `pt-BR`
  only when the site distinguishes regional URLs). Omit when it equals the map key.
- `locale` - the full `Intl` locale for formatting (`de-DE`, `fr-FR`). Omit when `htmlLang` suffices.

Confirm the code is not already configured (if it is, this is a re-run - jump to Phase 2 to fill any
gaps). If the codebase may still contain **bare, unwrapped** strings, note that those are invisible to
this compiler-driven flow and recommend running **/i18nkit-sweep** first so every string is in a
catalog the new locale can force. State the resolved entry to the user before editing.

## Phase 1 - Add the locale (turn on the compiler)

Make the **single** edit to the config's `locales` map: add the new entry, placed where it should
appear in the picker (insertion order is picker order). Do **not** change `default`. Do **not** edit
anything else yet - every downstream method reads the instance, so this one edit is what makes the new
locale exist and what makes `tsc` start reporting the worklist.

## Phase 2 - Let the compiler enumerate the worklist

Run the consumer's typecheck - `npm run typecheck`, fallback `npx tsc --noEmit`. Every catalog entry
still missing the new locale now errors (typically `Property '<newcode>' is missing in type ...` at the
`i18n.defineTextCatalog(...)` / `defineText(...)` call site). **This list is the exhaustive worklist** -
group the errors **by file**. `i18n.uniform(...)` entries will **not** appear (they cover every locale
by construction); leave them alone. If the count is zero, every entry is already covered - skip to
Phase 4.

## Phase 3 - Translate every entry (fan out when there are many)

Filling each entry is independent per file, so **shard the erroring files and translate in parallel** -
the meticulous, throw-compute-at-it half. For a handful of files, do it inline. For many, spawn one
`general-purpose` agent per shard of ~8-12 files, **all in one message** so they run concurrently
(keep to ~10-12 at once; run more in a second batch). Give each agent this task (fill in the shard and
the resolved rules path):

> You are translating this project's i18nkit catalogs into a new locale: **`<code>` (`<language
> name>`)**. **First read `<skill-dir>/reference/translation-rules.md`** - it is the exact rule for how
> to translate each entry shape and what to never touch. The existing locales are `<list them>`; read
> their values in each file first to match tone, register (formal vs. informal address), and voice.
>
> **Translate for meaning and intent, never word-for-word, in flawless native grammar - this is the
> whole point of the task.** A literal translation is the #1 way to ship wrong copy: it carries the
> source grammar and idiom into the target and reads as broken to a native customer. For every string,
> look at its context - what it is (button, heading, error, legal line, marketing promise), who reads
> it, and what the product means to convey to the customer - and translate that intent; the natural
> native phrasing often diverges from the direct one (idioms, slogans, register), and when it does,
> choose the natural one. Grammar must be 100% correct: every agreement, gender, case, plural, accent,
> diacritic. Hold each entry to a professional native writer's standard, not a dictionary's.
>
> Your files: `<list the shard's paths>`.
>
> For every `defineTextCatalog` / `defineText` / `LanguageText` / `LanguageTextFn` entry in these
> files, **add the single new key `<code>`** with a real translation. Preserve everything structural:
> for parameterized entries keep the exact parameter types and arity of the sibling locales and reuse
> every `${...}` value (reorder words for the target grammar, never the params); for split rich-text
> keep the fragment count; convert HTML entities to literal Unicode. **Never** touch `i18n.uniform(...)`
> entries (already covered), brand / product names, endonyms, or data values. Where a translation is
> genuinely uncertain (slogan, legal phrase, domain jargon, tight length constraint), still add your
> best draft **and** report it as `needs-review` with a one-line reason - never leave a blank, never
> confidently guess legal/brand copy. **Do not run the compiler, do not spawn sub-agents, do not edit
> anything but the new key in each entry.** Return, per file: the entries you translated, and the
> `needs-review` list with `file:line` + reason.

Collect every agent's result. Then **loop `tsc` to green yourself**: re-run the typecheck, and for any
remaining error fix that entry (a missed file, a parameterized signature that drifted, an entity that
broke a template). Green `tsc` = every catalog entry provably covers the new locale.

## Phase 4 - Close the compiler-invisible gaps

Run the bundled scanner over the source root (it needs the new code, and the existing codes + blog
`contentDir` / `defaultLocale` / `extension` from the config if the defaults differ):

```bash
EXISTING_CODES="en nl" CONTENT_DIR="./blog" DEFAULT_CODE="en" <skill-dir>/scripts/scan.sh <newcode> "<src or .>"
```

It prints two lead sections - confirm each by reading, none is a verdict:
1. **SCRIBEKIT POST WORKLIST** - each post is a `<contentDir>/<slug>/` folder; for each, the
   `<slug>/<newcode>` body that must exist beside the default (`<slug>/<defaultLocale>` or the neutral
   `<slug>/post`), and whether the post has a `hero.js`. If scribekit is in use: add the new locale to the
   `Blog` config's `locales[]`, then create each listed body - **same slug**, front-matter human fields
   + body translated per translation-rules.md, and extend the post's single `hero.js` `text` map with
   the new locale (reusing its shared gradient), its per-locale JPEG rendered via scribekit's
   `hero_image.md`. Posts are independent, so fan them out one-agent-per-post exactly like Phase 3 when
   there are several; for long articles, hand the precise worklist to the author and point at scribekit's
   own writing / hero skills rather than machine-translating a long body. Report any **hero locale gap**
   or **broken hero reference**. If scribekit is not detected, say so and skip.
2. **HARDCODED LOCALE-LIST LEADS** - lines in app code that name existing locale codes as literals
   (`generateStaticParams`, hreflang / sitemap builders, middleware matchers, locale `switch`es).
   These do not follow `L`, so the new locale is missing until they are updated. Add the new code, and
   note where deriving the list from `i18n.list` would prevent the next recurrence.

Also note whether the new locale has a **built-in picker flag** (the React `localeFlag` helper): if not,
the picker shows just the label - fine, but say so, and mention a custom `renderFlag` can supply one.

## Phase 5 - Verify and report

1. **Prove it compiles.** Final `npm run typecheck` (fallback `npx tsc --noEmit`) must be green - state
   it. If the project has a build, run it too. Never leave the tree non-compiling.
2. **Report**, in the conversation, per `reference/translation-rules.md`'s "What done looks like":
   - the **config diff** (the exact `locales` entry added);
   - **`tsc` green** stated as the coverage proof, with the **translated-entries count**;
   - the **`needs-review` list** - every flagged entry by `file:line` + reason, so a human reviews only
     those;
   - the **scribekit result** (posts created / handed off, hero locale gaps, or "not detected");
   - the **compile-invisible coverage line**: hardcoded-list leads fixed or left as advice, and the
     picker-flag note.
   Offer to save a long report to `.agent/reports/i18nkit-add-locale-<code>.md`.

## Notes

- **Why compiler-driven, not a blind team:** unlike the sweep, the catalog worklist is exact and
  provided by `tsc` - so the skill leans on the compiler for *what* to translate and spends its agents
  on the part that is actually parallel and judgment-heavy (*translating* many entries / posts well).
  Don't re-implement enumeration the compiler already does.
- **The scribekit half is the real risk.** It is the one place a new locale is not compile-checked and
  has no runtime fallback, so a missed post is a live broken page - never let the green `tsc` lull you
  into skipping Phase 4.
- **Portability:** the default fan-out uses the `Agent` tool; the same finder -> per-shard translate ->
  verify shape maps onto a `Workflow` for a very large catalog, but Agent parallelism is enough for
  most repos. The skill makes no repo-specific assumptions - it reads the locale set from the project's
  own `I18n` config and its own bundled rules/script by relative path, and degrades from
  Next/React-specific guidance (`generateStaticParams`, `app/i18n.ts`) to a generic `src/` project.
- **Re-runnable:** run it again for the same code to fill any gap left by later-added copy, or run
  /i18nkit-sweep first to guarantee every string is wrapped before you add the locale.

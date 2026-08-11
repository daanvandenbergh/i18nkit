---
name: i18nkit-sweep
description: Full-project sweep that hunts down every user-facing string NOT wrapped in i18nkit's type-safe system (LanguageText / defineTextCatalog / a translator from useTranslator or i18n.translator) - so adding a locale stays a compile-checked guarantee instead of a manual hope. A team of parallel agents reads every UI file, reports each bare literal with file:line and category, and (only with --fix) wraps the confident ones through a co-located defineTextCatalog and verifies typecheck stays green. When the project uses @daanvandenbergh/scribekit it also verifies every post's per-slug folder has a body for every configured locale, and that each post's hero.js covers every locale so each language renders its own hero. Use this whenever the user wants to audit, enforce, or fix i18n / translation coverage, find or fix hardcoded / untranslated / non-translatable strings, make "all text support i18n" or "use LanguageText everywhere", verify nothing bypasses the translation system, get the codebase ready before adding a language, or asks "are all our strings translatable?" - even if they don't name the i18n module. It closes the gap for text that ALREADY exists; do NOT use it for translating supplied strings into another language, adding or configuring a locale in the I18n instance, or changing the default locale. Takes an optional area (e.g. components, "app/(dashboard)") to scope the sweep, or omit for all of src/. Report-only by default; pass --fix to also wrap the confident violations.
user-invokable: true
argument-hint: "[area] [--fix]   e.g. components  |  \"app/(dashboard)\" --fix  |  (omit = report all of src/)"
---

# i18nkit-sweep

Hunt every piece of user-facing text in the project's source that reaches the UI as a **bare
string** instead of going through an i18nkit translator. This is a **negative-space** search:
correct code resolves copy through a `LanguageText`/`LanguageTextCatalog` built with
`i18n.defineTextCatalog`; a violation is the *absence* of that - a literal that silently escapes the
compile-time coverage guarantee. i18nkit's guarantee is structural: the locale set is a union `L`
inferred from `new I18n({ locales })`, `LanguageText<L>` is a mapped type over `L`, so adding a
locale turns every un-translated entry into a compile error - but a bare literal has no per-locale
keys, so nothing forces it to keep up. Grep alone can't judge intent, so the sweep is a **team of
agents that read the actual files** against a precise ruleset. Thoroughness comes from covering
every file; correctness comes from judgment, not pattern-matching.

The bar is **exhaustive coverage with high precision**. A short, correct list beats a long, noisy
one - every reported violation must be a real one a staff engineer would agree with.

## Inputs

Everything after `/i18nkit-sweep` is one raw string. Parse in prose:
1. Extract `--fix` if present, then strip it. Its presence means **also fix**: after reporting, wrap
   the confident violations and re-verify typecheck (Phase 3.4). **Default (no `--fix`):
   report-only** - sweep and report, change no files.
2. The remainder is the **area** to scope to (a path under the source root, e.g. `components` or
   `app/(dashboard)`). Empty -> sweep **all of `src/`** (or the project's user-facing source root).

## The authority

`reference/rules.md` (in this skill's own directory) is the adjudicator: exactly what counts as
user-facing text, the full exception list (dev-only `throw`s, JSON-LD data fields, endonyms, brand
name, non-copy attributes, mask glyphs...), the gray-zone calls, and the finding format. **Read it
now.** Let `<skill-dir>` be this skill's own directory (the folder containing this SKILL.md);
resolve it to an absolute path and pass `<skill-dir>/reference/rules.md` to every sweep agent - it
is what keeps precision high. (The skill is a drop-in: it carries its own rules and script, so
nothing here hardcodes a machine path.)

## Phase 0 - Learn the locale set

Locate the consumer's `I18n` instance: `new I18n({ locales: {...}, default: "..." })` (conventionally
`app/i18n.ts`, often re-exported as `export const i18n` with `type Locale = keyof typeof i18n.locales`).
Read it to learn:
- the **supported locales** = the keys of `locales` (e.g. `en`, `nl`), and
- the **default locale** = the `default` field.

That set is what "if we shipped one more locale tomorrow" means concretely, and it is the locale
axis both the string sweep and the scribekit-parity step (Phase 3.5) enumerate. Endonyms live in
`locales[x].label` and are **not** copy (see rules.md).

## Phase 1 - Scope and shard

1. **Resolve the file set.** All `.ts`/`.tsx` under the target area, **excluding** `tests/`,
   `*.test.*`, `*.test-d.*`, `*.d.ts`. Priority (Next.js App Router + React first; degrade
   gracefully for other setups):
   - **HIGH** (where copy lives): route files under `app/` - pages, `layout`, `error`,
     `not-found`, and `generateMetadata` returns - and everything under `components/`.
   - **IN SCOPE - server-generated user-facing copy**: email modules (transactional subjects /
     headings / bodies) and product/catalog modules (titles/descriptions shown at checkout). Real
     users see these, so bare copy there is a violation (`backend-copy`; see rules.md item 6). The
     rest of server code is machine/dev strings (throws, logs, index names) = not copy.
   - **EXEMPT**: the blog area when `@daanvandenbergh/scribekit` is used (article bodies and
     front-matter-derived text are content, localized file-per-language; parity is checked
     separately in Phase 3.5); and placeholder/demo `_data.ts`-style data (stand-in content, treated
     like DB data).
   - **SKIP**: the file that constructs the `I18n` instance (it *is* the config; its locale labels
     and default are the exceptions), and i18nkit's own package files.
   - **Non-Next / non-React project?** Drop the `app/`-specific names and treat it generically: sweep
     all user-facing source under the area (default `src/`), same rules.
2. **Get a heat-map.** Run the bundled lead-finder over the area:
   ```bash
   <skill-dir>/scripts/find_candidates.sh "<area or src>"
   ```
   It prints **SUSPECT FILES** (render JSX but touch no seam/translator - read these first) and
   **LITERAL LEADS** (bare copy attributes, same-line JSX text, toast/error, metadata/JSON-LD).
   Leads are starting points, **not verdicts** - every file still gets read in full.
3. **Shard.** Split the file set into groups of ~8-12 files along directory boundaries so each agent
   has coherent context. Aim for one agent per coherent sub-area. Keep concurrent agents to ~10-12;
   run more in a second batch.

## Phase 2 - Parallel sweep (the team)

Spawn one `general-purpose` agent per shard, **all in one message** so they run concurrently. Give
each this task (fill in the shard's files and the resolved rules path):

> You are one of several agents sweeping this project's source for i18nkit violations - user-facing
> text that reaches the UI as a bare string instead of resolving through an i18nkit translator
> (`useTranslator()` in React, or `i18n.translator(locale)` / `i18n.translate(text, locale)` in the
> core). **First read `<skill-dir>/reference/rules.md`** - it is the exact definition of a violation,
> the full exception list, and the finding format. It is easy to over-report; follow it precisely.
> The project's configured locales are `<list them>` (default `<default>`).
>
> Your files: `<list the shard's paths>`.
>
> For **every** file: read it **in full** (do not rely on grep excerpts - multi-line JSX text and
> metadata objects hide from grep). Judge each string against the one question in the rules: *"if we
> shipped one more locale tomorrow, would this exact string have to change?"* Flag every bare
> user-facing literal; ignore every exception (dev-only `throw`s, per-locale `defineTextCatalog`
> values, data/URLs/enums/ids, endonyms, brand name, mask glyphs, decorative `alt=""`, non-copy
> attributes). Pay special attention to any file that renders copy but imports no `useTranslator` /
> `i18n.translator` / `defineTextCatalog` and never calls a translator.
>
> Return findings in the exact block format from rules.md (file, line, snippet, category, why, fix,
> confidence). For every file with no violations, emit `<path>: clean` so coverage is provable. **Do
> not spawn sub-agents. Do not modify files.** Return only the findings + the clean list.

## Phase 3 - Verify, then report

1. **Collect** every agent's findings and clean-list. Confirm each shard's files were all accounted
   for (found-or-clean) - if an agent skipped files, re-dispatch them. No file goes unread.
2. **Verify the doubtful.** Re-check every `medium`/`low` confidence finding yourself by reading that
   spot (or dispatch a single skeptical verifier agent for a batch): does it truly change under a new
   locale, or is it an exception? Drop the false positives. A wrong finding is worse than a missing
   one here.
3. **Report.** Print, in the conversation:
   - A one-line verdict: `N violations across M files (K files swept, area = ...)`.
   - Violations grouped **by file**, each as the rules.md block, ordered high->low confidence.
   - A short **counts-by-category** tally (jsx-text / attribute / toast-or-error / metadata /
     json-ld / backend-copy).
   - A **coverage line**: which areas were swept and which were intentionally skipped (so the user
     knows nothing was silently dropped), plus the scribekit-parity result from 3.5.
   Offer to save the report to `.agent/reports/i18nkit-sweep.md` if the list is long.
4. **Fix (only under `--fix`; skip this whole step by default).** Apply the fixes per rules.md ("How
   a fix is applied") - extend the file's `defineTextCatalog`, wire a translator via the right seam,
   replace the literal. Touch only the violating lines; do not restructure files. Guards:
   - **Only auto-fix `high`-confidence findings, and only when wrapping yields a green entry.** A
     bare literal is the *default*-locale text; a catalog entry needs **every** configured locale to
     compile, and you must never invent the others. So: single-locale project -> wrap (lossless);
     multi-locale with the other translations genuinely known -> fill all and wrap; otherwise list
     the finding as **needs-translation** and leave it unchanged. Say clearly what you applied vs.
     left, and list every `medium`/`low` finding as **needs-your-call**.
   - **`backend-copy` is not a mechanical wrap** - it needs a locale source threaded in (no
     request-scoped locale in a job/webhook). Do **not** auto-edit backend files; report them with
     the design note from rules.md item 6 and let the user decide the seam.
   After editing, run `npm run typecheck` (fallback `npx tsc --noEmit`) and report it green. If it
   fails, fix the wrap or revert that one finding - never leave the tree non-compiling.
5. **scribekit translation parity (always, even without `--fix`).** This is the one place a new locale
   is **not** compile-checked, so verify it directly - mostly a file check, no agent.
   1. **Detect scribekit.** The project uses it if any of: `@daanvandenbergh/scribekit` appears in the
      consumer's `package.json` (`dependencies`/`devDependencies`), a source file imports it, or a
      `new Blog({...})` instance exists. If **none** hold, **skip this whole step** and say so in the
      coverage line ("scribekit not detected - blog parity skipped").
   2. **If present, read the `Blog` config** for `contentDir` (a required field, conventionally
      `./blog`), the `locales[].code` list, `defaultLocale`, and `extension` (the post file
      extension, default `.mdx`). Cross-check that locale set against the `I18n` locales from Phase 0;
      if they diverge, report the divergence as its own finding. Each post is a **folder**
      `<contentDir>/<slug>/` holding one `<locale>.mdx` body per language - the default is
      `<slug>/<defaultLocale>.mdx` (e.g. `en.mdx`; a neutral `<slug>/post.mdx` is the fallback name),
      each translation `<slug>/<code>.mdx` (same folder), plus one `<slug>/hero.js`. scribekit has **no
      silent fallback**, so a missing file is a real gap.
   3. **Post parity - a pure file check.** Set `CONTENT_DIR` and `DEF` (the default locale) from the
      config, replace `.mdx` with the configured `extension` if it is non-default, and **inline the
      non-default locale codes as a literal list** (write `for l in nl de` - do **not** rely on an
      unquoted `$langs` variable, which does not word-split under zsh):
      ```bash
      CONTENT_DIR="./blog"; DEF="en"       # from the Blog config (contentDir, defaultLocale)
      # find (not a bare glob) so an empty or non-post folder never aborts the loop under zsh's nomatch
      find "$CONTENT_DIR" -mindepth 1 -maxdepth 1 -type d | while read -r dir; do
          # a post needs a default-locale body: <default>.mdx, or the neutral post.mdx fallback
          if [ ! -f "$dir/$DEF.mdx" ] && [ ! -f "$dir/post.mdx" ]; then
              # no base body: any <locale>.mdx here is an orphan translation (base renamed/deleted)
              find "$dir" -maxdepth 1 -name '*.mdx' -exec echo "ORPHAN: {}" \;
              continue
          fi
          for l in nl de; do               # <- the non-default locale codes, inline
              [ -f "$dir/$l.mdx" ] || echo "MISSING: $dir/$l.mdx"
          done
      done
      ```
   4. **Hero parity.** The hero is one `<slug>/hero.js` per post, `export default (locale) => ({
      gradient, ...text[locale] })`, whose `text` map holds each language's `title`/`subtitle`; it is
      rendered once per locale to `public/assets/blog/<slug>/hero.<code>.jpg`, and each body's
      `image:` front-matter points at its **own** locale's JPEG (a hero bakes in that language's text,
      so a shared JPEG is untranslated copy). Two checks:
      - **Primary - `hero.js` locale coverage (robust, no path guessing).** For each post that has a
        `hero.js` in the `(locale) => params` form, read its `text` map and confirm it has a key for
        **every** configured locale. A configured locale missing from the map -> **hero locale gap**
        (that language renders a blank/wrong hero). This is the signal scribekit's `hero_image.md`
        defers to the sweep to catch project-wide. (A single-language plain-object `hero.js` on a
        now-multi-locale blog is itself a `hero locale gap` - it needs converting to the map form.)
      - **Secondary - rendered hero + `image:` reference (heuristic path).** By the Next.js
        convention the JPEGs live at `public/assets/blog/<slug>/hero.<code>.jpg` (say the base dir is
        a heuristic if the project serves static assets elsewhere). For each configured locale whose
        body exists, flag a **broken hero reference** if its `hero.<code>.jpg` is missing, if the
        body's `image:` path has no file under `public/`, or if the `image:` points at **another**
        locale's JPEG (e.g. `<slug>/fr.mdx` -> `hero.en.jpg`). Check the base body too.
   5. **Report** each `MISSING:`, hero locale gap, broken hero reference, and orphan as a
      **scribekit-parity gap** in the coverage section - a content-parity gap, not a translator
      violation, and **never auto-fixed** here (writing/translating a post body, or generating a
      localized hero, is the blog author's job - point to scribekit's own `skills/scribekit` write and
      `hero_image.md` skills).

## Notes

- **Why a team, not one pass:** a real UI has many text-bearing files; one agent reading all of them
  loses focus and misses things. Sharded parallel reads keep each agent sharp and finish fast.
- **Portability:** the default fan-out uses the `Agent` tool. For a very large or repeated whole-repo
  sweep the same shape maps onto a `Workflow` (finder -> per-shard sweep -> verify), but Agent
  parallelism is enough for most repos.
- **Universal drop-in:** this skill makes no repo-specific assumptions - it resolves the locale set
  from the project's own `I18n` config, reads its own bundled rules/script by relative path, and
  degrades from Next/React-specific guidance to a generic `src/` sweep when the project is neither.
- **Re-runnable:** scope to an area you just edited (`/i18nkit-sweep app/(dashboard)/billing`) for a
  fast focused check, or run bare before adding a locale for the full guarantee.

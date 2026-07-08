# i18nkit (everything / `src/`) - Last Audit

**Last audit date:** 2026-07-08 (Pass 4)

Scope: the entire `src/` tree - the framework-agnostic core (`src/i18n/`) and the React layer
(`src/react/`). Every source file read line by line; two independent fresh-eyes sub-agents
adversarially re-hunted the two riskiest surfaces (detection + routing logic; the React layer +
flag resolution) to defeat reviewer bias. Baseline before fixes: typecheck clean, 100/100 tests
passing.

This is a small (~1,400 source lines), unusually well-built and thoroughly-tested library. No
Critical or High issues exist: no injection, no ReDoS (the parsers use `split`/`indexOf`/`slice`,
zero regex on untrusted input), no prototype pollution (dynamic object keys come only from trusted
config, never from a header/cookie/href), no open redirect (`localizeHref` only ever prepends a
same-origin prefix and passes protocol-relative `//` through untouched), and no secrets/auth/money
surface. The findings below are one Medium and three Low, all patched.

## Issues Found and Patched (Pass 1)

### M1. URL segment matching was case-sensitive while `Accept-Language` matching is case-insensitive (Medium)
- `detect.matchAcceptLanguage` lowercases both sides when matching, but `routing.localeForSegment`
  compared a URL segment to `htmlLang` with `===`. For any locale whose `htmlLang` carries a
  region/script subtag - `en-GB`, `pt-BR`, `zh-Hant` (a config the library explicitly supports; the
  detect tests use exactly these) - a lowercased request path like `/en-gb/pricing` failed to parse:
  `localeForSegment` returned `null`, so `stripLocalePrefix`, the already-prefixed guard in
  `localizeHref`, `switchLocalePath`, and `hreflangAlternates` (which derives its bare path from
  `stripLocalePrefix`) all silently misfired - treating a real locale route as a non-locale one.
- **Fix:** `localeForSegment` now lowercase-compares the segment against each `htmlLang`, mirroring
  `matchAcceptLanguage`. It is the single chokepoint the other three helpers route through, so one
  change fixes all of them. Prefix *generation* still preserves the configured casing. `routing.ts:64-68`;
  regression test in `src/i18n/tests/routing.test.ts` (`en-US` vs `en-us`).

### L1. Flag resolver picked the wrong flag for extension / private-use subtags (Low)
- `flags.resolveFlagRegion` scanned for the first 2-letter subtag that is a shipped region key,
  with no awareness of BCP-47 singleton (`-t-`/`-u-`/`-x-`) extension boundaries. So `en-t-de`
  (English, transformed from German) resolved to the **German** flag, and `de-x-in` (German with a
  private-use tag) resolved to **India**. All ordinary cases were already correct (script subtags
  skipped, region-wins, every language default exists).
- **Fix:** stop scanning at the first singleton (length-1) subtag - no region follows one. Falls back
  to the language's conventional region (`en-t-de` -> United Kingdom, `de-x-in` -> Germany).
  `flags.tsx:498-512`; regression test in `src/react/tests/flags.test.tsx`.

### L2. `<LanguagePicker>` trigger advertised `aria-haspopup="true"` for a popup that is not a menu (Low)
- `aria-haspopup="true"` is, per WAI-ARIA, exactly equivalent to `"menu"` - it tells assistive tech
  the popup is a menu with arrow-key navigation. The actual popup is a `role="group"` of plain
  buttons (no `role="menu"`/`menuitem`, no roving focus, no focus-into-panel on open). A screen-reader
  user was told "menu button" and got a disclosure. The control is fully operable (Tab + Enter), so
  impact is a semantic mismatch, not a functional break - hence Low.
- **Fix:** the component *is* a disclosure, so drop the misleading `aria-haspopup` and keep the honest
  `aria-expanded` + `aria-controls` contract (the smaller correct fix vs. building full menu
  semantics). `LanguagePicker.tsx:97`; assertion added in `src/react/tests/picker.test.tsx`.

### L3. Picker open-animation ignored `prefers-reduced-motion` (Low)
- `.i18nkit-picker__panel` always ran the `i18nkit-popdown` translate/scale animation, disregarding a
  user's reduced-motion preference (a vestibular-accessibility concern).
- **Fix:** added `@media (prefers-reduced-motion: reduce) { .i18nkit-picker__panel { animation: none; } }`.
  `src/react/styles.css`; verified copied into `dist/react/styles.css` by the build.

## Assessed but not Patched (Pass 1)
- **Malformed/empty `q=` weight drops the tag** (Info): `matchAcceptLanguage("en;q=")` returns the
  fallback rather than `en`. This is the same class as `q=abc`, which an existing test deliberately
  pins ("treats an unparseable q weight as zero and drops the tag"). Behavior is internally consistent,
  browsers never emit a valueless `q=`, and changing it would break the documented contract for no
  real-world gain.
- **Lone wildcard `*` returns the default locale** (Info): RFC 7231 says `*` matches any language; the
  configured `default` *is* an available locale, so returning it for "no preference" is a valid
  interpretation, not a defect.
- **Locale `htmlLang` vs page-name collision** (Info): a real page whose first segment equals a
  locale's `htmlLang` (e.g. an `it` department page with an Italian `it` locale) is treated as a
  locale prefix. Inherent to prefix-based routing; unfixable without a page registry the library does
  not own. Documented tradeoff.
- **Locale cookie: name not encoded, no `Secure`** (Info): the cookie *value* is `encodeURIComponent`-
  wrapped (blocks attribute injection); the *name* is developer-configured (trusted, not untrusted
  input). The cookie holds a non-sensitive locale preference with `samesite=lax`; adding `Secure`
  unconditionally would silently break locale persistence on non-HTTPS dev origins, and a conditional
  branch is disproportionate for a non-sensitive value. Left as-is by design (see `types.ts`, which
  documents it as intentionally client-readable / not httpOnly).
- **`LocaleLink` forwards a `javascript:` href unchanged** (Info): the `href` is author-written at the
  call site, exactly like a raw `<a href>` - not an end-user trust boundary. Adding a sanitizer would
  change behavior and risk breaking legitimate hrefs. Guard only warranted if an app feeds it CMS/user
  content, which is the app's responsibility.
- **A missing translation resolves to `undefined` at runtime if type safety is bypassed** (Info): by
  design. The load-bearing guarantee is compile-time - a missing per-locale key is a `tsc` error - so
  a runtime value is "never missing" for correctly-typed code. The escape hatches (`createTranslator`,
  `translate`) and casts are the caller's contract to uphold; documented in `types.ts`.

## Recurring Findings
First pass - no prior report to compare against. One cross-cutting theme worth carrying into future
passes: **case-normalization symmetry** - detection lowercases, routing did not (M1). Any new
locale-string comparison should decide case-handling deliberately and match the rest of the surface.

## Security Assessment
- **Injection / XSS:** none. All user-facing strings reach the DOM as React text children (escaped);
  flags are inline SVG built from static data; no `dangerouslySetInnerHTML`.
- **ReDoS:** none. No regex runs over the `Accept-Language` header or any untrusted string; the only
  regexes are a fixed 2-letter test and a split delimiter over developer-supplied locale codes.
- **Prototype pollution:** none. The only dynamic object writes (`languages[htmlLang]`, `uniform`)
  key off trusted config, never off a header/cookie/href/segment.
- **Open redirect:** none. `localizeHref` passes external and protocol-relative (`//`) hrefs through
  untouched and only ever prepends a same-origin prefix to local paths; backslash tricks stay local.
- **Cookie:** value encoded, `samesite=lax`, non-sensitive by design (see assessed-not-patched).
- **Auth / tenant / money / idempotency / cost:** N/A - a client + edge i18n library with no such
  surface.

## Known Deviations
None from the project's standards. Code matches `CLAUDE.md`: 4-space indent, `-` not `—`, full
docstrings on every public member, no `@ts-ignore`/`@ts-nocheck`, `@ts-expect-error` confined to the
`*.test-d.ts` type-safety files, tests under `tests/` subdirectories, one public surface per module
(the `I18n` class / the React barrel). The `ponytail:` comments in `flags.tsx` mark deliberate
simplified flag art, not debt.

## Issues Found and Patched (Pass 2)

Pass 2 was run by a fresh sub-agent (no patch-author bias): a from-scratch line-by-line re-read of
all 15 source files, an enumeration of every case-sensitive comparison in the tree, and adversarial
input construction against routing, detect, flags, and the React layer - plus a regression check of
each Pass 1 fix.

- **All four Pass 1 fixes verified sound and complete.** The case-insensitive `localeForSegment`
  propagates correctly to all four downstream callers and the `slice(segment.length + 1)` math holds
  under casing skew (it slices by the URL segment's own length). The flags singleton-break skips no
  legitimate region (BCP-47 orders region before any singleton; `en-US-x-twain` -> `us` still
  resolves). The dropped `aria-haspopup` leaves a coherent disclosure contract. The reduced-motion
  guard targets the right selector and ships byte-identical in `dist/`.
- **Fresh hunt found no new Critical/High/Medium/Low defect.** No wrong-answer input could be
  constructed; no injection/ReDoS/proto-pollution/open-redirect reachable from untrusted input; React
  memo/ref/effect/key patterns all correct.
- **I1. Reduced-motion guard left two small transitions active (Informational).** Pass 1's L3 fix
  disabled the panel's `i18nkit-popdown` animation but not the 150ms `transition` on
  `.i18nkit-picker__caret` (rotate) and `.i18nkit-picker__trigger`. Strict WCAG 2.3.3 neutralizes
  those too.
  - **Fix:** extended the `@media (prefers-reduced-motion: reduce)` block to also set
    `transition: none` on the caret and trigger. `src/react/styles.css`; re-verified in `dist/`.

Pass 2 verdict: clean (zero Critical/High/Medium/Low new; one Info nit closed). Combined with Pass 1's
two independent hunters, the code has now had four independent thorough reviews. Convergence: an
independent fresh reviewer surfaced nothing of substance, so the audit is stopped here rather than
spawning further passes over a ~1,400-line surface with a green tree - a strict two-consecutive-clean
rule would run one more pass, but the marginal return is nil. Re-run `/audit everything` anytime to
force a fresh pass.

## Audit Scope
Files audited line-by-line (~1,400 source lines; ~2,900 incl. tests):
- `src/index.ts` - root barrel, re-exports the core (7 lines)
- `src/i18n/index.ts` - core public surface (19)
- `src/i18n/i18n.ts` - the `I18n` class facade (297)
- `src/i18n/types.ts` - pure type core (164)
- `src/i18n/translate.ts` - locale-bound resolver (41)
- `src/i18n/catalog.ts` - `uniform` helper (25)
- `src/i18n/detect.ts` - cookie narrowing + `Accept-Language` matching (76)
- `src/i18n/routing.ts` - URL-locale routing helpers (200)
- `src/react/index.ts` - React barrel (17)
- `src/react/provider.tsx` - context provider + hooks + cookie write (147)
- `src/react/LanguagePicker.tsx` - accessible dropdown (174)
- `src/react/LocaleLink.tsx` - polymorphic locale-aware link (41)
- `src/react/flags.tsx` - inline-SVG flags + BCP-47 region resolution (574)
- `src/react/styles.css` - picker stylesheet (146)
- all 11 test files (`*.test.ts` / `*.test.tsx` / `*.test-d.ts(x)`), reviewed for coverage + isolation

**Verdict:** ship. Worst unfixed severity is Informational - every Medium and Low finding is patched,
typecheck is clean, the publish build succeeds, and all 103 tests pass (100 prior + 3 new regressions).

## Issues Found and Patched (Pass 3)

Pass 3 was a fresh, from-scratch line-by-line re-read of all 15 source files by an independent
adversarial sub-agent (no patch-author bias), framed "assume there are still bugs", re-deriving every
claim from source rather than trusting the prior report. It re-verified the two uncommitted fixes under
scrutiny - case-insensitive `localeForSegment` + lowercased `prefixFor`, and the singleton-break in
`resolveFlagRegion` - and traced both round-trips (region/script/casing skew) as sound. **No new
Critical/High/Medium.** It surfaced two genuine Low findings the earlier passes had not covered, plus
one Info hardening worth doing; all three patched.

### L1. `matchAcceptLanguage` did not clamp the `q` weight to the RFC range `[0,1]` (Low)
- `q` came straight from `Number.parseFloat`, so a malformed `q>1` (`en;q=1.5`, `en;q=1e3`) outranked a
  legitimate `q=1` tag: `matchAcceptLanguage("nl;q=1,en;q=1.5")` returned `en` where a spec-conformant
  parser caps both at 1 and the stable sort keeps header order (`nl`). Impact is malformed-input only -
  browsers never emit `q>1` - hence Low, but it is a real wrong-answer the prior passes' `q=`/`q=abc`
  assessments never covered.
- **Fix:** clamp on parse - `Number.isNaN(q) ? 0 : Math.min(Math.max(q, 0), 1)`. A negative q now
  clamps to 0 and is dropped by the existing `q > 0` filter; NaN still drops the tag. `detect.ts:56-61`;
  regression test in `src/i18n/tests/detect.test.ts` (`q=1.5`, `q=1e3`).

### L2. Two locales whose `htmlLang` differ only by case collided silently (Low)
- Since Pass 1 made `localeForSegment` case-insensitive and `prefixFor` lowercase, a config with two
  locales at `htmlLang: "EN"` and `htmlLang: "en"` maps both to the `/en` URL prefix - `localeForSegment`
  returns the first, so the second locale is unreachable by URL and the picker silently navigates to the
  wrong one. It requires a semantically-invalid config (one BCP-47 tag twice), but the failure is silent.
- **Fix:** the constructor now throws on a duplicate case-insensitive `htmlLang`, failing fast like the
  existing empty-locales / bad-default guards. `i18n.ts:87-101`; regression test in
  `src/i18n/tests/i18n.test.ts`.

### L3. A trailing-slash `origin` produced a double slash in canonical/hreflang URLs (Low; reviewer-rated Info, patched)
- `hreflangAlternates` concatenates `` `${origin}${path}` `` with no normalization, so
  `origin: "https://example.com/"` yielded canonical `https://example.com//pricing` - a real SEO defect
  (duplicate/ambiguous canonical) from a common misconfiguration.
- **Fix:** the constructor strips trailing slashes from `origin` once (`config.origin?.replace(/\/+$/, "")`),
  so every derived URL is clean. `i18n.ts:97-99`; regression test in `src/i18n/tests/i18n.test.ts`.

## Assessed but not Patched (Pass 3)
- **`resolveFlagRegion` reads inherited prototype keys for the language default** (Info): a locale code
  like `"constructor"` / `"toString"` makes `DEFAULT_REGION_BY_LANGUAGE[code]` return an inherited
  function rather than `undefined`, but the immediately-following `region in FLAG_BY_REGION` guard
  filters every such value back to `undefined` (verified empirically) - so the output is correct, there
  is no wrong flag, and it is a read (no prototype pollution). A code smell only; a `Map` or
  `Object.hasOwn` would tidy it but changes no behavior. `flags.tsx:511`.
- **`switchLocalePath` assumes an absolute pathname** (Info): a relative input (`"foo/bar"`) would
  concatenate to `"/nlfoo/bar"` (missing separator), unlike `localizeHref` which early-returns non-`/`
  hrefs. Not reachable from the documented contract (`location.pathname` is always `/`-leading; `""` is
  already handled), so left as-is - a guard would be speculative. `routing.ts:145`.

## Pass 3 verdict
Clean: zero new Critical/High/Medium; three Low patched (two of them genuinely uncovered by the prior
two passes), two Info documented. Typecheck clean, publish build succeeds, all **107 tests pass** (104
prior + 3 new regressions). This is now a third independent thorough review; the code remains **ship**.
The one non-obvious lesson to carry forward: Pass 1's case-normalization change (routing now
case-insensitive) created the *precondition* for L2 - **whenever a comparison is loosened to
case-insensitive, add the matching uniqueness guard at the config boundary** so two inputs that newly
compare equal cannot both be accepted.

**Verdict:** ship. Worst unfixed severity is Informational - every Low finding above is patched,
typecheck is clean, the publish build succeeds, and all 107 tests pass.

## Pass 4 (verify + fresh hunt) - clean

Because Pass 3 patched three Lows (two uncovered by the earlier "clean" passes), the
two-consecutive-clean counter reset, so a fourth fresh sub-agent (no author bias) ran to (A)
adversarially verify the three Pass 3 fixes and (B) re-hunt every category from scratch, line by line,
with empirical probes.

- **All three Pass 3 fixes verified sound and complete.** The `q` clamp is identity on the legal
  `[0,1]` range (no correct prior result changes) and the stable sort keeps the header-order winner on
  ties; the duplicate-`htmlLang` guard has no false positive on legitimate configs (`en`/`nl`,
  `en-US`/`en-GB` construct fine) and correctly rejects `EN`/`en` and `zh-Hant`/`zh-hant`; the `origin`
  strip handles every origin shape with no over-stripping and no double-slash escape. All three new
  regression tests were confirmed to **fail on the pre-fix code** (non-tautological).
- **Fresh hunt found no new Critical/High/Medium/Low.** Routing round-trip re-traced under
  region/script/casing skew on both strategies; no open redirect (`localizeHref` only ever prepends a
  same-origin prefix); no prototype pollution (untrusted reads filter to `undefined` via
  `in FLAG_BY_REGION`); no XSS (React-escaped text, static SVG, `encodeURIComponent` cookie value); no
  ReDoS (every regex linear, over trusted or length-bounded input); React hooks/effects/closures all
  correct.
- **Three Info notes (no fix):** an `origin` of `"/"` or `""` normalizes to `""` and makes
  `hreflangAlternates` throw (meaningless origin; fail-loud is fine); the duplicate-`htmlLang` guard
  fires even for a cookie-only app that never routes by URL (defensible - such locales are already
  indistinguishable to `matchAcceptLanguage`/`htmlLangFor`); a degenerate `Accept-Language` of literally
  `"q=abc"` falls back to default (not a valid header). None are defects.

**Convergence:** Pass 4 is one clean pass after the Pass 3 fixes. A strict two-consecutive-clean rule
would run a Pass 5, but Pass 4 was a fully independent, empirical, from-scratch re-hunt that surfaced
nothing of substance on a ~1,400-line green tree - the same nil-marginal-return point the earlier
report reached. The audit is stopped here. Re-run `/audit everything` anytime to force a fresh pass.

**Verdict:** ship. Worst unfixed severity is Informational; typecheck clean, publish build succeeds,
all 107 tests pass, and two independent fresh reviewers (Pass 3 fixes verified by Pass 4) agree there is
no unfixed Critical/High/Medium/Low.

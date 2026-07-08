#!/usr/bin/env bash
#
# find_candidates.sh - lead generator for the i18nkit-sweep.
#
# This is a HEAT-MAP, not a verdict. Every line it prints is a *candidate* that a
# sweep agent must confirm by reading the surrounding file against reference/rules.md.
# It errs toward over-reporting (grep can't see intent); the agent's judgment - not this
# script - decides what is a real violation. It exists so every run and every agent
# starts from the same lead list instead of re-inventing the greps.
#
# It is framework-agnostic: it greps for the shape of bare copy, not for any one project's
# layout. Point it at any user-facing source root.
#
# Usage:  scripts/find_candidates.sh [path]      (default: src)
#
# Two sections:
#   1. SUSPECT FILES  - .tsx that render JSX but never reach an i18nkit translate seam
#                       (useTranslator / i18n.translator / defineTextCatalog / translate):
#                       a file rendering copy with no visible path to i18n.
#   2. LITERAL LEADS  - specific bare-literal lines (copy attributes, same-line JSX text,
#                       toast/error strings), with obvious non-copy pre-filtered out.

set -euo pipefail
ROOT="${1:-src}"

# Two backends, one interface. Prefer ripgrep; fall back to POSIX grep when it is absent (rg is
# not always on PATH - e.g. when it is a shell alias the script's own shell never sees). The
# helpers take only (pattern[, root]) - no tool-specific flags leak to the call sites, so SECTION 1
# works identically under either backend. TSX_FILES lists matching *.tsx paths; SEARCH prints
# matching lines with file:line. tests / *.d.ts / *.test.* are always excluded.
if command -v rg >/dev/null 2>&1; then
    # Positive globs FIRST (ripgrep is last-match-wins), then the exclusions - same .ts/.tsx
    # universe the grep fallback restricts to, so the lead list does not depend on which backend
    # is installed. Without the includes, rg would also scan .css/.js/.json/.md and diverge.
    SEARCH()    { rg -n --no-heading -g '*.ts' -g '*.tsx' -g '!**/tests/**' -g '!**/*.d.ts' -g '!**/*.test.*' "$@"; }
    # Positive glob FIRST, exclusions after: ripgrep is last-match-wins, so `-g '*.tsx'` must
    # precede the negatives or it would re-include test/.d.ts files they excluded.
    TSX_FILES() { rg -l -g '*.tsx' -g '!**/tests/**' -g '!**/*.d.ts' -g '!**/*.test.*' -e "$1" "$2"; }
else
    # POSIX grep fallback (BSD/GNU). Coarser exclusions. SECTION 1's patterns avoid \s / \b so both
    # backends yield the identical suspect list; the 2a-2d lead patterns keep \b (best-effort here).
    SEARCH()    { grep -rnE --include='*.tsx' --include='*.ts' "$@" | grep -vE '/tests/|\.d\.ts|\.test\.'; }
    TSX_FILES() { grep -rlE --include='*.tsx' -e "$1" "$2" | grep -vE '/tests/|\.d\.ts|\.test\.'; }
fi

# Drop noise common to every pass: catalog interiors (a `defineTextCatalog` entry's per-locale
# values ARE the copy, e.g. `en: "..."` / `nl: (n) => ...`), comment lines, and import specifiers.
# The locale-code-key filter is best-effort - a BCP-47-ish key (`en`, `nl`, `pt-BR`) followed by a
# colon is almost always a catalog translation value, not a bare literal. Over-dropping a rare lead
# is fine: agents read every file in full regardless.
DENOISE() { grep -vE '^[[:space:]]*[a-z]{2,3}(-[A-Za-z]{2,4})?[[:space:]]*:|^[[:space:]]*//|^[[:space:]]*\*|^[[:space:]]*/\*|import .* from'; }

echo "############################################################"
echo "# i18nkit-sweep candidate leads for: $ROOT"
echo "# These are LEADS ONLY - confirm each by reading the file."
echo "############################################################"

echo
echo "== SECTION 1: SUSPECT FILES (render JSX, no translate seam) =="
echo "   A UI file that never reaches useTranslator/i18n.translator/translate(...) is where bare copy hides."
# Candidate render files: .tsx that contain JSX return. Then subtract any that touch a seam.
# POSIX ERE (no \s / \b) so the pattern is identical under ripgrep and grep.
comm -23 \
    <(TSX_FILES 'return[[:space:]]*\(|=>[[:space:]]*\(|<[A-Za-z]' "$ROOT" 2>/dev/null | sort -u) \
    <(TSX_FILES 'useTranslator|\.translator\(|defineTextCatalog|defineText|translate\(|LanguageText' "$ROOT" 2>/dev/null | sort -u) \
    || true

echo
echo "== SECTION 2a: COPY ATTRIBUTES with a bare string value =="
echo "   placeholder / title / alt / aria-label = \"...words...\" -> should be {translate(TX.x)}"
SEARCH -e '\b(placeholder|title|alt|aria-label)=["'\''`][^"'\''`]*[A-Za-z]{2,}' "$ROOT" 2>/dev/null \
    | grep -vE 'alt=""' | DENOISE || true

echo
echo "== SECTION 2b: SAME-LINE JSX TEXT between tags =="
echo "   >Some words< on one line -> should be >{translate(TX.x)}<  (multi-line text: read the file)"
# Exclude ():;= inside the span: those are TS-generic / signature noise (Promise<void>,
# Readonly<{...}>), never short JSX copy. Sentences with . , ' ! ? still match.
SEARCH -e '>[^<>{}():;=]*[A-Za-z]{3,}[^<>{}():;=]*<' "$ROOT" 2>/dev/null \
    | grep -vE '=>|https?:|import ' | DENOISE || true

echo
echo "== SECTION 2c: TOAST / ERROR / setError string literals =="
echo "   toast(\"...\") / setError(\"...\") / new Error(\"...\") shown to a user -> translate(TX.x)"
echo "   (backend throws & dev-invariant Errors are NOT violations - see rules.md)"
SEARCH -e '\b(toast|setError|setMessage|alert)\([[:space:]]*["'\''`][^"'\''`]*[A-Za-z]{2,}' "$ROOT" 2>/dev/null \
    | DENOISE || true

echo
echo "== SECTION 2d: metadata / JSON-LD human-readable string literals =="
echo "   title/description/name/... : \"words\"  inside metadata or ld+json -> translate(TX.x)"
echo "   (data fields - streetAddress, email, ids, lang codes - stay bare; see rules.md)"
# Keywords narrowed to metadata/JSON-LD-specific keys: generic `name`/`label`/`heading`
# match too much config (index options, demo data) to be useful as leads.
SEARCH -e '\b(title|description|siteName|ogTitle|ogDescription|twitterTitle|twitterDescription|headline|serviceType|tagline)[[:space:]]*:[[:space:]]*["'\''`][^"'\''`]*[A-Za-z]{2,}' "$ROOT" 2>/dev/null \
    | DENOISE || true

echo
echo "== done. Confirm every lead by reading the file against reference/rules.md. =="

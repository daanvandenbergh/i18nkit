#!/usr/bin/env bash
#
# scan.sh - the compile-invisible checks for i18nkit-add-locale.
#
# Adding a locale to `new I18n({ locales })` grows the union `L`, so `tsc` already hands you an
# exhaustive worklist of every catalog entry to translate. This script covers only the two things
# the compiler CANNOT see, because neither moves `L`:
#   1. BLOGKIT POST WORKLIST - the same-slug post file each default-locale article needs for the new
#      locale (@daanvandenbergh/blogkit localizes file-per-language with NO fallback, so a missing
#      file is a broken page), plus whether the base post carries a hero image to carry over.
#   2. HARDCODED LOCALE-LIST LEADS - app code that names locale codes as literals (generateStaticParams,
#      hreflang/sitemap builders, middleware matchers, locale switches) instead of reading i18n.list,
#      so the new locale is missing there until it is added by hand.
#
# Every line printed is a LEAD, not a verdict - confirm each by reading the file against
# reference/translation-rules.md. It errs toward over-reporting; the agent's judgment decides.
#
# Usage:   scan.sh <new-locale-code> [source-root]        (source-root default: src)
# Env:     EXISTING_CODES="en nl"   the currently-configured codes, for the hardcoded-list grep
#          CONTENT_DIR="./blog"     blogkit content root (from the Blog config; default ./blog)
#          EXT=".mdx"               blogkit post extension (from the Blog config; default .mdx)
#          CONFIG_FILE="app/i18n.ts"  the I18n config file to exclude from leads (it is meant to
#                                     name every code; excluding it drops the obvious false leads)

set -euo pipefail

NEWCODE="${1:-}"
ROOT="${2:-src}"
EXISTING_CODES="${EXISTING_CODES:-}"
CONTENT_DIR="${CONTENT_DIR:-./blog}"
EXT="${EXT:-.mdx}"
CONFIG_FILE="${CONFIG_FILE:-}"

if [ -z "$NEWCODE" ]; then
    echo "usage: scan.sh <new-locale-code> [source-root]   (EXISTING_CODES / CONTENT_DIR / EXT / CONFIG_FILE via env)" >&2
    exit 2
fi

echo "############################################################"
echo "# i18nkit-add-locale compile-invisible scan"
echo "#   new locale : $NEWCODE"
echo "#   source root: $ROOT"
echo "#   blog dir   : $CONTENT_DIR  (extension $EXT)"
echo "# These are LEADS ONLY - confirm each by reading the file."
echo "############################################################"

# ---------------------------------------------------------------------------
echo
echo "== SECTION 1: BLOGKIT POST WORKLIST (file-per-language, no fallback) =="
echo "   For each default-locale post, the $NEWCODE/<slug>$EXT that must exist. blogkit has no"
echo "   silent fallback, so a MISSING file renders as a broken page."
if [ -d "$CONTENT_DIR" ]; then
    found_post=0
    for post in "$CONTENT_DIR"/*"$EXT"; do
        [ -e "$post" ] || continue
        found_post=1
        base="$(basename "$post")"
        target="$CONTENT_DIR/$NEWCODE/$base"
        # A hero is an `image:` line inside the leading front-matter block; grep the whole file as a
        # cheap lead (front-matter is at the top), the agent confirms it is in the `---`...`---` block.
        if grep -qE '^[[:space:]]*image:[[:space:]]*[^[:space:]]' "$post" 2>/dev/null; then
            hero="  [base has hero image - carry one over]"
        else
            hero=""
        fi
        if [ -f "$target" ]; then
            echo "   ok      : $target$hero"
        else
            echo "   MISSING : $target$hero"
        fi
    done
    if [ "$found_post" -eq 0 ]; then
        echo "   (no *$EXT posts in $CONTENT_DIR - nothing to translate here)"
    fi
    # Orphan translations: a $NEWCODE/<slug> whose base post is gone (stale after a rename/delete).
    if [ -d "$CONTENT_DIR/$NEWCODE" ]; then
        for tr in "$CONTENT_DIR/$NEWCODE"/*"$EXT"; do
            [ -e "$tr" ] || continue
            [ -f "$CONTENT_DIR/$(basename "$tr")" ] || echo "   ORPHAN  : $tr  (no base post - stale)"
        done
    fi
else
    echo "   (no $CONTENT_DIR directory - blogkit not detected; skip this section unless the blog"
    echo "    content root lives elsewhere, then re-run with CONTENT_DIR set)"
fi

# ---------------------------------------------------------------------------
echo
echo "== SECTION 2: HARDCODED LOCALE-LIST LEADS =="
echo "   Lines naming existing codes as string literals - these do NOT follow the locale union L,"
echo "   so $NEWCODE is missing there until added (prefer deriving the list from i18n.list)."

if [ -z "$EXISTING_CODES" ]; then
    echo "   (set EXISTING_CODES=\"en nl ...\" to scan for hardcoded lists - skipped)"
else
    # Build an alternation of the existing codes as QUOTED string literals ("en" / 'en'). Catalog
    # keys are unquoted (`en:`), so searching for the quoted form naturally skips catalog interiors
    # and matches array/param/enumeration usage - exactly the leads we want.
    alt=""
    for c in $EXISTING_CODES; do
        [ -z "$alt" ] && alt="$c" || alt="$alt|$c"
    done
    PATTERN="[\"']($alt)[\"']"

    # Two backends, one interface (mirrors find_candidates.sh): prefer ripgrep, fall back to POSIX
    # grep. Restrict to the .ts/.tsx universe and exclude tests / .d.ts.
    if command -v rg >/dev/null 2>&1; then
        SEARCH() { rg -n --no-heading -g '*.ts' -g '*.tsx' -g '!**/tests/**' -g '!**/*.d.ts' -g '!**/*.test.*' "$@"; }
    else
        SEARCH() { grep -rnE --include='*.tsx' --include='*.ts' "$@" | grep -vE '/tests/|\.d\.ts|\.test\.'; }
    fi

    # Drop the config file (it is meant to name every code) and comment/import lines.
    DENOISE() {
        if [ -n "$CONFIG_FILE" ]; then
            grep -vF "$CONFIG_FILE" | grep -vE '^[^:]*:[0-9]+:[[:space:]]*(//|\*|/\*)'
        else
            grep -vE '^[^:]*:[0-9]+:[[:space:]]*(//|\*|/\*)'
        fi
    }

    leads="$(SEARCH -e "$PATTERN" "$ROOT" 2>/dev/null | DENOISE || true)"
    if [ -n "$leads" ]; then
        printf '%s\n' "$leads"
    else
        echo "   (no hardcoded locale-code literals found - locales likely derive from i18n.list)"
    fi
    [ -z "$CONFIG_FILE" ] && echo "   NOTE: pass CONFIG_FILE=<path to the I18n config> to drop its expected self-matches."
fi

echo
echo "== done. Confirm every lead by reading the file against reference/translation-rules.md. =="

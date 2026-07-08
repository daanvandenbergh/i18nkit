#!/usr/bin/env bash
#
# scan.sh - the compile-invisible checks for i18nkit-add-locale.
#
# Adding a locale to `new I18n({ locales })` grows the union `L`, so `tsc` already hands you an
# exhaustive worklist of every catalog entry to translate. This script covers only the two things
# the compiler CANNOT see, because neither moves `L`:
#   1. BLOGKIT POST WORKLIST - for each post folder <slug>/, the <slug>/<newcode> body the new locale
#      needs beside the default (@daanvandenbergh/blogkit localizes file-per-language inside a per-slug
#      folder with NO fallback, so a missing file is a broken page), plus whether the post has a
#      hero.js whose per-locale text map + rendered JPEG must gain the new locale.
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
#          DEFAULT_CODE="en"        blogkit default locale (names the base body <slug>/<default><ext>;
#                                   from the Blog config; default en)
#          EXT=".mdx"               blogkit post extension (from the Blog config; default .mdx)
#          CONFIG_FILE="app/i18n.ts"  the I18n config file to exclude from leads (it is meant to
#                                     name every code; excluding it drops the obvious false leads)

set -euo pipefail

NEWCODE="${1:-}"
ROOT="${2:-src}"
EXISTING_CODES="${EXISTING_CODES:-}"
CONTENT_DIR="${CONTENT_DIR:-./blog}"
DEFAULT_CODE="${DEFAULT_CODE:-en}"
EXT="${EXT:-.mdx}"
CONFIG_FILE="${CONFIG_FILE:-}"

if [ -z "$NEWCODE" ]; then
    echo "usage: scan.sh <new-locale-code> [source-root]   (EXISTING_CODES / CONTENT_DIR / DEFAULT_CODE / EXT / CONFIG_FILE via env)" >&2
    exit 2
fi

echo "############################################################"
echo "# i18nkit-add-locale compile-invisible scan"
echo "#   new locale : $NEWCODE"
echo "#   source root: $ROOT"
echo "#   blog dir   : $CONTENT_DIR  (default $DEFAULT_CODE, extension $EXT)"
echo "# These are LEADS ONLY - confirm each by reading the file."
echo "############################################################"

# ---------------------------------------------------------------------------
echo
echo "== SECTION 1: BLOGKIT POST WORKLIST (folder-per-slug, file-per-language, no fallback) =="
echo "   Each post is a $CONTENT_DIR/<slug>/ folder with one <locale>$EXT body per language (the"
echo "   default is <slug>/$DEFAULT_CODE$EXT, or the neutral <slug>/post$EXT). For each, the"
echo "   <slug>/$NEWCODE$EXT that must exist. blogkit has no silent fallback, so a MISSING file"
echo "   renders as a broken page."
if [ -d "$CONTENT_DIR" ]; then
    found_post=0
    for dir in "$CONTENT_DIR"/*/; do
        [ -d "$dir" ] || continue
        slug="$(basename "$dir")"
        # The default-locale body names the post: prefer <default>$EXT, fall back to the neutral post$EXT.
        if [ -f "$dir$DEFAULT_CODE$EXT" ]; then
            base="$dir$DEFAULT_CODE$EXT"
        elif [ -f "${dir}post$EXT" ]; then
            base="${dir}post$EXT"
        else
            base=""
        fi
        if [ -z "$base" ]; then
            # No default-locale body: any <locale>$EXT here is an orphan translation (base renamed/
            # deleted). A folder with no bodies at all is not a post - stay quiet.
            for tr in "$dir"*"$EXT"; do
                [ -e "$tr" ] || continue
                echo "   ORPHAN  : $tr  (no $DEFAULT_CODE$EXT / post$EXT base body in $slug/ - stale)"
            done
            continue
        fi
        found_post=1
        target="$dir$NEWCODE$EXT"
        # The hero is one <slug>/hero.js exporting (locale)=>params with a per-locale `text` map; the new
        # locale needs a `text` entry there AND a rendered public/.../hero.$NEWCODE.jpg (translation-rules.md).
        if [ -f "${dir}hero.js" ]; then
            hero="  [has hero.js - add \"$NEWCODE\" to its text map + render hero.$NEWCODE.jpg]"
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
        echo "   (no <slug>/ post folders with a $DEFAULT_CODE$EXT / post$EXT body in $CONTENT_DIR - nothing to translate here)"
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

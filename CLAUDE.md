# Project: i18nkit

i18nkit is a TypeScript package for 100% type-safe i18n on websites (frontend and backend): declare
your locales once and the compiler flags every string still missing a translation. A framework-agnostic
core plus an optional React layer. Also offering agent skills to check if everything is translated and to add a new language.

## Directory Architecture

```
skills/                             # The agent skills
  i18nkit-sweep                     # The skill for sweeping the entire project to check if everything is correctly translated
  i18nkit-add-locale                # The skill for adding a new language: edit the I18n config, then compiler-driven
                                    #   translate every catalog entry tsc now flags, plus scribekit posts + hardcoded locale lists
src/
  index.ts                          # Package root entry ("."), re-exports the i18n core module
  i18n/                             # Framework-agnostic core module -> "." entry. The I18n class
                                    #   (i18n.ts) plus its pure pieces: types, translate, catalog,
                                    #   detect (Accept-Language / cookie), routing (localized URLs).
  react/                            # React adapter -> "./react" entry (react as an optional peer):
                                    #   I18nProvider + hooks, LanguagePicker, LocaleLink, styles.css.
```
Each top-level `src/` folder is one module and maps to a package entry point. Future modules are new
siblings under `src/`. The public API is the `I18n` class - a consumer constructs one instance and
reaches every feature through its methods (`i18n.defineTextCatalog`, `i18n.translator`, `i18n.resolveLocale`, ...).

## Modular Coding
Organize the code as a set of **(semi-)isolated modules**, each with one clear goal, exposed through a
single public surface - the `I18n` class for the core, the barrel for `react` - instead of a sprawl of
loose functions imported from all over. `src/i18n/` is the reference.

Keep all of a module's files together inside that module - its logic, types, and tests -
never scattered into shared or global buckets elsewhere in the project. If something belongs
to a module, it lives in that module's directory, not across the tree. Public files live at
the module root; files that are not part of its public API go in an `internal/` subdirectory.
Modules may freely depend on other modules - isolation is about where a module's own code
lives, not about avoiding dependencies - and a small shared primitive many modules use (the
logger, `env`) is fine as its own module.

**Code lives in the module whose domain it concerns - even when you write it from somewhere
else.** If, while working in module A, you reach for logic, a type, an error, a constant, or a
check that really belongs to module B (its domain, its data, its vocabulary), add it to B's
public surface and call it from A. Do **not** inline a B-shaped thing inside A. This holds even
when B does not have it yet and only A needs it today: **extend B, then import it** - that is
exactly the moment the mistake happens (you needed something from B, B lacked it, so you wrote
it where you stood instead of where it belongs). Example: locale detection, URL routing, and text
resolution all live on the `I18n` core (`src/i18n/`) and are reached from `react/` as
`i18n.resolveLocale`, `i18n.localizeHref`, `i18n.translator`; the React layer does **not** re-implement
any of them. Own it where the domain lives, not where it is first used.

@node_modules/@daanvandenbergh/claudekit/rules/ts_coding_standards.md
@node_modules/@daanvandenbergh/claudekit/rules/core_principles.md
@node_modules/@daanvandenbergh/claudekit/rules/workflow.md
@node_modules/@daanvandenbergh/claudekit/rules/todo.md
@node_modules/@daanvandenbergh/claudekit/rules/ts_modular_coding.md
@node_modules/@daanvandenbergh/claudekit/skills/ts/audit-tests/claude-rules.md
@node_modules/@daanvandenbergh/claudekit/rules/active_sessions.md
@node_modules/@daanvandenbergh/scribekit/rules/docs_parity.md

## Agent Storage Directory
Agent storage - memory, tasks/plans, active sessions, reports, assets - lives in `.agentstore/` at
the repo root. This overrides every imported rule and every skill (claudekit, scribekit, ...)
wherever they say `claude/` - read and write `.agentstore/` instead: `.agentstore/memory/`,
`.agentstore/tasks/plans.md`, `.agentstore/active_sessions.md`, `.agentstore/reports/`,
`.agentstore/scribekit-hero/`, and so on. Never create a top-level `claude/` directory.
(`.claude/` - with the dot - is Claude Code's own config directory and is unrelated.)

## Web Testing
- After editing or developing any HTML (pages, components, markup), always inspect and
  test it in a real browser with the Claude-in-Chrome tool - never assume it renders or
  behaves correctly from reading the code alone.

## Git
- Never create new git branches unless asked, if you really feel it is needed, ask for permission first.

## Documentation Site
The public docs live in `docs/` - a Next.js App Router site built on `@daanvandenbergh/scribekit`,
statically exported and published to GitHub Pages at https://daanvandenbergh.github.io/i18nkit
by `.github/workflows/deploy.yml` on every push to `main`.

```
docs/
  app/
    layout.tsx                      # Root layout: scribekit styles.css + globals.css
    icon.svg                        # Favicon: white app tile, the 文 mark on the brand ramp
    (docs)/                         # Route group - the site IS the docs, pages serve at /<slug>
      _docs.ts                      # The single configured Docs instance (tabs, groups, siteUrl)
      _docs-chrome.tsx              # Navbar / tabs / sidebar / ⌘K search shell (client)
      _docs-links.tsx               # BodyLink + NavLink: base-path-aware in-body links
      _docs-image.tsx               # BaseImg: base-path-aware hero <img>
  content/
    hero.settings.js                # Shared hero gradient palette + brand (mirrors the README hero)
    <slug>/en.mdx                   # One page per slug; front-matter drives the nav
    <slug>/hero.js                  # That page's hero text, rendered by /scribekit-hero
  public/assets/logo-mark.svg       # Navbar logo: the bare 文 mark, no tile
```

Brand: scribekit's blue -> violet -> purple ramp (`#2563EB` -> `#6D5DF6` -> `#8A54D8`), shared with
scribekit and backupkit. The logo mark, the favicon tile, and the hero gradients are all coloured off
it - keep them in step.

Write and rewrite pages with `/scribekit-docs`; generate their heroes with `/scribekit-hero`; deploy
config is `/scribekit-docs-github-pages`.

## Maintained README.md
When making changes to the library, ensure the README.md instructions for how to use the library are
still up to date - and the `docs/content/` pages with it (see the docs-parity rule above).
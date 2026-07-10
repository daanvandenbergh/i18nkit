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

## Coding Standards
- Dont use `—`, instead use `-`.
- Use 4 spaces as 1 indent level.
- Write in commercial grade typescript which is ready for production.
- Ensure each function, class, method, interface, interface property has a docstring defining their behaviour.
- Never use @ts-ignore, @ts-nocheck, or similar directives that suppress real errors. `@ts-expect-error` is banned in library/source code too, with ONE exception: dedicated type-safety test files (`*.test-d.ts` / `*.test-d.tsx`), where `@ts-expect-error` *asserts* that an invalid construct is correctly rejected by the compiler. There it verifies type safety rather than hiding a bug - and `tsc` fails on an unused directive, so a regression breaks `npm run typecheck`. These files are validated by `tsc` (they are excluded from the vitest run glob), never executed.
- Place test files in a `tests/` subdirectory next to the code under test - never alongside the source files. Example: tests for `src/i18n/*.ts` live in `src/i18n/tests/*.test.ts`, tests for `src/*.ts` live in `src/tests/*.test.ts`.

## Core Principles

- **Simplicity First**: Make every change as simple as possible. Impact minimal code.  
- **No Laziness**: Find root causes. No temporary fixes. Senior developer standards.  
- **Minimal Impact**: Changes should only touch what's necessary. Avoid introducing bugs.

## Workflow Orchestration

### 1. Plan Mode Default
- Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions)
- If something goes sideways, STOP and re-plan immediately — don't keep pushing
- Use plan mode for verification steps, not just building
- Write detailed specs upfront to reduce ambiguity

### 2. Subagent Strategy
- Use subagents liberally to keep main context window clean
- Offload research, exploration, and parallel analysis to subagents
- For complex problems, throw more compute at it via subagents
- One task per subagent for focused execution

### 3. Self-Improvement Loop
- After ANY correction from the user: update `claude/memory/lessons.md` with the pattern
- Write rules for yourself that prevent the same mistake
- Ruthlessly iterate on these lessons until mistake rate drops
- Review lessons at session start for relevant project

### 4. Verification Before Done
- Never mark a task complete without proving it works
- Diff behavior between main and your changes when relevant
- Ask yourself: "Would a staff engineer approve this?"
- Run tests, check logs, demonstrate correctness

### 5. Demand Elegance (Balanced)
- For non-trivial changes: pause and ask "is there a more elegant way?"
- If a fix feels hacky: "Knowing everything I know now, implement the elegant solution"
- Skip this for simple, obvious fixes — don't over-engineer
- Challenge your own work before presenting it

### 6. Autonomous Bug Fixing
- When given a bug report: just fix it. Don't ask for hand-holding
- Point at logs, errors, failing tests — then resolve them
- Zero context switching required from the user
- Go fix failing CI tests without being told how

## Task Management

1. **Plan First**: Write plan to `claude/tasks/plans.md` with checkable items  
2. **Verify Plan**: Check in before starting implementation  
3. **Track Progress**: Mark items complete as you go  
4. **Explain Changes**: High-level summary at each step  
5. **Document Results**: Add review section to `claude/tasks/plans.md`  
6. **Capture Lessons**: Update `claude/memory/lessons.md` after corrections  

## Deferred Work (TODO.md)
`TODO.md` (repo root) tracks work that is needed but cannot be done yet - blocked on a
missing prerequisite, a file or entrypoint that does not exist, or a later step. When you
hit such a case, do NOT silently skip it: add a `- [ ]` item to `TODO.md` describing the
work and what unblocks it. This is not only code - capture **real-world / external
prerequisites** too, on your own initiative and without being asked. In particular, whenever
a change **asserts or relies on a fact that is not yet true** - a legal or registration action
(registering a trade name or entity, appointing a role), an external account, mailbox, DNS
record or domain, a vendor or dashboard setting, or any manual ops step - add the item that
makes it true. Rule of thumb: if the code now claims something the real world has not caught
up to (e.g. the README states the package is published to npm before it actually is), that
gap is a `TODO.md` item by default. When you have verified an item from the
list is done, mark it `- [x]`, then delete the line - finished items must not linger. Keep the
list to genuinely-pending, actionable items.

**Write each item as a copy-paste-ready prompt.** Phrase every `- [ ]` so it can be pasted
verbatim into a fresh Claude Code session and fixed with no other context. State what to do, the
exact files/paths/functions involved, what is currently wrong or missing, what "done" looks like,
and any command to run or check to verify. Be clear, descriptive, and detailed enough to act on
cold - assume the session has none of the context you have now; a stub like "fix the schema" is
not enough.

## Unit Tests
After writing any code, write meticulous unit tests. This is critical, non-negotiable.
- Test every single edge case - happy path, error path, boundaries, empty/null inputs, malformed data.
- Aim for 100% coverage. Every branch, every line.
- Write as many tests as needed - never skimp on tests to save effort.
- Code without its tests is unfinished.

## Web Testing
- After editing or developing any HTML (pages, components, markup), always inspect and
  test it in a real browser with the Claude-in-Chrome tool - never assume it renders or
  behaves correctly from reading the code alone.

## Git
- Never create new git branches unless asked, if you really feel it is needed, ask for permission first.

## Maintained README.md
When making changes to the library, ensure the README.md instructions for how to use the library are still up to date.
# Project: i18nkit

i18nkit is a typescript package managed to handle type safe i18n for websites frontend and backend. Also offering an agent skill to check if everything is translated.

## Directory Architecture

```
skills/                             # The agent skills
  i18nkit-sweep                     # The skill for sweeping the entire project to check if everything is correctly translated
src/
  index.ts                          # Package root entry ("."), re-exports the blog module
```
Each top-level `src/` folder is one module and maps to a package entry point. Future
server modules (e.g. `comments/`, `database/`) are new siblings under `src/`.

## Modular Coding
Organize the backend as a set of **(semi-)isolated modules**, each with one clear goal,
exposed through a single public surface - a namespace like `Posts` or `Database` - instead of
a sprawl of loose functions imported from all over. `src/blog/` is the reference.

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
it where you stood instead of where it belongs). Examples: the "does this post exist?"
check and `UnknownPostError` live on the `Posts` namespace, not in `comments`
(which calls `Posts.assertExists`); duplicate-key detection lives on `Database`
(`isDuplicateKeyError`, a generic database concern), not in every module that inserts. Generic
infrastructure (database error codes, connections) belongs to `db`; domain logic belongs to that
domain's module. Own it where the domain lives, not where it is first used.

## Coding Standards
- Dont use `—`, instead use `-`.
- Use 4 spaces as 1 indent level.
- Write in commercial grade typescript which is ready for production.
- Ensure each function, class, method, interface, interface property has a docstring defining their behaviour.
- Never use @ts-expect-error, @ts-ignore, @ts-no-check or similar directives.
- Place test files in a `tests/` subdirectory next to the code under test - never alongside the source files. Example: tests for `src/blog/*.ts` live in `src/blog/tests/*.test.ts`, tests for `src/*.ts` live in `src/tests/*.test.ts`.

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
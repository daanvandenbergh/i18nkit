---
name: audit
description: Run a phased, production-grade audit of a code module - security, code quality, deep call-chain logic, and test coverage - then fix what it finds, verify the build and tests, and write a versioned last_audit.md report. Use when the user wants to audit, security-review, harden, or quality-check a backend or frontend module or area (e.g. /audit customers, /audit api/vapi). Takes a module path or area plus an optional --plan flag that gates every fix behind explicit approval. Supports multi-pass iterative auditing via fresh sub-agents.
user-invokable: true
argument-hint: "<module-path> [--plan]"
---

# audit

A phased audit that adapts to whatever project it runs in. It is **stack-agnostic**: it
learns the project's conventions first (Phase 0), then checks the code against *those*,
not against any one framework's vocabulary. It finds bugs, security holes, and quality
issues, fixes them, verifies, and writes a `last_audit.md` report. Iterative: each pass
after the first is run by a fresh sub-agent to defeat reviewer bias.

The single rule that keeps it sharp: **every check = a named failure mode + a concrete
probe + a default severity, with any project-specific token resolved from the project's
own docs and code at audit time.** "Check that auth exists" finds nothing. "Every
entrypoint returning non-public data checks the caller owns *this* record; a client-supplied
ID trusted without an ownership check is IDOR (Critical)" bites on any stack.

## Inputs

Everything after `/audit` arrives as one raw string. Parse it in prose:

1. Extract `--plan` if present, then strip it. The remainder is the **module path or area**.
2. `--plan` enables **Plan Mode**: every pass lists all findings and waits for explicit
   approval before any fix is applied. It is audit-wide state - it propagates to every pass
   and every spawned sub-agent. Off by default.

---

## Phase 0: Project profile and preparation

### 0.1 Build the project profile (the thing that makes this universal)

Before reading source for findings, learn the project's conventions. Read, in priority
order: (1) the project's standards doc - `CLAUDE.md` and any docs it points to - the
canonical source; (2) `tsconfig.json` (path aliases, target), `package.json` (build / test
/ dev / lint scripts, and deps that reveal the validator, test runner, logger, DB driver),
`.eslintrc` / `.prettierrc` (indent, naming); (3) the actual directory tree and a few real
source files, to confirm the layout and idioms instead of assuming them.

Resolve only the slots the checks below reference: **naming + indent + export style + path
alias**, **logging API and log shape**, **error convention** (throw vs Result-type),
**auth / identity mechanism**, **tenant-scope key** (e.g. `organizationId`, `uid`,
`tenantId`), **money representation** (integer minor units vs decimal type), **validation
library**, **DB collection / index / validator conventions**, **sanitization helper (if
any)**, **test layout + framework + isolation idiom**, **build / test / dev commands + dev
URL**, **file-header policy**, **planning/roadmap doc path (if any)**.

Two non-negotiable guardrails:
- **Code is the adjudicator, the doc is the ceiling.** Use the standards doc to raise
  precision, but if it is thin, missing, or contradicts the code, say so in the report and
  derive the convention from the code itself (grep the actual auth guard, the actual tenant
  field, the actual money type), then audit against what the code does.
- **Never fall back to a baked-in default.** If a slot cannot be determined from doc or
  code, state that and ask, rather than importing some other project's convention.

### 0.2 Resolve scope

Map the path argument to a directory or glob: try it as a literal path; else search the
source root(s) (from the profile) for a directory matching the name; if zero or several
match, list the candidates and ask. No hardcoded path table.

### 0.3 Enumerate files

List the source files in scope (the project's real extensions - `.ts`/`.tsx`/`.js`, etc.).
Exclude tests (the project's test layout, learned in 0.1), build output, and vendored code.
Count lines per file for the report's "Audit Scope" section.

### 0.4 Load previous audit

If `<scope>/last_audit.md` exists, read it to learn the current pass number and increment
for this audit; load prior findings to check for regressions. Treat the source - not the
prior report - as ground truth. If it does not exist, this is Pass 1.

> Run **all** categories below. Do not pre-filter by guessing the module's "type" and
> disabling checks - a category switched off for a misclassified module is exactly where a
> real bug hides. A category that genuinely does not apply (no paid APIs, no frontend) is a
> cheap skip, noted in the report, not a silent exclusion.

---

## Phase 1: Security audit

**Highest priority.** Read every file in scope line by line. Each check below: resolve the
project token from the profile, run the probe, and assign at least the noted severity floor.

- **S1. Authn / authz.** Every entrypoint (route, handler, tool-call, cron, RPC, event
  consumer) that reads or mutates non-public data establishes identity *and* checks the
  caller is allowed to touch **this specific resource** - not merely "logged in". Probe:
  enumerate entrypoints; for each, find where identity is established and per-object
  permission checked; flag any client-supplied resource ID used without an ownership check.
  Floor: missing = Critical (IDOR/BOLA, unauthenticated sensitive op).
- **S2. Tenant / data isolation.** Every query or command over tenant-owned data filters by
  the project's tenant key, takes that key from the authenticated principal (never the
  request body), and stamps it on every write. Probe: grep every read/write/aggregation over
  tenant collections; for pipelines confirm the filter is in the **first** stage. Floor:
  missing filter = Critical.
- **S3. Input validation at trust boundaries.** Every payload crossing a boundary (HTTP
  body/query/params, webhook, tool-call args, queue message, file upload, external data) is
  schema-validated - type, presence, bound, format, enum - with the project's validator,
  before use or persistence. Probe: per field check type + bound + format; string-length
  caps; numeric min/max; array maxItems; file size + MIME + **magic bytes**; regex for
  **ReDoS** (nested quantifiers, overlapping alternation); never persist raw external JSON
  unchecked. Floor: missing on a persisted/auth-relevant field = High.
- **S4. Injection.** No user-controlled data reaches an interpreter as code or structure:
  datastore query (SQL / NoSQL / query-operator smuggling), shell / `eval` (command),
  filesystem (path traversal), object keys (prototype pollution), HTML/DOM (XSS), templates
  (SSTI), deserializers. Probe: trace each sink back to its source; require
  parameterization/escaping/allowlisting; reject operator-shaped keys from user input;
  `Object.hasOwn` / null-proto for user key-value data; validate IDs against a format regex
  and confine resolved paths to a base dir. Floor: reachable = Critical/High.
- **S5. Secrets and error-information leakage.** Secrets never appear in logs, responses,
  client bundles, or error text; errors crossing a trust boundary carry no internal detail
  (stack traces, query text, internal IDs, collection/table names). Probe: scan log/response/
  error sites near secret-bearing values; confirm a public-vs-private split on diagnostics;
  confirm the client bundle ships no server secret. Floor: secret in client/logs = Critical;
  tenant data in an error = High.
- **S6. Idempotency and at-least-once handling.** Every externally delivered event (webhook,
  queue message, retried tool-call) is effect-exactly-once: deduped on a unique idempotency
  key via insert-or-ignore, with the duplicate-key error caught and treated as "already
  processed", and every side effect in the path is safe to run twice. Probe: find each
  external-event ingress; confirm a unique constraint on the key and that a duplicate is
  swallowed as success; per side effect ask "if this fires twice, what breaks?" (double
  charge, double booking, double email). Floor: missing on a money/state-changing event =
  Critical.
- **S7. Cost / quota** (only where paid third-party APIs exist). Every metered/paid call is
  gated by a quota or subscription check before the spend and reconciled after, with
  quota-release failures non-fatal; cost-incurring entrypoints are rate-limited. Probe: list
  outbound paid calls (LLM, telephony, SMS, geocoding, email); confirm pre-check + post-settle
  and that no unauthenticated/unbounded path can fan out paid calls (cost-DoS). Floor:
  unbounded paid path = High.
- **S8. Money / financial correctness.** Money is integer minor units or a fixed-decimal
  type, never float; rounding is explicit; currency is tracked; totals reconcile to line
  items; multi-document financial writes are atomic. Probe: scan for float arithmetic /
  `Math.round` / `parseFloat` / `*` / `+` on money fields; verify the unit at every boundary
  (cents vs major, 0-1 vs 0-100); confirm payment + invoice + ledger share one transaction.
  Floor: float money or non-atomic financial write = Critical.

---

## Phase 2: Code quality audit

- **Q1. Standards compliance (derived, never hardcoded).** Check against the project's own
  standards from the profile - naming, indent, import style, docstrings, banned constructs,
  export style, file-header policy, module layout. Never carry a house style from another
  repo. Floor: Low; but a mis-sourced standard makes the check itself invalid, so verify the
  source.
- **Q2. Error handling.** Every fallible op has a defined failure path; the project's error
  convention (throw vs Result vs error-return) is followed consistently; nothing is silently
  swallowed; partial failures leave recoverable state; cause chains are depth-bounded; no
  unhandled promise rejections. Floor: a swallowed error hiding a real failure = Medium/High.
- **Q3. Logging.** Uses the project's logger and levels; structured context, not string
  interpolation, where that is the convention; no secrets/PII in log args; no log spam in
  loops or hot paths; enough context to debug a failed run. Floor: secret in log = High.
- **Q4. DB / persistence patterns.** Indexes on queried fields; unique constraints backing
  any idempotency/dedup claim; DB-level validators on critical collections (the schemaless
  stand-in for NOT NULL / CHECK); TTL on ephemeral data; **referential integrity enforced in
  the accessor** before writing a referencing doc; no missing `await` on writes; pagination
  on unbounded reads. Floor: missing unique index behind an idempotency claim = High.
- **Q5. Concurrency / races.** Read-modify-write is atomic or locked; TOCTOU windows
  identified and documented-if-accepted; no shared mutable state across requests; concurrent
  create paths handle duplicate-key. Probe: walk every `await` boundary - what else can
  mutate this record in between. Floor: lost-update on money/state = Critical/High.
- **Q6. Performance.** No N+1 (batch instead); no unbounded result sets (paginate); no
  event-loop-blocking work in hot paths; no redundant recomputation in loops. Floor: N+1 on a
  hot path = Medium.
- **Q7. Frontend** (only for UI modules). Session-expiry handled on **every** data path (not
  just some); stale data cleared on cache-key change; effect cleanup cancels async work and
  unsubscribes; loading and error states handled and recoverable; async races guarded
  (generation counters / abort controllers); UI text follows the project's i18n approach if
  it has one. Floor: an unhandled error state or a leaked async update = Medium.

---

## Phase 2.5: Deep logic and call-chain audit

**Highest priority, alongside Phase 1.** Phases 1 and 2 catch *category* bugs. This phase
asks whether the code computes the **right answer** - it is where most Critical/High bugs
hide. Approach the code as a skeptical staff engineer who assumes the implementation is
wrong until proven right. Do not collapse logic bugs into Medium out of habit.

- **L1. Trace every public entrypoint end to end.** For each exported function, endpoint,
  tool, and event handler, walk the call chain from entry to every terminal side effect (DB
  write, network call, response, error path). For each step: what does it assume about its
  inputs and the state of the world, and where is that assumption enforced? Flag any
  assumption not established upstream. Write a one-line contract (pre/post/side-effects) and
  verify the body satisfies it.
- **L2. State-machine and lifecycle correctness.** Enumerate every state a domain object can
  be in. For each transition verify the source-state guard, target validation, side-effect
  ordering, idempotency, and failure-rollback. Specifically: can a terminal state
  (completed/cancelled/deleted) be re-entered or mutated? Can two states coexist? Can a
  transition fire concurrently from two requests?
- **L3. Invariant verification.** List the invariants the code must preserve (e.g. "a visit
  belongs to exactly one job", "usage never exceeds quota", "totals sum to line items"). For
  each, read both the code that establishes it and the code that could violate it; confirm
  the pairing holds under concurrency, partial failure, and retry.
- **L4. Money, time, and unit math.** Money arithmetic uses the project's mandated money
  representation, never floats - hunt `* 1.0`, `+`, `Math.round`, `parseFloat` on currency.
  Examine time-zone / duration / DST math explicitly - naive `Date` math, `setHours(0,0,0,0)`
  on user-local times, ISO-string concatenation. Verify every unit-bearing field (bytes,
  seconds, cents, 0-1 vs 0-100) at each boundary crossing.
- **L5. Async, concurrency, and ordering.** At every `await`, ask what other request could
  mutate the same document before the next operation. Check every `Promise.all`, `for await`,
  and unawaited promise for error propagation and ordering. Confirm every read-modify-write is
  atomic or guarded by a lock/version field.
- **L6. Error path and failure-mode coverage.** For each `try`/`catch`: what in the `try` can
  throw, and is each type handled or silently swallowed? Confirm retries do not amplify side
  effects (retried payment, retried email). Confirm partial failures (DB write succeeded,
  downstream failed) leave a recoverable state.
- **L7. Dead, unreachable, contradictory code.** Find branches unreachable given upstream
  validation, always-true/false conditions, defensive checks that contradict a stronger
  guarantee elsewhere. Dead code is Low by itself but often a symptom of a deeper bug - ask
  why it exists.
- **L8. Cross-file consistency.** When a type/contract is defined in one file and consumed in
  another, read both; confirm field names, optionality, and units match. When a field is
  written by module A and read by module B, confirm both agree on shape.

Logic bugs that affect data integrity, money, auth, idempotency, or a core flow are
**Critical or High** by default - do not downgrade because the call site "looks defensive".

---

## Phase 3: Testing and verification

1. **Review tests.** Read the module's tests (the project's test layout). Check coverage
   (public functions, edge cases, error paths, security-critical paths) and isolation (the
   project's isolation idiom - cleanup, no cross-test bleed).
2. **Build.** Run the project's build command (from the profile) - it must compile with zero
   errors. Fix before proceeding.
3. **Tests.** Run the project's test command (scoped to the module if it supports it). All
   must pass. Inspect full output, not a grepped slice.
4. **Visual check (frontend only).** Verify UI changes in a real browser with the project's
   browser-testing tool. Honor the project's rule on starting the dev server (if it says ask
   the user, ask - do not start it yourself). Use the project's test account.

---

## Phase 4: Fix workflow

### 4.0 Plan-mode gate (only when `--plan` is set)

Stop before applying any fix. Aggregate every finding (Phases 1, 2, 2.5, 3) into one
message, numbered and grouped by severity (Critical first), each with: severity, short
title, `file:line`, one-sentence description, proposed fix. End with: *"Plan mode is active.
Reply `approve` to apply all, `approve <numbers>` for a subset, or `skip` to abort this
pass."* Wait for the reply; do not edit until approved. On `skip`, jump to Phase 5 and mark
findings "deferred - plan-mode skip". This gate runs on every pass.

### 4.1 Severity and decision

| Severity | Action |
|----------|--------|
| **Critical** | Fix immediately, before anything else. Block the report until patched. |
| **High** | Always fix in the pass it is found. |
| **Medium** | Always fix unless a documented architectural blocker. |
| **Low** | Fix unless disproportionate risk; document if not. |
| **Informational** | Document only. |

Full definitions and worked examples: `reference/severity.md`.

### 4.2 Fix rules

1. Read the file in this session before editing - never rely on memory from a prior session.
2. Check both variants - if you fix a create path, fix the edit path too (and forward/reverse).
3. Update fixtures - when you add a field to a model, update every test factory/fixture for it.
4. Re-run build + tests after fixes to confirm no regression.
5. Track each fix: severity, description, `file:line`, what changed.

### 4.3 Assessed but not patched

Document (with reasoning) when the fix needs disproportionate refactoring relative to risk,
the issue is theoretical with negligible impact, it is inherent to an accepted pattern (e.g.
TOCTOU in confirm-then-act), or the fix would break another invariant. Never leave an issue
unaddressed without justification. Do not re-flag patterns the project's standards sanction
or risks already recorded as accepted.

---

## Phase 5: Report generation

Write `<scope>/last_audit.md` (committed - it drives pass numbering and history). Append the
new pass; never modify prior-pass sections.

```markdown
# <Module Name> - Last Audit

**Last audit date:** YYYY-MM-DD (Pass N)

## Issues Found and Patched (Pass N)

### C1. <title> (Critical)
- <what it is, why it matters, the failure mode or attack surface.>
- **Fix:** <what changed, file:line.>

### H1. <title> (High)
...   (then M, then L, numbered per severity per pass, Critical-first)

## Assessed but not Patched (Pass N)
- **<title>** (Info): <what it is, why not fixed, the accepted risk.>

## Recurring Findings
[If a finding repeats a shape from a prior pass or another module, note it - and add or
sharpen the entry in reference/recurring-patterns.md so future passes scan for it first.]

## Security Assessment
[Auth, tenant isolation, input validation, injection, idempotency, secrets/error leakage,
cost/quota, money - what was verified, and any remaining gap.]

## Known Deviations
[Accepted deviations from the project's standards, with severity and rationale.]

## Audit Scope
Files audited line-by-line (~N,NNN total lines):
- `file.ts` - description (NNN lines)
```

**Verdict (replaces any numeric score):** the audit's verdict is the **worst unfixed
severity**. Any unfixed Critical or High = **do not ship**. State it in one line.

If the pass is clean, say "No issues found in this pass", then list the categories verified
and the scope.

---

## Phase 6: Multi-pass iteration

The goal is **honest convergence**. A reviewer who just patched the code is biased - it
treats the next pass as "verify my work" instead of "audit fresh", declares clean, and a
brand-new `/audit` on the same code reliably finds more. So:

**Every pass after Pass 1 MUST be run by a fresh sub-agent, not by the parent.** The parent's
only job in Phase 6 is to spawn it and wait.

Launch a `general-purpose` sub-agent (it must be able to write fixes and the report). Its
prompt must be self-contained and include: the exact scope path; the full flag set
(including `--plan` if active - it propagates); an instruction to invoke `/audit` from
scratch as a brand-new session, reading `last_audit.md` **only** for the pass number and
never as a "these areas are clean" filter; an explicit instruction to **re-read every file in
scope line by line** and to **run Phase 2.5 in full**; the framing **"Assume there are still
bugs in this code. Find them."**; and a warning that "the previous pass found nothing" is not
evidence of cleanliness, only that the previous reviewer did not look hard enough.

**Optional parallel sweep (good for early passes):** spawn four sub-agents at once, one each
for Phase 1, Phase 2, Phase 2.5, and Phase 3; merge and dedupe their findings into one pass.

**Convergence:** a pass is clean only with zero Critical, High, Medium, and zero new Low.
**Two consecutive clean passes are required to stop** - one biased agent can falsely declare
victory. Any new Critical or High resets the counter to zero.

---

## Reference

- `reference/severity.md` - full severity definitions, examples, the anti-downgrade rule.
- `reference/recurring-patterns.md` - stack-neutral bug archetypes to scan first; grows per
  project as passes find real bugs.

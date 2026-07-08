# Recurring patterns

Bug archetypes that recur across audits regardless of stack. Scan for these first - they
are cheap wins and the failure modes most likely to repeat. Each is phrased as the
**shape** of the bug; resolve the project's actual vocabulary (helper names, field names,
APIs) from the Project Profile.

This file is meant to **grow per project**. When a pass finds a real bug, and especially
when the same shape appears in more than one module, add (or sharpen) an entry here with a
one-line "found in <module>" note. Over time this becomes the project's own bite-list - the
thing that makes the audit smarter on the next run instead of starting from zero.

## Seed archetypes (stack-neutral)

- **Untrusted data into an LLM/prompt.** User- or DB-sourced text returned to a model
  (tool-call results, voice-agent context, prompt templates) without sanitization at the
  boundary. Check every field of every tool/return value, not just the obvious ones.
- **Missing tenant-key filter.** A read, write, or aggregation over tenant-owned data that
  does not filter by the project's tenant key, or takes the key from the request body
  instead of the authenticated principal. For pipelines, the filter must be in the first
  stage, not the last.
- **Non-idempotent external event.** A webhook / queue message / retried call whose side
  effect (charge, booking, email, state change) is not guarded by a unique idempotency key
  with insert-or-ignore. External delivery is at-least-once; assume it fires twice.
- **Session-expiry not handled on every data path.** An auth-failure response (401/expired)
  that triggers sign-out on some fetch paths but not others. Enumerate every path; they
  drift apart over time.
- **Stale data on key change.** A cache/hook keyed on a dynamic value that keeps showing the
  old value after the key changes. Clear data and error state when the key changes and no
  cache exists for the new key.
- **Unbounded recursion over external structures.** Traversing a `.cause` chain, a tree, or
  attacker-influenced nesting without a depth bound.
- **Read-modify-write without atomicity.** Read a document, compute, write it back, with an
  `await` in between that another request can interleave on. Use an atomic/conditional
  update or a version field.
- **Both-variants drift.** A fix applied to the create path but not the edit path (or
  forward but not reverse), so one half stays broken.

## Accepted (do not re-flag)

- **TOCTOU in confirm-then-act.** The window between "show confirmation" and "act" is an
  accepted trade-off unless the module has a transactional alternative. Record as
  Informational; do not patch repeatedly.
- Anything the project's own standards doc explicitly sanctions, and anything already
  recorded under "Known Deviations" / "Assessed but not patched" in a prior pass.

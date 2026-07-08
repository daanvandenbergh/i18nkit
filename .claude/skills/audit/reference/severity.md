# Severity model

Four levels plus Informational. Examples are stack-neutral - read them as shapes, not
as one project's vocabulary.

| Severity | Code | Definition | Examples | Action |
|----------|------|------------|----------|--------|
| **Critical** | `C` | A flaw that **already** causes data corruption, data loss, a security breach, financial loss, or breaks a core flow in production. | Unauthenticated sensitive endpoint; a query missing the tenant-key filter that returns another tenant's rows (IDOR/BOLA); money math on floats; a non-idempotent webhook that double-charges; a race that corrupts state; a secret in the client bundle. | Fix immediately. Surface in Pass 1. Block the report until patched. |
| **High** | `H` | A flaw that is **exploitable or reachable** under realistic conditions but has not yet caused damage, or a logic error with a clear failure path. | Missing validation that allows an oversized or malformed write; an injection vector via an unsanitized field; a wrong transaction boundary; an off-by-one that drops rows; a swallowed error hiding a real failure; an invariant that breaks under retry. | Always fix in the pass it is found. |
| **Medium** | `M` | A correctness or security issue with limited blast radius or exploitability. | Missing sanitization on a low-traffic field; partial coverage of a critical path; an error mis-classified as public/private; a missing index causing slow queries; a broken non-critical state transition. | Always fix unless there is a documented architectural blocker. |
| **Low** | `L` | A code-quality issue, minor inconsistency, or low-probability edge case. | Redundant code; naming; missing docstring; an inconsistent pattern; a minor performance inefficiency. | Fix unless disproportionate risk. Document the decision. |
| **Informational** | `Info` | A theoretical edge case, an accepted design trade-off, or an observation for later. | TOCTOU in a confirm-then-act pattern; a parameter kept for forward compatibility; a `__proto__` edge case in custom fields. | Document only. Do not patch. |

## Do not downgrade out of habit

If a bug touches **money, auth, data integrity, idempotency, or a core user flow, it is
Critical or High** - not Medium. The Deep Logic phase (2.5) is where these most often
surface, and it is exactly where a biased reviewer is tempted to soften them. Give a
logic bug the severity its blast radius earns, even when the call site "looks defensive."

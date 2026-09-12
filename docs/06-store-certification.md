# Store certification readiness

Mapped against the published App Review criteria and the "top ten failed certification checks".

## Top ten failures — status

| # | Failure | Status |
|---:|---|---|
| 1 | UI Actions with empty conditions | **N/A** — the application ships no UI Actions |
| 2 | Orphaned `sys_ui_list` from personalising lists in app scope | **Clean** — no list personalisation was performed while the scope was selected; nothing in the package |
| 3 | Missing / inappropriate table ACLs | **Done** — read/create/write/delete on all 5 tables (20 ACLs), viewer reads, admin configures |
| 4 | Missing Contact Support module | **Done** — module present. ⚠️ **Publisher action:** replace the placeholder `mailto:` |
| 5 | Homepages overriding the default | **N/A** — no homepage records |
| 6 | Unescaped Jelly / XSS in UI pages or macros | **N/A** — no Jelly. The widget uses Angular interpolation only, no `ng-bind-html`, no inline handlers |
| 7 | Client-callable Script Include without an ACL | **Done** — `client_callable_script_include` execute ACL on `SecOpsConsoleAjax`, and the script include re-checks `gs.hasRole` server-side |
| 8 | UI Pages without ACLs | **N/A** — no UI Pages. The REST endpoint has a `rest_endpoint` execute ACL |
| 9 | Dot-walking to `sys_id` | **Clean** — every read uses `getValue()` / `getUniqueValue()` |
| 10 | Modules without roles | **Done** — all 8 modules carry `x_335329_secops.viewer`. *This was caught by post-install verification: the Record API wrote `[object Object]` when passed Role objects, so module roles are set by role name* |

## Scoped coding rules

| Rule | Status |
|---|---|
| No `gs.log()` in scope | **Clean** — `gs.info/warn/error/debug` only, via `SecOpsLog` |
| No `gs.sleep()` | **Clean** — not used; retry design accounts for its absence |
| No `gs.nowDateTime()` | **Clean** — `GlideDateTime` used throughout |
| `GlideRecordSecure` where data reaches a user | **Done** — widget server script, `SecOpsConsoleAjax`, and all SecOps-table writes. Framework-internal config reads and audit writes use `GlideRecord` deliberately |
| No `eval` | **Clean** — template and JSON-path engines are pure string/structure operations |
| No global-scope shim to reach blocked APIs | **Clean** — everything lives in `x_335329_secops`. Global APIs are only *called* (`GSLog`, `AbstractAjaxProcessor`) under declared privileges |
| No GlideRecord in client scripts | **Clean** — client controller only calls `c.server.update()` |
| No hardcoded instance URLs, credentials or customer data | **Clean** — verified by inspection; demo data uses `example.com` |
| Bounded queries | **Done** — `setLimit` on every list/loop query; ingestion and indicator batches capped by property |

## Credential handling

| Requirement | Status |
|---|---|
| Secrets not in `sys_properties` | **Done** — all 10 properties are non-sensitive tuning. Documented in `properties.now.ts` |
| Platform credential store used | **Done** — `sys_alias` reference on the connector, resolved via `sn_cc.ConnectionInfoProvider` at call time |
| Null-safe when the alias is unreadable | **Done** — `getConnectionInfo` returning null produces a clear operator-facing error and **no HTTP call** |
| Secrets never logged | **Done** — `SecOpsJson.redact` on every request/response before the transaction table or system log. Unit-tested, and verified on the live instance (`api_key` stored as `***REDACTED***`) |
| Never silently downgrade to unauthenticated | **Done** — a connector configured for `basic`/`oauth2` with no profile sys_id fails rather than calling anonymously (unit-tested) |

## Cross-scope and dependencies

| Item | Status |
|---|---|
| `sys_scope_privilege` declared per operation per target | **Done** — 13 records, all `allowed` |
| No privileges exceeding target table permissions | **Done** — no delete privileges requested |
| Restricted Caller Access handled | **Done** — degrades to a reported skip; approval step documented in the install guide |
| Optional products not hard-required | **Done** — VR absent on the verified instance; app installs and runs |
| Dependency plugins documented | **Done** — see install guide prerequisites |

⚠️ **Publisher action:** declare the SIR dependency plugin (`com.snc.si_dep`) and, if you choose to
require it, the VR plugin on the `sys_app` record / `now.config.json` `dependencies` before
submission. Established Store SIR integrations declare `com.snc.si_dep` as a prerequisite.

## Required deliverables

| Deliverable | Status |
|---|---|
| Working use case, not a shell | **Done** — four capabilities, end-to-end ingestion smoke-tested live |
| Application menu | **Done** — 8 modules, all role-gated |
| Contact Support module | **Done** (placeholder address — see below) |
| Design Document | **Done** — [01-architecture.md](01-architecture.md) |
| Installation Guide | **Done** — [04-install-and-config.md](04-install-and-config.md) |
| Test Plan + results | **Partial** — 96 automated unit tests plus a live smoke test are in the repo. A formal Test Plan document mapping each test to an acceptance criterion is not written |
| Demo data hygiene | **Done** — sample records only, inactive, `example.com`, no credentials, `installMethod: 'demo'` |
| Clean install / uninstall / upgrade | **Install verified** three times on dev296062. Uninstall and upgrade-from-previous-version **not** exercised |

## Outstanding publisher actions

These are genuinely blocking a real submission and cannot be resolved from this repo:

1. **Vendor prefix.** The scope is `x_335329_secops`, which is *this development instance's*
   prefix, not a publisher prefix. Rename to your ServiceNow-assigned vendor prefix. This changes
   every table, role and property name — do it before accumulating data. (The originally specified
   `x_snc_secops_uni` is not usable: `snc` is ServiceNow's own prefix and the instance rejects it.)
2. **Contact Support module** — replace `mailto:support@example.com` in
   `src/fluent/ui/navigation.now.ts` with your published support channel.
3. **Declare dependencies** on the SIR dependency plugin (and VR if required).
4. **Run the Certification Self-Test Tool** on your vendor instance:
   *System Applications > All Available Applications* → **Validate Application**. It catches roughly
   90% of commonly found issues and is the cheapest pre-submission check available.
5. **Write the formal Test Plan** document, tracing each acceptance criterion to a test result.
6. **Exercise uninstall and upgrade** on a clean instance.
7. **Licensing decision** — `now.config.json` has no `licensing` block, so platform defaults apply.
   Decide `licensable`, `licenseModel` and `enforceLicense` before submission.
8. **Verify the VR promotion path** on a VR-enabled instance — see
   [07-vulnerability-response.md](07-vulnerability-response.md). It is unit-tested but has never
   run against real `sn_vul` tables.

## Known limitations (state these in the listing, do not hide them)

- **No in-process retry backoff.** Scoped apps have no `gs.sleep()`. Transient failures retry
  immediately; 429/503 are parked and expire. Rationale in
  [01-architecture.md](01-architecture.md#5-design-decisions-worth-knowing).
- **Deferred retries expire rather than replay.** Deliberate: only redacted bodies are stored.
- **Domain separation** is not explicitly implemented or tested. `sys_domain` exists on the SecOps
  tables the app writes to; an MSSP deployment needs domain testing before relying on it.
- **No ATF tests.** Verification is Node unit tests plus a live smoke test. Certification does not
  require ATF, but reviewers view it favourably.

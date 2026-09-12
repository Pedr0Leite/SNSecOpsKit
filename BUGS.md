# BUGS.md

Generated: 2026-09-11
App scope: `x_335329_secops` (SecOps Universal Connector Framework)

---

## RESOLUTION — all 21 findings fixed (2026-09-12)

Every finding below has been fixed, rebuilt and reinstalled on dev296062.

| Verification | Result |
|---|---|
| Fixes applied | 21 of 21 |
| Test suite | 119 passing (98 original + 21 new regression tests in `test/regressions.test.js`) |
| Mutation-tested | Reintroducing BUG-001 and BUG-009 each fails exactly its own regression test; restoring passes all 21. The tests have teeth. |
| Live re-verification | Ingestion 201, redaction intact (`api_key` → `***REDACTED***`), `first_seen` now populated, malformed body → 400, health 200 |

**Two findings were invisible to the original suite because `test/harness.js` implemented platform
methods that do not exist** (`ConnectionInfo.getConnectionUrl`, `GlideOAuthClient.refreshToken`).
The doubles have been narrowed to the documented API surface, and the harness now also models
dot-walked queries, reference display values, and journal fields returning nothing from
`getValue()` — so the mistakes in BUG-002, BUG-005 and BUG-012 are now detectable too. A test
double that is more capable than the platform is worse than no double at all.

### Notable resolutions

- **BUG-001** `info.getConnectionUrl()` → `info.getAttribute('connection_url')`. This was breaking
  the framework's *default and recommended* auth mode entirely.
- **BUG-003** `run()` now downgrades `ok` and populates `error` when a mapped write is refused, and
  `contain()` surfaces `writes` instead of discarding it.
- **BUG-004 / BUG-015** Verdicts are now monotonic: `rollUpFinding` refuses to lower an existing
  finding (new `isUpgrade`), and the phishing path writes `finding` on insert only (new
  `insertOnly` option on `SecOpsTargetWriter.write`), routing updates through the guarded roll-up.
  A sandbox outage can no longer erase a known-bad verdict.
- **BUG-010** Coalesce is all-or-nothing: a partial key inserts rather than updating the wrong row.
- **BUG-016** The dead OAuth refresh is gone, replaced by `reportExpiredCredential()` which logs an
  actionable, auth-type-specific diagnostic. Retrying a dead grant can lock out a service account,
  so the framework reports instead of guessing.
- **BUG-019** Redaction now fails **closed** at the recursion limit (`***DEPTH_LIMIT***`).
- **BUG-011** New `x_335329_secops.detonate.max_indicators` property (default 15) replaces the
  misused bulk-ingestion cap of 500 synchronous calls.

### Deliberate deviation from a suggested fix

**BUG-016** suggested optionally implementing refresh via `requestTokenByRequest`. Not done: it
would require storing the OAuth *entity name* on the connector and re-authorising a grant the
platform has already declared dead. Reporting is the correct behaviour; the rationale is in the
code comment.

The findings below are preserved verbatim as the original audit record.

Files scanned:

- `src/script-includes/*.js` (16 files)
- `src/business-rules/*.js` (2), `src/rest/*.js` (2), `src/jobs/*.js` (3)
- `src/widget/secops-console.{server.js,client.js,html}`
- `src/fluent/**/*.now.ts` (tables, ACLs, roles, cross-scope, properties, REST, widget, jobs, BRs, demo data)
- `test/harness.js` (used as evidence for two findings)

Doc references used: `api-reference/server-api-reference/connection-info-api.md`,
`connection-info-provider-api.md`, `c_RESTMessageV2API.md`, `c_GlideOAuthClient.md`,
`c_GlideElementAPI.md`, `c_GlideRecordScopedAPI.md`.

Deliberate design decisions listed in the audit brief (ES5, no `gs.sleep`, non-replaying retry
expiry, no `sn_vul` hard references, the `GlideRecord`/`GlideRecordSecure` split, inactive business
rules) were treated as out of scope and are not reported.

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 1 |
| HIGH | 5 |
| MEDIUM | 12 |
| LOW | 3 |

---

## Findings

### BUG-001 — `ConnectionInfo.getConnectionUrl()` does not exist; every alias-authenticated connector fails

- **Severity:** CRITICAL
- **File:** `src/script-includes/secops-rest-client.js`
- **Table:** `x_335329_secops_connector` (`auth_type = 'alias'`, `connection_alias`)
- **Line / section:** `resolveConnection`, lines 286-305 (call at line 296)
- **Description:** The scoped `sn_cc` ConnectionInfo API exposes only `getAttribute(String)`,
  `getCredentialAttribute(String)`, `getDataMap()` and `getExtendedAttributes()`. There is no
  `getConnectionUrl()`. The call at line 296 is the *first* statement inside the `try`, so it throws
  a TypeError before any credential is read, the `catch` at line 301 returns `null`, and
  `buildRequest` (lines 227-239) aborts with
  `'Connection & Credential Alias could not be resolved for <name> - check the alias has an active
  connection for this domain and that the running user can read it'`. `alias` is the default value of
  `connector.auth_type` (`src/fluent/tables/connector.now.ts:58`) and the documented recommended
  path, so the framework's primary authentication mode cannot make a single outbound call, and the
  error text sends the administrator to investigate domains and ACLs instead of the code.
- **Evidence:** `ServiceNowDocs/markdown/api-reference/server-api-reference/connection-info-api.md`
  — method list is `getAttribute`, `getCredentialAttribute`, `getDataMap`, `getExtendedAttributes`;
  its example reads the URL as `connectionInfo.getAttribute("connection_url")` /
  `connectionInfo.getDataMap()["connection_url"]`. The unit suite cannot catch this because
  `test/harness.js:297` defines `getConnectionUrl: () => conn.url` on its own double (and omits the
  real `getAttribute`/`getDataMap`).
- **Fix:** Replace `info.getConnectionUrl()` with `info.getAttribute('connection_url')` and fix the
  harness double to expose `getAttribute`/`getDataMap` instead of `getConnectionUrl`.
- **Reproducible when:** Any connector with `auth_type = 'alias'` is activated and called (including
  the console "Test" button and the hourly health sweep).

---

### BUG-002 — `setMIDServer()` is passed a sys_id, not a MID Server name

- **Severity:** HIGH
- **File:** `src/script-includes/secops-rest-client.js`
- **Table:** `x_335329_secops_connector.mid_server`
- **Line / section:** `attempt`, lines 147-149; value produced by
  `SecOpsRegistry.connectorToObject` line 94 (`gr.getValue('mid_server')`)
- **Description:** `mid_server` is a `ReferenceColumn` to `ecc_agent`
  (`src/fluent/tables/connector.now.ts:67`), so `getValue('mid_server')` returns a 32-character
  sys_id. `RESTMessageV2.setMIDServer()` takes the MID Server *name* and requires an active MID
  Server with that name. Passing a sys_id means no MID Server matches, so every MID-routed connector
  fails (or silently bypasses the MID Server, depending on release) — and the failure surfaces as a
  transport error with no hint that the cause is the MID Server lookup.
- **Evidence:** `api-reference/server-api-reference/c_RESTMessageV2API.md`, "RESTMessageV2 -
  setMIDServer(String midServer)": *"midServer | String | Name of the MID Server to use. Your
  instance must have an active MID Server with the specified name."*
- **Fix:** In `connectorToObject`, resolve the display value —
  `mid_server: gr.getDisplayValue('mid_server')` (or read `ecc_agent.name` via
  `SecOpsTargetWriter.readField`) — and keep `setMIDServer` receiving that name.
- **Reproducible when:** A connector has a MID Server selected and any endpoint on it is called.

---

### BUG-003 — A rejected write is reported as a successful call

- **Severity:** HIGH
- **File:** `src/script-includes/secops-universal-payload-handler.js`,
  `src/script-includes/secops-containment-handler.js`
- **Table:** any mapped target table
- **Line / section:** `run`, lines 70-77; `contain`, lines 67-86
- **Description:** `run()` sets `response.ok` from the HTTP result only (line 59) and never
  downgrades it when `mapAndWrite` fails. `mapAndWrite` returns `{ ok:false, errors:[...] }` when
  field mapping fails or the insert is refused by an ACL / Restricted Caller Access
  (`secops-target-writer.js:107-125`), but that object is only attached as `response.writes`.
  `SecOpsContainmentHandler.contain()` then copies `ok`, `status`, `payload`, `transaction` and
  `error` into its outcome and **discards `response.writes` entirely** (lines 74-78), and logs
  `'Containment succeeded'` (line 81). A caller — a Flow action, a UI action, an operator — sees
  `ok: true, error: null` for a call whose mapped records were never written. Containment is also
  the one handler that does not pass `write: false`, so it is the handler that hits this path.
- **Evidence:** Code path: `secops-target-writer.js:112-117` returns `ok:false` on a null
  `insert()`; `secops-universal-payload-handler.js:73` stores it in `response.writes`;
  `secops-containment-handler.js:74-78` never reads it.
- **Fix:** In `run()`, after line 73, add
  `if (response.writes && !response.writes.ok) { response.ok = false; response.error = response.writes.errors.join('; ') }`
  (or surface `writes` on every handler outcome and check it).
- **Reproducible when:** A `contain` endpoint has field mappings whose target table denies create to
  the running user, or whose mapping rows omit `target_table` (containment inherits
  `DEFAULT_TARGET_TABLE = null`, so `SecOpsFieldMapper.apply` pushes
  `'Mapping ... has no target table or field'`).

---

### BUG-004 — `upsertObservable` overwrites an analyst's manual finding and downgrades verdicts

- **Severity:** HIGH
- **File:** `src/script-includes/secops-phishing-handler.js`
- **Table:** `sn_ti_observable`
- **Line / section:** `processIndicator` lines 97-108; `upsertObservable` lines 142-166
- **Description:** `upsertObservable` writes `finding: disposition` with
  `coalesce: ['value', 'type']`, so when the observable already exists,
  `SecOpsTargetWriter.findExisting` positions on it and `applyValues` **updates** `finding`. Two
  concrete data-integrity failures follow:
  1. When the detonation call fails, line 100 sets `record.disposition = 'Unknown'`, and the
     following upsert writes `Unknown` over an existing `Malicious` verdict. A connector outage
     therefore silently clears known-bad verdicts.
  2. It does not check `has_manual_finding_override`. The sibling roll-up path
     (`secops-threat-intel-handler.js:270-273`) checks that field explicitly *"so automation does not
     overwrite a human decision"*; the phishing path writes the same field with no such guard, so an
     analyst's manual verdict is overwritten.
- **Evidence:** Same-codebase contract: `secops-threat-intel-handler.js:263-278` establishes the
  override rule and the comment documenting it; `secops-phishing-handler.js:150-159` violates it on
  the same field of the same table.
- **Fix:** Only set `finding` on insert — pass the disposition through a separate code path that
  reads the existing record first, skips when `has_manual_finding_override` is true, and never
  lowers an existing rank (`SecOpsThreatIntelHandler.FINDING_RANK`).
- **Reproducible when:** The same URL/hash appears in a second phishing incident (or the same
  incident is re-analysed) and the sandbox call fails or returns an unrecognised verdict.

---

### BUG-005 — Journal fields are read with `getValue()`, so `comments` and `work_notes` are never scanned

- **Severity:** HIGH
- **File:** `src/script-includes/secops-phishing-handler.js`
- **Table:** `sn_si_incident`
- **Line / section:** `SOURCE_FIELDS` line 25; `collectText` lines 124-134
- **Description:** `SOURCE_FIELDS` includes `comments` and `work_notes`, which are journal fields —
  their values live in `sys_journal_field`, not in a column on the record.
  `gr.isValidField('comments')` returns true so the loop does not skip them, but
  `gr.getValue('comments')` returns the (empty) journal *input*, not the entries. Half of the
  advertised indicator sources therefore contribute nothing: an IOC pasted into a work note or a
  customer comment — the normal place a reported phish lands — is never extracted, and the handler
  reports `'No indicators found in incident'` with `ok: true`.
- **Evidence:** `api-reference/server-api-reference/c_GlideElementAPI.md`, "GlideElement -
  getJournalEntry(Number mostRecent)": *"Returns either the most recent journal entry or all journal
  entries … `var notes = current.work_notes.getJournalEntry(-1)`"*, with a documented scoped
  equivalent. Journal content has no element value to return via `getValue()`.
- **Fix:** In `collectText`, branch on the field type: for journal fields use
  `gr.getElement(field).getJournalEntry(-1)` (scoped `GlideElement.getJournalEntry`), keeping
  `getValue()` for `short_description`/`description`.
- **Reproducible when:** A security incident carries its indicators in work notes or comments rather
  than in the short description.

---

### BUG-006 — `analyzeIncident` reports `ok: true` even when every detonation failed

- **Severity:** HIGH
- **File:** `src/script-includes/secops-phishing-handler.js`
- **Line / section:** `analyzeIncident` lines 64-70
- **Description:** `outcome.ok = true` is set unconditionally after the indicator loop, and
  `outcome.error` stays `null`. If no `detonate` endpoint is configured at all, every
  `processIndicator` gets `ok:false, error:'No active endpoint is configured for capability
  "detonate"'` from `run()` (`secops-universal-payload-handler.js:44-46`) — yet the aggregate result
  is `{ ok: true, disposition: 'Unknown' }`. A Flow or UI action branching on `ok` cannot distinguish
  "analysed, nothing malicious" from "the integration is not configured / is down", and the
  misleading `Unknown` disposition is what then gets written onto observables (see BUG-004).
- **Evidence:** Code path — `outcome.ok` is never derived from `outcome.indicators[*].ok`;
  contrast `SecOpsVulnIngestionHandler.ingest` line 74, which does derive `ok` from the per-record
  results.
- **Fix:** Replace line 69 with a derivation, e.g. count successes in the loop and set
  `outcome.ok = succeeded > 0`, and populate `outcome.error` with the first per-indicator error when
  none succeeded.
- **Reproducible when:** No active `detonate` endpoint exists (the shipped state), or the sandbox
  connector is unreachable.

---

### BUG-007 — `send()` throws a TypeError when `max_retries` is negative

- **Severity:** MEDIUM
- **File:** `src/script-includes/secops-rest-client.js`
- **Table:** `x_335329_secops_connector.max_retries`
- **Line / section:** `send` lines 95-124 (crash at line 118)
- **Description:** `maxAttempts = connector.max_retries + 1`. With `max_retries = -1` the `for` loop
  body never executes, `last` stays `null`, and line 118 (`last.duration_ms = ...`) throws
  `TypeError: Cannot read property 'duration_ms' of null`. Nothing between `transactions.open()`
  (line 65) and `transactions.close()` (line 80) catches it, so the exception escapes `execute()`
  and the transaction row is **left in `pending` forever** — it is also excluded from the cleanup
  job's retry-safe filter only by state, so it lingers as a false "in flight" call in the console.
  The `min: 0` on the dictionary column is a form/UI constraint; it does not stop a value arriving
  through a script, an import set, the Table API or an update set.
- **Evidence:** `src/fluent/tables/connector.now.ts:69` declares `min: 0` (dictionary attribute, not
  a server-side write barrier); `secops-rest-client.js:96-101,118` is the reachable crash.
- **Fix:** Clamp at the source: in `SecOpsRegistry.connectorToObject`, wrap with
  `Math.max(0, Math.min(5, ...))`, and/or make `send()` defensive with
  `var maxAttempts = Math.max(1, connector.max_retries + 1)`.
- **Reproducible when:** `max_retries` is set below 0 by any non-form path, then any endpoint on that
  connector is called.

---

### BUG-008 — The synthetic health endpoint writes a 49-character value into a 32-character reference field

- **Severity:** MEDIUM
- **File:** `src/script-includes/secops-health-checker.js`, `src/script-includes/secops-transaction-logger.js`
- **Table:** `x_335329_secops_transaction.endpoint`
- **Line / section:** `resolveHealthEndpoint` line 90; `open` lines 33-35
- **Description:** When no active `health` endpoint exists, the checker fabricates an endpoint whose
  `sys_id` is `'synthetic-health-' + connector.sys_id` — 17 + 32 = 49 characters. That value flows
  into `SecOpsRestClient.execute` (line 68) and is written by `TransactionLogger.open` into
  `endpoint`, a `ReferenceColumn` to `x_335329_secops_endpoints` (max length 32). The stored value is
  truncated to a garbage 32-character string, producing a dangling reference on every fall-back
  health probe: the console's `getDisplayValue('endpoint')` (widget server line 79,
  `secops-console-ajax.js:86`) renders an unresolvable reference, and the transaction cannot be
  traced back to anything. The same value is also returned as `response.endpoint`
  (`secops-universal-payload-handler.js:62`), so any caller that feeds it to
  `SecOpsRegistry.getFieldMaps` queries on a non-sys_id.
- **Evidence:** `src/fluent/tables/transaction.now.ts:36-40` (`ReferenceColumn`, hence a 32-char
  sys_id column) vs the 49-character literal at `secops-health-checker.js:90`.
- **Fix:** Give the synthetic endpoint an empty `sys_id` (`''`) and let
  `SecOpsRestClient.execute`'s existing `!endpoint.sys_id` guard be bypassed by a dedicated flag, or
  pass `skipLogging: true` for synthetic probes and record health only on the connector record.
- **Reproducible when:** A connector has a `health_endpoint_path` (or base URL) but no active
  endpoint with capability `health` — which is the state of the shipped demo connector, whose health
  endpoint ships inactive.

---

### BUG-009 — Unescaped substitution into JSON request bodies, and `Content-Type` set only by accident

- **Severity:** MEDIUM
- **File:** `src/script-includes/secops-template.js`, `src/script-includes/secops-rest-client.js`
- **Line / section:** `render` lines 19-29 and `asText` lines 58-66; `buildRequest` lines 253-258;
  `attempt` lines 141-143
- **Description:** `render()` performs literal string substitution with no JSON escaping, and the
  rendered string is used directly as the request body. An indicator value containing a double quote
  or backslash — third-party-supplied or analyst-pasted text, e.g. an observable value
  `a","extra":"1` against the shipped template `{"indicator":"${ioc}","type":"${type}"}` — either
  breaks the body or injects additional keys into the outbound JSON. Two aggravating details:
  `bodyObject = this.json.parse(body)` silently returns `null` for the broken body, so
  `headers['Content-Type']` is never set (line 257) and the **malformed body is still sent**
  (`attempt` line 141 only checks `body !== ''`). The same omission means any legitimately
  non-JSON template (form-encoded, XML) is always transmitted with no `Content-Type` at all, which
  many APIs reject with 400/415 — and the transaction log records the raw string rather than a
  parsed object, making the cause hard to see.
- **Evidence:** Code path; `secops-template.js` only guards against *code* execution ("it can never
  execute code"), not value injection. `secops-rest-client.js:256-258` couples the header to a
  successful parse.
- **Fix:** Escape substituted values when the template parses as JSON (use
  `JSON.stringify(text).slice(1, -1)` for the replacement inside a quoted position, or render the
  template as a structure rather than text); set `Content-Type` from an explicit endpoint attribute
  and refuse to send a body that was expected to be JSON and did not parse.
- **Reproducible when:** Any indicator, observable value, reason or incident number substituted into
  a request template contains `"`, `\` or a control character.

---

### BUG-010 — Multi-field coalesce silently degrades to a partial match

- **Severity:** MEDIUM
- **File:** `src/script-includes/secops-target-writer.js`
- **Line / section:** `findExisting` lines 129-153 (the `continue` at line 139 and the
  `usable === 0` test at line 144)
- **Description:** Coalesce fields that are absent from the target schema, or whose value is
  `undefined`/`null`, are skipped, and the lookup proceeds as long as **any one** field remains.
  The intent of `coalesce: ['a','b']` is "the pair identifies the record"; the implementation
  happily matches on `a` alone and then **updates that record**. Concretely, the whole application
  is built on the premise that "a field may have been renamed between SecOps releases" (file header):
  if `source_engine` is not present on `sn_ti_lookup_result` in a given Threat Intelligence release,
  `recordLookupResult`'s `coalesce: ['observable','source_engine']`
  (`secops-threat-intel-handler.js:230-233`) collapses to `observable` alone, so the second
  intel source's result overwrites the first one's row instead of creating its own — the multi-source
  verdict history the handler exists to produce is silently reduced to one row, and
  `worstFinding` then ranks a single surviving source.
- **Evidence:** `secops-target-writer.js:136-143` skips invalid fields but still queries;
  `applyValues(..., isUpdate=true)` at line 71 updates whatever `findExisting` returned.
- **Fix:** Treat coalesce as all-or-nothing: if any requested coalesce field is invalid or has no
  value, return `null` (insert instead of updating) and log the reason.
- **Reproducible when:** A coalesce field does not exist on the target table, or its mapped value is
  null — e.g. `promoteOne`'s `coalesce: ['vulnerability','cmdb_ci']`
  (`secops-vuln-ingestion-handler.js:326`) where `ci` was never matched.

---

### BUG-011 — Indicator cap reuses the ingestion property: up to 500 synchronous HTTP calls in one transaction

- **Severity:** MEDIUM
- **File:** `src/script-includes/secops-phishing-handler.js`
- **Line / section:** `analyzeIncident` lines 54-66
- **Description:** `opts.maxIndicators || this.registry.getInt(this.registry.PROP_INGEST_MAX, 500)`
  caps indicators at the value of `x_335329_secops.ingest.max_records`, whose Fluent definition
  describes it as *"Maximum records accepted from a single ingestion payload"*
  (`src/fluent/properties.now.ts:60-67`). Nothing about detonation is bounded by that number. Each
  surviving indicator then drives one **synchronous** outbound HTTP call plus an observable upsert
  and an m2m link inside the caller's transaction (lines 64-66, 86-108). A phishing report
  containing a few hundred URLs therefore issues a few hundred serial REST calls in one transaction
  and will hit the transaction quota (the default outbound timeout alone is 30 s per call), leaving
  the incident half-processed and the console full of `pending` transactions.
- **Evidence:** Property semantics mismatch between `src/fluent/properties.now.ts:60-67` and
  `secops-phishing-handler.js:54`; the outbound path is `rest.execute` → `message.execute()`
  (`secops-rest-client.js:156`), which is blocking.
- **Fix:** Introduce a dedicated property (e.g. `x_335329_secops.detonate.max_indicators`) with a
  small default (10-25) and cap `maxIndicators` with it; document that `analyzeIncident` must be
  called from an async/scheduled context.
- **Reproducible when:** An incident description contains more than a handful of URLs/hashes and a
  `detonate` endpoint is active.

---

### BUG-012 — N+1 connector query inside both endpoint-resolution loops

- **Severity:** MEDIUM
- **File:** `src/script-includes/secops-registry.js`
- **Table:** `x_335329_secops_endpoints`, `x_335329_secops_connector`
- **Line / section:** `findEndpointForCapability` lines 138-143; `listEndpointsForCapability`
  lines 162-167
- **Description:** Both loops call `this.getConnector(gr.getValue('connector'))` per endpoint row,
  and `getConnector` instantiates a new `GlideRecord` and runs `get()` every time (lines 57-61) —
  with no caching, so the same connector is re-fetched once per endpoint it owns. The filter being
  implemented ("the owning connector is active") is expressible in the query itself.
  `listEndpointsForCapability` is on the enrichment hot path: `enrichObservable` calls it for every
  observable, so an instance with N enrichment endpoints performs N extra queries per observable, per
  business-rule firing.
- **Evidence:** Documented GlideRecord guidance (`api-reference/developer-guides/`): filter with
  `addQuery` / dot-walk rather than issuing a query per row inside a `while (gr.next())` loop.
- **Fix:** Replace the per-row lookup with `gr.addQuery('connector.active', true)` and drop the
  in-loop `getConnector` call (keep it only where the connector object itself is needed).
- **Reproducible when:** More than a couple of endpoints share a capability; cost grows linearly
  with endpoint count on every enrichment.

---

### BUG-013 — `matchCi` runs up to two `cmdb_ci` queries per staged record

- **Severity:** MEDIUM
- **File:** `src/script-includes/secops-vuln-ingestion-handler.js`
- **Table:** `cmdb_ci`
- **Line / section:** `stageOne` line 132 calling `matchCi` lines 214-245
- **Description:** `matchCi` is called once per staged record inside the `ingest` loop (lines 63-72)
  and issues a `cmdb_ci` query on `name`, then a second on `ip_address` when the first does not match
  exactly one row. With the default `x_335329_secops.ingest.max_records = 500`, one REST ingestion
  call performs up to 1000 `cmdb_ci` queries — on the largest table on most instances — on top of the
  coalesce lookup and insert per record. The queries are also unrestricted by `sys_class_name`, so
  each one scans the full CI hierarchy.
- **Evidence:** `secops-vuln-ingestion-handler.js:63-72,132,219-239`; batch size default at
  `src/fluent/properties.now.ts:60-67`.
- **Fix:** Collect the distinct `ci_identifier` values for the batch first, resolve them in one
  `addQuery('name','IN',...)` plus one `addQuery('ip_address','IN',...)` pass, and look the results
  up from an in-memory map inside the loop.
- **Reproducible when:** Any ingestion payload with more than a few dozen records whose
  `ci_identifier` is populated.

---

### BUG-014 — `promote()` issues roughly six queries per staged row

- **Severity:** MEDIUM
- **File:** `src/script-includes/secops-vuln-ingestion-handler.js`
- **Line / section:** `promote` lines 275-299; `promoteOne` lines 301-336; `markStage` lines 338-350
- **Description:** For each of up to 500 rows the loop performs: two `SecOpsTargetWriter.write`
  calls, each of which runs its own coalesce `findExisting` query plus an insert/update
  (`secops-target-writer.js:69,129-153`), followed by `markStage`, which opens a *third*
  `GlideRecord` on the staging table and `get()`s the row the outer cursor is already positioned on
  (lines 340-341) before updating it. That is ~6 database operations per row where 3 would do, and
  the redundant `markStage` re-query is pure overhead — the outer `gr` could be written directly.
- **Evidence:** `secops-vuln-ingestion-handler.js:287-295` (loop), `301-336` (two writes),
  `338-350` (re-query of the current row).
- **Fix:** Have `promoteOne` set `state`/`promotion_message` on the passed-in `stageGr` and call
  `stageGr.update()` directly, removing `markStage`'s re-query.
- **Reproducible when:** `x_335329_secops.vr.promotion_enabled` is true and a batch is promoted.

---

### BUG-015 — Finding roll-up can downgrade an observable to `Unknown`

- **Severity:** MEDIUM
- **File:** `src/script-includes/secops-threat-intel-handler.js`
- **Table:** `sn_ti_observable.finding`
- **Line / section:** `enrichObservable` lines 100-104; `worstFinding` lines 237-255;
  `rollUpFinding` lines 263-283
- **Description:** `findingFrom` returns `'Unknown'` whenever nothing in the response is recognised
  (line 163 → `findingFromScore` line 209), and `'Unknown'` has rank 0 in `FINDING_RANK`, which is
  greater than `worstRank`'s initial `-1`. So a lookup that succeeds at the HTTP level but returns an
  unrecognised body yields `outcome.finding = 'Unknown'`, `outcome.ok = true`, and
  `rollUpFinding` writes `Unknown` over whatever the observable previously held — including a
  previous `Malicious`. The function deliberately protects a *manual* override but nothing protects a
  previous automated verdict, so re-enrichment against a changed third-party response format quietly
  erases known-bad verdicts. The header comment states the opposite intent: *"Anything unrecognised
  stays Unknown rather than guessing - a wrong 'Clean' is far more dangerous than an honest
  'Unknown'"* — which holds for the lookup result row, but not for the observable it overwrites.
- **Evidence:** `FINDING_RANK` at line 23 (`Unknown: 0`), `worstFinding` seed `worstRank = -1`
  at line 239, unconditional `gr.setValue('finding', finding)` at line 277.
- **Fix:** Skip the roll-up when the new finding's rank is lower than the observable's current
  finding rank (read `gr.getValue('finding')`, compare via `FINDING_RANK`), or exclude `Unknown`
  from roll-up entirely.
- **Reproducible when:** An observable already marked `Malicious` is re-enriched and the source
  returns a body whose verdict field is absent or renamed.

---

### BUG-016 — The 401 OAuth "second chance" is dead code with no diagnostic

- **Severity:** MEDIUM
- **File:** `src/script-includes/secops-universal-payload-handler.js`
- **Line / section:** `run` lines 50-57; `refreshToken` lines 160-186
- **Description:** `GlideOAuthClient` has no `refreshToken()` method, so the guard at line 171
  always takes the `{ ok:false, skipped:true }` branch. `run()` requires
  `refreshed.ok && !refreshed.skipped` (line 53), so the retry never happens — the documented
  behaviour ("the one failure worth a single automatic second chance") does not exist. Worse, that
  branch returns `'OAuth client unavailable'` **without logging anything**, and `run()` discards the
  returned object, so an expired OAuth grant surfaces only as a bare HTTP 401 with no hint that a
  refresh was attempted and impossible. Even if a `refreshToken` existed, the call arity is wrong:
  every documented method on this API is keyed by OAuth *client/entity name* plus a request object,
  not by an authentication-profile sys_id.
- **Evidence:** `api-reference/server-api-reference/c_GlideOAuthClient.md` — the complete method
  list is `getToken(String requestID, String oauthProfileID)`,
  `requestToken(String clientName, String jsonString)`,
  `requestTokenByRequest(String clientName, GlideOAuthClientRequest request)`,
  `revokeToken(...)`. No `refreshToken`. `test/harness.js:309` invents
  `this.refreshToken = () => ...` on its double, so the suite cannot detect this.
- **Fix:** Either drop the refresh attempt and report the 401 with an explicit
  "re-authorize the OAuth profile" message, or implement it against the documented API
  (`requestTokenByRequest` with a `sn_auth.GlideOAuthClientRequest`, keyed by the OAuth entity name,
  which means storing the entity name on the connector rather than only the profile sys_id).
  Either way, log the skipped/failed refresh.
- **Reproducible when:** A connector with `auth_type = 'oauth2'` whose grant has expired is called.

---

### BUG-017 — `pull()` drops `options.secure` and never links staged rows to its transaction

- **Severity:** MEDIUM
- **File:** `src/script-includes/secops-vuln-ingestion-handler.js`
- **Table:** `x_335329_secops_vuln_stage.transaction`
- **Line / section:** `pull` lines 84-110 (call at 102-107); `stageOne` lines 113-140
- **Description:** Two options are silently lost on the way from `pull()` to `stageOne()`:
  1. `secure` — `pull()` forwards it to `run()` (line 93), where it has no effect because
     `write: false` skips `mapAndWrite` entirely, and does **not** forward it to `ingest()`. Since
     `stageOne` defaults to insecure (`secure: opts.secure === true`, line 138),
     `pull({ secure: true })` stages with a plain `GlideRecord` regardless — the option is inert.
     Note this default is also the inverse of the base handler's (`opts.secure !== false`,
     `secops-universal-payload-handler.js:130`), so the same option name means opposite things in
     the two write paths.
  2. `transaction` — `pull()` holds `response.transaction` (it assigns it to `result.transaction` at
     line 108) but never passes it into `ingest()`/`stageOne()`, which look for `opts.transaction`
     (lines 128-130). The REST route does not pass it either
     (`src/rest/ingest-vulnerability.js:63-67`). So `x_335329_secops_vuln_stage.transaction`
     (`src/fluent/tables/vuln-stage.now.ts:67-71`) is empty on every row this application creates,
     and a staged record cannot be traced to the call that produced it.
- **Evidence:** `secops-vuln-ingestion-handler.js:102-107` (option set forwarded) vs
  `113,128-130,138` (options expected); `src/fluent/tables/vuln-stage.now.ts:67-71` (the field
  exists).
- **Fix:** Pass `secure: opts.secure` and `transaction: response.transaction` in the `ingest()` call
  at line 102, and align `stageOne`'s secure default with the base handler's.
- **Reproducible when:** Always — inspect any staged row's Transaction field.

---

### BUG-018 — Demo field mapping `demoMapScore` can never be applied

- **Severity:** MEDIUM
- **File:** `src/fluent/demo-data.now.ts`, `src/script-includes/secops-threat-intel-handler.js`
- **Table:** `x_335329_secops_field_map`, `sn_ti_lookup_result`
- **Line / section:** `demoMapScore` lines 88-101; `enrichObservable` lines 71-79;
  `findingFrom` lines 144-153; `recordLookupResult` lines 217-233
- **Description:** The demo data teaches the onboarding pattern "endpoint + field mappings", but for
  the `enrich` capability the mappings are not used to write anything: `enrichObservable` calls
  `run(..., { write: false })`, so `mapAndWrite` never runs, and `recordLookupResult` builds its own
  fixed value set. Of the two shipped mappings, only `demoMapFinding` has any effect — and only
  because `findingFrom` scans the maps for `target_field === 'finding'` to learn the source path.
  `demoMapScore` (`attributes.score` → `result`) is inert, and `recordLookupResult` hard-writes
  `result` to the finding text (line 221), so it would be overwritten anyway. An administrator who
  copies the demo pattern to map additional response fields onto the lookup result will find the
  rows silently ignored, with no error anywhere.
- **Evidence:** `secops-threat-intel-handler.js:78` (`write: false`), `144-153` (only
  `target_field === 'finding'` is read), `217-228` (fixed value set including `result`) vs
  `src/fluent/demo-data.now.ts:88-101`.
- **Fix:** Either merge the mapped values into `recordLookupResult`'s value set (apply
  `this.mapper.apply(response.payload, maps, this.TABLE_LOOKUP_RESULT)` and let explicit mappings
  win over the defaults), or remove `demoMapScore` and document that for `enrich` only a
  `finding` mapping is honoured.
- **Reproducible when:** The demo connector/endpoint is activated against a real service, or any
  administrator adds a non-`finding` mapping to an `enrich` endpoint.

---

### BUG-019 — Redaction stops at depth 12, logging deeper secrets verbatim

- **Severity:** LOW
- **File:** `src/script-includes/secops-json.js`
- **Table:** `x_335329_secops_transaction` (`request_summary`, `response_summary`),
  `x_335329_secops_vuln_stage.raw_payload`, system log
- **Line / section:** `redactValue` lines 137-140
- **Description:** `if (depth > 12 ...) return value` returns the **entire remaining subtree
  unmodified**, so any credential-shaped key nested more than 12 levels deep is written to the
  transaction log and the system log in clear text. The guard exists to bound recursion, but it
  fails open rather than closed — the whole point of the function is that "the transaction table can
  be exposed to analysts without exposing credentials" (file header), and the transaction read ACL
  is granted to `x_335329_secops.viewer` (`src/fluent/security/acls.now.ts:135-143`).
- **Evidence:** `secops-json.js:138` returns `value` (not a placeholder) once the depth limit is hit;
  `secops-transaction-logger.js:96-97` feeds every request/response body through it.
- **Fix:** Return a marker instead of the subtree at the depth limit, e.g.
  `return '***DEPTH_LIMIT***'`.
- **Reproducible when:** A third party returns a deeply nested envelope (common with
  wrapper-of-wrapper SOAR/SIEM payloads) that carries a token below level 12.

---

### BUG-020 — `x_335329_secops_vuln_stage.first_seen` is defined but never written

- **Severity:** LOW
- **File:** `src/fluent/tables/vuln-stage.now.ts`, `src/script-includes/secops-vuln-ingestion-handler.js`
- **Table:** `x_335329_secops_vuln_stage`
- **Line / section:** column at `vuln-stage.now.ts:72`; `stageOne` lines 125-127
- **Description:** `stageOne` sets `last_seen` on every insert *and* every coalesced update, but no
  code path ever sets `first_seen`. The column is therefore always empty, and the "first seen /
  last seen" pair that makes a re-ingested finding's age readable is unusable. (On the update path
  `last_seen` is correctly refreshed, which is what makes the missing `first_seen` visible.)
- **Evidence:** `first_seen` appears in `src/fluent/tables/vuln-stage.now.ts:72` and nowhere in
  `src/**/*.js`.
- **Fix:** In `stageOne`, set `first_seen` only when inserting — e.g. include it in the value set and
  have `SecOpsTargetWriter.applyValues` skip a configurable insert-only field list, or read the
  existing row's `first_seen` and preserve it.
- **Reproducible when:** Always.

---

### BUG-021 — Cleanup job's `capped` flag is computed from successful deletes

- **Severity:** LOW
- **File:** `src/jobs/transaction-cleanup.js`
- **Line / section:** lines 33-44 (`capped: deleted === MAX_PER_RUN`)
- **Description:** `deleted` counts only rows whose `deleteRecord()` returned true. If the query hit
  the 5000-row cap but any delete was refused, `capped` logs `false`, telling the operator the
  backlog is drained when it is not — and because the job is the only thing bounding this table, the
  signal that matters most (there is more to delete) is the one that goes missing.
- **Evidence:** `transaction-cleanup.js:34-37` increments `deleted` conditionally; line 43 derives
  `capped` from it.
- **Fix:** Count iterations separately from successful deletes and derive `capped` from the
  iteration count.
- **Reproducible when:** More than 5000 expired transactions exist and at least one delete is denied
  by an ACL or data policy.

---

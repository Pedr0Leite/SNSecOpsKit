# Tier 1 build strategy

**Status:** plan, not built. Written 2026-09-21 to be executed from a cold start.
**Rationale and evidence:** [12-feature-research.md](12-feature-research.md).

Four workstreams, in the order they should be built. Each is independently shippable — stopping
after any one of them leaves the application in a coherent, releasable state.

---

## Before anything: two corrections and one warning

**Correction 1 — `block` already exists.** `SecOpsContainmentHandler.ACTIONS` is
`['isolate', 'release', 'block', 'unblock']` (`src/script-includes/secops-containment-handler.js:19`).
The research doc framed W2 as a new capability; it is not. **The missing half is the ledger and the
retraction sweep**, not the outbound call. This materially shrinks W2 and changes where the work
goes — extend the handler, do not write a second one.

**Correction 2 — endpoint capability choices are a schema change.** Adding `sightings` to
`src/fluent/tables/endpoints.now.ts:33` alters a choice list on an installed table. Verify on a
non-production instance that existing endpoint records survive the upgrade before this reaches
anyone's data.

**Warning — the unresolved risk under all four.** Per [NEXT-STEPS.md](../NEXT-STEPS.md), `enrich`,
`detonate` and `contain` have **never called a real third-party API**. Every workstream below
inherits that. W1 and W2 both assume the RestClient behaves against a real SIEM and a real EDR, and
neither assumption has been tested. If you can only do one thing tomorrow, wire one real vendor end
to end instead — it is worth more than any feature here.

---

## Shared preflight

Run once, at the start of any session working this plan:

```bash
git fetch origin && git checkout claude/app-secops-feature-research-n61kio
npm install
npm test          # record the baseline count; it must not go down
npm run build     # Fluent must compile before you touch table definitions
```

**Conventions that are not negotiable** — every workstream follows them:

- Logic in `src/script-includes/*.js` as ES5 `Class.create()`. No ES6, no dependencies, no `eval`.
- Metadata in `src/fluent/**/*.now.ts`. Register every new script include in
  `src/fluent/script-includes/`.
- Every new table name and property name goes in `SecOpsRegistry` — nothing hardcodes one.
- Every write to a SecOps table goes through `SecOpsTargetWriter` (schema + permission checked) and
  through a cross-scope privilege declared in `src/fluent/security/cross-scope.now.ts`.
- A Node unit test per behaviour, against `test/harness.js`. **Do not extend the harness to make a
  test pass** — the harness is deliberately no more capable than the real platform, and the README
  explains what happened the one time that rule was broken.
- New handlers extend `SecOpsUniversalPayloadHandler` and override `CAPABILITY`,
  `DEFAULT_TARGET_TABLE` and the `onSuccess`/`onFailure` hooks. They do **not** re-implement
  transport, retry, redaction, mapping or logging.

---

## W1 — Sightings Search

**Why first:** it is the largest alignment gap against the native Security Operations Integration
Framework, it is the question an analyst asks immediately after a verdict, and it is a read-only
capability — nothing it does can damage anything.

### Design

A new `sightings` capability. Given an observable (or a raw indicator value and type), fan out to
every active `sightings` endpoint — in practice a SIEM search API — and record one row per hit.

Results land in **the application's own staging table first**, exactly as `ingest` does. That keeps
the app installable without the SecOps subscription and makes a bad feed reversible. Linking a
sighting onto `sn_si_incident` is a second, guarded step.

The fan-out shape is already solved: copy the structure of
`SecOpsThreatIntelHandler.enrichObservable()`, which queries every active endpoint for its
capability and aggregates per-source results. Do not invent a second pattern.

### New table — `x_335329_secops_sighting`

| Column | Type | Notes |
|---|---|---|
| `indicator` | String(1024) | The value searched |
| `indicator_type` | Choice | Reuse the extractor's types: `ip`, `domain`, `url`, `md5`, `sha1`, `sha256`, `email` |
| `observable` | Reference `sn_ti_observable` | Nullable — the app must work without Threat Intelligence |
| `connector` | Reference | Which source reported it |
| `source_system` | String | Free text from the payload — the SIEM's own name for itself |
| `host` / `user` / `asset` | String | Where it was seen. `asset` also feeds CMDB matching later |
| `seen_at` | Glide Date Time | **From the payload, not `now()`** |
| `hit_count` | Integer | Some SIEMs return an aggregate rather than rows |
| `raw_excerpt` | String(4000) | Redacted, truncated evidence |
| `external_id` | String | For de-duplication |
| `transaction` | Reference | The call that produced it |

De-duplicate on `connector` + `external_id` where the source supplies one; fall back to
`connector` + `indicator` + `seen_at` + `host`.

### Decisions to make deliberately

- **Time window.** Sightings searches without a bounded window are how you make a SIEM time out.
  Take `window_hours` in the context, default it from a property, and expose it as a `${...}`
  placeholder so the endpoint template controls the vendor-specific syntax.
- **Result cap.** A search for `8.8.8.8` against a busy SIEM returns tens of thousands of rows.
  Cap writes at a property-driven maximum, and set `truncated` on the outcome rather than staying
  quiet — the same contract `detonate` already uses for its indicator cap.
- **Zero hits is a success.** `ok: true` with `sightings.length === 0` means "searched, not seen" —
  which is a genuine and useful answer, not a failure. Callers must read the count, not just `ok`.
  Document it; `detonate` has the identical gotcha and it is documented in the README.

### Files

```
new  src/script-includes/secops-sightings-handler.js
new  src/fluent/tables/sighting.now.ts
new  test/secops-sightings-handler.test.js
edit src/fluent/tables/endpoints.now.ts        # + sightings choice
edit src/fluent/script-includes/handlers.now.ts
edit src/script-includes/secops-registry.js    # TABLE_SIGHTING, PROP_SIGHTINGS_*
edit src/fluent/properties.now.ts              # window, max results
edit src/fluent/security/acls.now.ts
edit docs/09-testing-guide.md
```

### Acceptance

- Fans out to every active `sightings` endpoint; one aggregated outcome, per-source detail inside.
- Zero hits returns `ok: true`.
- One source failing does not fail the others; its error is reported per-source.
- Exceeding the cap sets `truncated`.
- Re-running the same search writes no duplicate rows.
- Every call produces a transaction row with a redacted payload.
- `npm test` count rises; no existing test modified to accommodate it.

---

## W2 — Indicator deployment ledger and retraction

**Why second:** it is the genuine differentiator. Everyone pushes blocks; almost nobody retracts
them, and stale blocks are a real, expensive operational failure — an IP recycled to a legitimate
service that nobody can reach for eight months.

### Design

`SecOpsContainmentHandler` already sends `block` and `unblock`. Wrap it in a ledger.

Every successful `block` writes a **deployment** row: indicator, connector, the external ID the
vendor returned, who requested it, why, and an expiry. A scheduled job sweeps for deployments that
are expired or whose indicator's verdict has been downgraded, calls `unblock`, and closes the row.

### New table — `x_335329_secops_deployment`

| Column | Type | Notes |
|---|---|---|
| `indicator` / `indicator_type` | String / Choice | |
| `observable` | Reference `sn_ti_observable` | Nullable |
| `connector` | Reference | Where it is deployed |
| `external_id` | String | The vendor's handle — **without this you cannot retract** |
| `state` | Choice | `requested`, `deployed`, `retracting`, `retracted`, `failed`, `orphaned` |
| `deployed_at` / `expires_at` | Glide Date Time | |
| `requested_by` | Reference `sys_user` | |
| `reason` | String(1000) | Mandatory — mirrors the containment handler's justification rule |
| `incident` | Reference `sn_si_incident` | Nullable |
| `retract_attempts` | Integer | Bounded; see below |

Unique on `connector` + `indicator` + `indicator_type` among non-retracted rows.

### The hard parts — decide these before writing code

- **`external_id` may be absent.** Some vendors return nothing useful. Then retraction has to go by
  indicator value, and it may fail. Record the row as `orphaned` and surface it in the console
  rather than silently pretending the block will be reversible.
- **Retraction can fail forever.** A deleted blocklist, a revoked credential, a decommissioned
  firewall. Bound `retract_attempts`, then park the row as `failed` and make it visible. An
  unbounded retry loop against a dead endpoint is how you get rate-limited out of the vendor.
- **Retraction is itself destructive.** Un-blocking something that should stay blocked is a
  security failure in the other direction. Default the auto-retraction property to **off**, ship it
  producing a report of what it *would* retract, and let the customer turn execution on knowingly.
- **Downgrade-driven retraction must respect the monotonic verdict rule.** The app's stated
  position is that automation may raise a verdict and never lower one. So a *downgrade* trigger can
  only ever come from an analyst's manual override — never from an automated re-enrichment. Read
  that carefully before wiring the trigger, or you will build a loop where a sandbox outage returns
  `Unknown` and un-blocks live threats.

### Files

```
new  src/fluent/tables/deployment.now.ts
new  src/jobs/retract-expired-deployments.js
new  test/secops-deployment.test.js
edit src/script-includes/secops-containment-handler.js   # ledger write + retract()
edit src/fluent/jobs/scheduled-jobs.now.ts
edit src/script-includes/secops-registry.js
edit src/fluent/properties.now.ts     # auto_retract_enabled (default FALSE), default_ttl_days, max_attempts
edit src/rest/console-overview.js     # active deployments panel
```

### Acceptance

- A successful block writes exactly one `deployed` row; a failed block writes none.
- A block with no `external_id` is recorded `orphaned`, not `deployed`.
- The sweep with auto-retract off writes nothing and reports what it would do.
- With it on, an expired deployment is retracted and closed; a failing one stops at the attempt
  cap in `failed`.
- An automated `Unknown` verdict never triggers a retraction. **Test this explicitly.**

---

## W3 — MITRE ATT&CK technique extraction

**Why third:** cheapest item in Tier 1, and it rides the D3FEND work ServiceNow shipped in Q1 2026
— once a technique is mapped, the platform supplies the recommended countermeasure for free.

### Design

Two small pieces.

**Extraction.** `SecOpsIndicatorExtractor` already does ordered, de-duplicating extraction over
incident text including journal fields. Add technique and tactic patterns — `T####`, `T####.###`,
`TA####`. Match them **before** the hash patterns and exclude them from the domain pass, or
`T1078` will be reported as something it is not. Extend the existing ordering comment; do not
bolt on a second extractor.

**Mapping.** A field-mapping target that writes `sn_ti_stix2_m2m_incident_attack`, resolving the
external ID (`T1078`) to the platform's technique record. Guard it exactly as VR promotion is
guarded: the Threat Intelligence module may not be installed, and the app must degrade to a
reported skip rather than fail.

### Files

```
edit src/script-includes/secops-indicator-extractor.js
new  src/script-includes/secops-attack-mapper.js
new  test/secops-attack-mapper.test.js
edit test/secops-indicator-extractor.test.js
edit src/fluent/security/cross-scope.now.ts   # sn_ti_stix2_m2m_incident_attack create/read
edit src/script-includes/secops-phishing-handler.js
```

### Acceptance

- `T1078`, `T1078.001` and `TA0005` extract correctly; `T1078` is not also reported as a domain;
  a bare `T12` or `T123456` is rejected.
- Mapping is idempotent — re-running creates no duplicate m2m rows.
- With Threat Intelligence absent, the handler reports a skip and stays `ok`.

---

## W4 — Email analysis (`.eml` / `.msg` parsing)

**Why last:** highest analyst value, and by a distance the most work. It is also the one that most
deserves a real phishing sample before design is fixed.

### The gap it closes

`detonate` starts from the incident's text fields. The commonest real phishing intake is a
**forwarded message as an attachment** — where the indicators live in the attachment, not the
description. So today's most common input is the one the app handles worst, and it reports success
having found nothing.

### Design

A parser over `sys_attachment` producing a normalised structure the existing extractor consumes:

- **Headers** — `From`, `Reply-To`, `Return-Path`, the `Received` chain, and the authentication
  results: SPF, DKIM, DMARC. A `From`/`Return-Path` mismatch with a DMARC failure is a stronger
  phishing signal than anything a sandbox will tell you, and it costs one outbound call: zero.
- **Body** — text and HTML parts, decoded (quoted-printable, base64). Extract `href` targets as
  well as visible text; display-text-versus-href mismatch is a classic signal.
- **Attachments** — filename, declared type, size, SHA256. Hash them; do not detonate them here.

Feed all of it to `SecOpsIndicatorExtractor`, which already handles defanging and ordered
de-duplication, then to the existing `detonate` path.

### Be realistic about the cost

MIME parsing in ES5 with no libraries, in a scoped application, is genuinely hard: multipart
boundaries, nested multiparts, encoded words in headers (RFC 2047), charset conversion, malformed
real-world mail that no RFC describes. **`.msg` is a compound binary format and is a separate
project — do not start it in the same workstream as `.eml`.**

Scope W4 to `.eml` only. Decide up front what happens to a message the parser cannot fully
understand: it must degrade to "parsed what I could, here is what I could not" and still return
whatever indicators it found — never fail closed on the whole message, and never claim a clean
parse it did not achieve.

### Files

```
new  src/script-includes/secops-email-parser.js
new  test/secops-email-parser.test.js
new  test/fixtures/emails/*.eml              # incl. deliberately malformed samples
edit src/script-includes/secops-phishing-handler.js
edit src/fluent/security/cross-scope.now.ts  # sys_attachment read
edit src/fluent/properties.now.ts            # max attachment size
```

### Acceptance

- Parses a plain-text, an HTML, and a nested-multipart message.
- Decodes quoted-printable and base64 bodies and RFC 2047 headers.
- Extracts SPF/DKIM/DMARC results where present; reports absence as absence, never as pass.
- A malformed message yields a partial result with a stated failure, not an exception.
- Attachment hashes match a known-good fixture.
- An oversized attachment is skipped with a reported reason.

---

## Sequencing

```
W1 sightings ──┐
               ├─→ independent, ship either first
W2 ledger    ──┘
W3 ATT&CK      → after W1 (both touch the extractor / mapping paths)
W4 email       → last, own branch, own review
```

W1 and W2 together close the alignment gap against the native integration framework and are the
pair worth doing first. W3 is a day's work that makes the app visibly current. W4 is a project.

---

## How to run this tomorrow

One workstream per session. Do not let a single session attempt more than one — W1 and W2 both
touch the registry and the properties file, and parallel edits there will conflict.

```
Read docs/13-tier1-build-strategy.md and implement W1 (Sightings Search) only.
Follow the shared preflight and the conventions section exactly.
Write the unit tests first, then the handler.
Do not extend test/harness.js.
Run npm run verify before you finish, and report the test count before and after.
Stop when W1's acceptance criteria are met — do not start W2.
```

Substitute W2 / W3 / W4 for later sessions. For W4, add: *"scope to .eml only; .msg is out of
scope."*

### What to reject if a session proposes it

- Extending `test/harness.js` to make a test pass.
- A second transport, retry or logging path parallel to `SecOpsRestClient`.
- Writing directly into `sn_si_*`, `sn_ti_*` or `sn_vul_*` without `SecOpsTargetWriter` and a
  declared cross-scope privilege.
- Auto-retraction defaulting to on.
- Any retraction triggered by an automated verdict downgrade.
- A hardcoded table or property name outside `SecOpsRegistry`.

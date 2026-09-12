# Architecture

## 1. The problem

A SOC runs a dozen tools. Each has its own API shape, auth scheme, rate limits and error
vocabulary. The usual result inside ServiceNow is one bespoke integration per tool: duplicated
retry logic, inconsistent logging, credentials in random places, and a rewrite every time a vendor
bumps its API.

This application inverts that. A third-party tool is described by **records**, not code:

```
Connector  ──1:N──▶  Endpoint  ──1:N──▶  Field mapping
(system,             (one callable        (response path → ServiceNow field)
 auth, base URL)      operation)
```

A handler asks the registry for "the active endpoint for capability *enrich*", calls it, and maps
the response. Adding a vendor is data entry. Adding a *capability* is a new handler subclass.

## 2. Layers

```
┌──────────────────────────────────────────────────────────────────────┐
│ Entry points                                                         │
│  Flow Designer action · Business rule · Scripted REST API ·          │
│  Scheduled job · Service Portal widget (GlideAjax)                   │
└───────────────────────────────┬──────────────────────────────────────┘
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│ Handlers — SecOpsUniversalPayloadHandler (abstract)                  │
│  ThreatIntel · Phishing · VulnIngestion · Containment                │
│  resolve endpoint → build context → call → unwrap → map → write      │
└───────────────────────────────┬──────────────────────────────────────┘
                                ▼
┌─────────────────────┬─────────────────────┬──────────────────────────┐
│ SecOpsRestClient    │ SecOpsFieldMapper   │ SecOpsTargetWriter       │
│ transport, auth,    │ declarative         │ schema-checked writes    │
│ retry, logging      │ mapping rules       │ into SecOps tables       │
└─────────────────────┴─────────────────────┴──────────────────────────┘
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│ Foundation — SecOpsRegistry · SecOpsJson · SecOpsTemplate ·          │
│              SecOpsLog · SecOpsTransactionLogger                     │
└──────────────────────────────────────────────────────────────────────┘
```

### Script includes

| Script include | Responsibility |
|---|---|
| `SecOpsJson` | Safe parse, dotted/bracket path read, credential redaction, truncation. No `eval`. |
| `SecOpsTemplate` | `${path}` substitution into paths, headers and bodies. Substitution only — never evaluation. |
| `SecOpsLog` | GSLog wrapper; redacts context; falls back to `gs.*` if global GSLog is unreachable. |
| `SecOpsRegistry` | Every table name, property name and config lookup. Nothing else hardcodes them. |
| `SecOpsTransactionLogger` | Opens/closes the redacted audit record. A logging failure never aborts the call it observes. |
| `SecOpsRestClient` | The single outbound HTTP path: credential resolution, request assembly, bounded retry, transaction. |
| `SecOpsFieldMapper` | Applies mapping rules + transforms (`trim`, `number`, `boolean`, `iso_date`, …). |
| `SecOpsTargetWriter` | The only place that writes into SecOps-owned tables. Validates table, fields and permission. |
| `SecOpsIndicatorExtractor` | Extracts URLs/hashes/IPs/domains/addresses from text, re-fanging defanged notation. |
| `SecOpsUniversalPayloadHandler` | Abstract handler. Extend this to add a capability. |
| `SecOpsThreatIntelHandler` | `enrich` |
| `SecOpsPhishingHandler` | `detonate` |
| `SecOpsVulnIngestionHandler` | `ingest` |
| `SecOpsContainmentHandler` | `contain` |
| `SecOpsHealthChecker` | `health`, and records the verdict on the connector |
| `SecOpsConsoleAjax` | Client-callable surface for the console. Re-checks roles server-side. |

## 3. Data model

| Table | Purpose |
|---|---|
| `x_335329_secops_connector` | A third-party system: category, base URL, auth mode, credential alias, MID server, timeout, retry budget, health. |
| `x_335329_secops_endpoints` | One callable operation: capability, method, path, request template, headers, response root, success codes. |
| `x_335329_secops_field_map` | A mapping rule: source JSON path → target table/field, with a transform. |
| `x_335329_secops_transaction` | Redacted audit record per call: state, HTTP status, duration, request/response, error, retry count. |
| `x_335329_secops_vuln_stage` | Staging for inbound vulnerability telemetry, before any VR promotion. |

**Why credentials are not on the connector.** `connection_alias` references `sys_alias`. The secret
stays in the platform credential store, supports per-environment values, participates in scope
protections, and is what IntegrationHub already uses. `sn_cc.ConnectionInfoProvider` resolves it at
call time. Nothing in this application's tables can leak a password, because nothing in them holds
one.

**Why target table/field are data.** Mapping rows name the target table and field. SecOps schemas
differ across releases and products; `SecOpsTargetWriter` checks `isValidField` before every set and
reports skips. A renamed SecOps field becomes a logged warning, not an outage.

## 4. Request lifecycle

```
caller
  └─▶ Handler.run(context, options)
        ├─ SecOpsRegistry.findEndpointForCapability(capability, connector?)
        │     └─ lowest-ordered ACTIVE endpoint on an ACTIVE connector
        ├─ SecOpsRestClient.execute(endpoint, context)
        │     ├─ buildRequest
        │     │    ├─ auth 'alias'  → sn_cc.ConnectionInfoProvider → url + credentials
        │     │    ├─ auth profile  → setAuthenticationProfile(type, sys_id)
        │     │    └─ SecOpsTemplate.render(path / body / headers)
        │     ├─ TransactionLogger.open   (request redacted)
        │     ├─ attempt loop  (≤ max_retries + 1)
        │     │    ├─ ok or non-retryable  → stop
        │     │    └─ 0/408/425/429/5xx    → retry
        │     ├─ 429 / 503 still failing   → state retry_pending + next_retry
        │     └─ TransactionLogger.close  (response redacted)
        ├─ HTTP 401 → refreshToken() → one retry
        ├─ extractResult(response_root)
        └─ mapAndWrite → SecOpsFieldMapper → SecOpsTargetWriter
```

## 5. Design decisions worth knowing

**No in-process backoff.** Scoped applications have no `gs.sleep()`. Transient failures retry
immediately up to the connector's budget; back-pressure responses (429/503) are parked as
`retry_pending` with a `next_retry` timestamp. Busy-waiting on a worker thread to simulate backoff
would be worse than waiting for the next scheduled run.

**Deferred retries expire, they do not replay.** Replaying would require storing the full outbound
request, and the only copy kept is redacted — precisely so credentials never sit in a table.
Replaying a redacted body would send a broken request; storing an unredacted one would be a worse
trade. Scheduled pulls recover on their next run; interactive calls are better retried by the
analyst who can see the result. The upgrade path, if ever needed, is documented in
`src/jobs/expire-deferred-retries.js`.

**`GlideRecord` vs `GlideRecordSecure`.** Framework-internal config reads and audit writes use
`GlideRecord` — they must succeed regardless of the calling user's ACLs, and they only touch this
application's own tables. Everything a user sees or that writes into a SecOps table uses
`GlideRecordSecure`. The split is deliberate and load-bearing.

**Unknown beats Clean.** When a third-party response cannot be understood, the verdict is
`Unknown`, never `Clean`. A wrong "Clean" silently suppresses a real detection; that failure mode is
unacceptable in a security tool, so the code refuses to guess.

**Analyst decisions are not overwritten.** Before rolling a verdict onto an observable, the handler
checks `has_manual_finding_override`. Automation yields to a human.

**Vulnerability Response is optional.** VR is a separate subscription and may be absent. No
`sn_vul` table is referenced at metadata level and no `sn_vul` cross-scope privilege is declared.
Ingestion stages into this application's own table; promotion is opt-in, property-gated and
runtime-guarded. See [07-vulnerability-response.md](07-vulnerability-response.md).

**Containment is loud.** Isolating a host takes a person offline. Every containment request is
validated (a request that cannot name its target is refused, not sent with an empty parameter) and
logged with the requesting user and justification.

## 6. Verification

- **96 unit tests** run with no instance, against a hand-rolled platform double
  (`test/harness.js`) covering `Class.create`, `Object.extendsObject`, `GlideRecord`,
  `GlideRecordSecure`, `sn_ws.RESTMessageV2`, `sn_cc.ConnectionInfoProvider`, `gs.*` and `GSLog`.
  The double is deliberately hand-written: the platform surface touched here is small and explicit,
  and a fake that lies is worse than no fake.
- **Live install** on dev296062 with all artifacts verified by query.
- **Live end-to-end smoke test** of the ingestion path, including confirmation that an `api_key` in
  the payload was stored as `***REDACTED***`.

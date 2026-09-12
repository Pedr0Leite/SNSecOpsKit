# Installation and configuration

## Prerequisites

| Requirement | Why |
|---|---|
| Security Incident Response (`com.snc.security_incident`) | Phishing use case reads `sn_si_incident` |
| Threat Intelligence (Security Support Common / `sn_ti`) | Observables, observable types, Threat Lookup Results |
| Vulnerability Response (`com.snc.vulnerability`) | **Optional.** Only needed to promote staged telemetry into VR |
| IntegrationHub | **Optional.** Only if you drive connectors from Flow Designer spokes; the framework's own HTTP path does not need it |
| Node.js 20+ and the ServiceNow SDK | Only to build/deploy from source |

The application installs and runs without Vulnerability Response. It also installs without SIR/TI —
the affected handlers report a clear "could not be read (… not installed)" error rather than
failing.

## Install

From source:

```bash
npm install
npm run build
npm run deploy          # add --demoData false to skip the sample connector
```

`npm run deploy` prints a rollback URL (`sys_rollback_context.do?sys_id=…`). Keep it until you have
verified the install.

## Post-install

### 1. Assign roles

| Role | For | Grants |
|---|---|---|
| `x_335329_secops.viewer` | Security managers, anyone needing visibility | Read connectors, endpoints, mappings, transaction log, staging |
| `x_335329_secops.operator` | Tier 1/2 analysts | Viewer + run connectors and test reachability |
| `x_335329_secops.admin` | Low-code administrators | Full configuration |

Roles nest: `admin` contains `operator` contains `viewer`.

### 2. Approve Restricted Caller Access

Security Incident Response ships with Restricted Caller Access active. On the verified instance
SIR tables were in **Caller Tracking** mode, so cross-scope calls succeed and are simply recorded.
If your instance sets **Caller Restricted**, this application will be blocked until approved:

> *System Applications > Application Restricted Caller Access* — find entries whose source is
> **SecOps Universal Connector Framework** and set Status from *Requested* to *Allowed*.

Nothing crashes while approval is pending: `SecOpsTargetWriter` reports
`Not permitted to create records in <table> (check ACLs and Restricted Caller Access)` and the
transaction records the failure.

The declared cross-scope privileges are read on `sn_si_incident`; read/create/write on
`sn_ti_observable` and `sn_ti_lookup_result`; read/create on `sn_ti_m2m_task_observable`; read on
`sn_ti_observable_type` and `cmdb_ci`; execute on `GSLog` and `AbstractAjaxProcessor`. There are
deliberately **no delete** privileges — SIR and TI disallow cross-scope delete, so requesting it
would be theatre.

### 3. Store the credential

*Connections & Credentials > Connection & Credential Aliases* → New.

1. Type **Connection and Credential**, Connection type **HTTP**.
2. Create a child **Connection** with the base URL, and a **Credential** (Basic, API key, OAuth 2.0).
3. Set the alias's **Application** to this scope if you want scope protections to apply.

Never put a secret in a system property or a connector field. The connector stores only the
*reference* to the alias.

### 4. Create a connector

*SecOps Universal Connector > Connectors* → New.

| Field | Guidance |
|---|---|
| Category | Drives nothing functionally; used for filtering and reporting |
| Authentication type | `alias` (recommended). `basic`/`oauth2` use a platform auth profile sys_id instead |
| Connection & Credential Alias | Required when type is `alias`. The alias's URL overrides Base URL |
| Base URL | Used when no alias URL is present |
| MID Server | Set for on-premise targets |
| HTTP timeout / Max immediate retries | Override the global properties per connector |
| Health check path | Enables the Test button before any endpoint exists |
| Active | Leave off until endpoints are configured — inactive connectors are never called |

### 5. Create endpoints

One record per operation. `capability` selects the handler.

| Field | Notes |
|---|---|
| Path | Appended to the base URL. An absolute `https://…` path overrides the base URL entirely. Supports `${…}` |
| Request body template | JSON with `${…}` placeholders. Sets `Content-Type: application/json` when it parses |
| Additional request headers | A JSON object, also templated |
| Response root path | Dotted path to the interesting node, e.g. `data.attributes` |
| Success HTTP codes | Default `200,201,202,204`. Anything else is a failure |

Placeholders available per capability are listed in [02-use-cases.md](02-use-cases.md). Unresolved
placeholders render as empty strings — they never emit a literal `${…}`.

### 6. Create field mappings

| Field | Notes |
|---|---|
| Source JSON path | Relative to the response root. `a.b`, `a.0.b`, `a[0].b` |
| Target table / field | Data, not code — this is how the app survives SecOps schema changes |
| Transform | `trim`, `lower`, `upper`, `number`, `boolean`, `json`, `iso_date` |
| Mandatory | A mandatory mapping that resolves to nothing fails the write and is reported |

### 7. Add the console

Drop the **SecOps Connector Console** widget on a Service Portal page. It shows health tiles, a
connector table with a per-connector **Test** button (operators only) and the redacted activity log.

## Configuration reference

| Property | Default | Purpose |
|---|---|---|
| `x_335329_secops.log.level` | `warn` | GSLog verbosity (`debug`/`info`/`warn`/`error`) |
| `x_335329_secops.http.timeout_ms` | `30000` | Default outbound timeout |
| `x_335329_secops.http.max_retries` | `2` | Default immediate retries |
| `x_335329_secops.log.retention_days` | `30` | Transaction retention; `0` disables cleanup |
| `x_335329_secops.redact.extra_keys` | *(empty)* | Extra payload keys to redact, comma separated |
| `x_335329_secops.ingest.max_records` | `500` | Cap per bulk ingestion payload |
| `x_335329_secops.detonate.max_indicators` | `15` | Cap per security incident. Each indicator is one **synchronous** outbound call, so raising this risks exhausting the transaction quota and leaving an incident half-processed |
| `x_335329_secops.enrichment.auto_enabled` | `false` | Master switch for the automatic enrichment business rules |
| `x_335329_secops.vr.promotion_enabled` | `false` | Master switch for VR promotion |
| `x_335329_secops.vr.entry_table` | `sn_vul_third_party_entry` | VR vulnerability table |
| `x_335329_secops.vr.item_table` | `sn_vul_vulnerable_item` | VR vulnerable item table |

## Scheduled jobs

| Job | Schedule | Active | Purpose |
|---|---|---|---|
| Connector health sweep | hourly | yes | Polls active connectors, records health |
| Transaction log cleanup | daily 02:15 | yes | Deletes transactions past retention (never deletes `retry_pending`) |
| Expire deferred retries | every 15 min | yes | Closes out stale `retry_pending` transactions and warns |

## Inbound API

| Route | Method | Auth |
|---|---|---|
| `/api/x_335329_secops/secops_connector/vulnerability` | POST | Authenticated + `x_335329_secops.admin` |
| `/api/x_335329_secops/secops_connector/health` | GET | Authenticated + `x_335329_secops.admin` |

Create a dedicated integration user holding `x_335329_secops.admin` for scanner push. The health
route reports stored health and makes no outbound calls, so it is safe to poll.

## Smoke test

```bash
BASE="https://<instance>.service-now.com/api/x_335329_secops/secops_connector"

curl -s -u "$USER:$PASS" "$BASE/health"

curl -s -u "$USER:$PASS" -X POST -H 'Content-Type: application/json' \
  --data '{"results":[{"id":"SMOKE-1","cve":"CVE-2026-0001","severity":"high","host":"web01","api_key":"should-not-persist"}]}' \
  "$BASE/vulnerability?source=SmokeTest"
```

Then check *Vulnerability staging*: one row, and `Raw payload` must show
`"api_key":"***REDACTED***"`. Delete the row afterwards.

## Uninstall

Uninstalling removes the application's tables, records and metadata. Connection & Credential
Aliases are **not** removed — they are platform records you created, and other integrations may use
them. Remove them separately if they were only for this application.

# What this application does, and how to test every part of it

Everything below is taken from the code in this repository, not from the design docs. Where a
statement is about a **third-party vendor's** API rather than this application, it is marked
🔎 **verify** — vendor endpoints change, and you should check the current vendor documentation
before wiring production credentials.

- **Instance**: `https://dev296062.service-now.com`
- **Scope**: `x_335329_secops`
- **Postman collection**: `test/postman/SecOps-Universal-Connector.postman_collection.json`
- **Self-test script**: `test/manual/loopback-selftest.js`

---

## Part 1 — What the application can do

### 1.1 In one paragraph

It is a configuration-driven middleware layer. You describe a third-party security tool as
records — a **connector** (who it is, where it lives, how to authenticate), one or more
**endpoints** (a callable operation: method, path, request body template), and optional
**field mappings** (which parts of the JSON response land on which ServiceNow field). Four
**handlers** then drive those records for four security use cases. Every call is logged with its
payloads redacted, retried when it is worth retrying, and health-checked on a schedule. Onboarding
a new tool is data entry, not code.

### 1.2 The five things it actually does

| # | Capability | Handler | Trigger | Writes to |
|---|---|---|---|---|
| 1 | **Threat intel enrichment** | `SecOpsThreatIntelHandler` | script / Flow / business rule | `sn_ti_lookup_result`, rolls a verdict up to `sn_ti_observable` |
| 2 | **Phishing response** | `SecOpsPhishingHandler` | script / Flow | `sn_ti_observable`, `sn_ti_m2m_task_observable` |
| 3 | **Vulnerability ingestion** | `SecOpsVulnIngestionHandler` | inbound REST, or scheduled pull | `x_335329_secops_vuln_stage`, optionally VR |
| 4 | **Containment** | `SecOpsContainmentHandler` | script / Flow | nothing by default — it asks a third party to act |
| 5 | **Connection health** | `SecOpsHealthChecker` | hourly job, UI button, REST | `health_status` on the connector |

Everything else in the app exists to serve those five: transport, templating, mapping, logging,
retry, redaction, and the two dashboards.

### 1.3 Capability 1 — Threat intelligence enrichment

`new SecOpsThreatIntelHandler().enrichObservable(observableSysId, options)`

Calls **every** active `enrich` endpoint (or one connector, if you name it), and for each one
writes a Threat Lookup Result row keyed on `observable + source_engine`. Then it rolls the worst
verdict up onto the observable.

Verdict resolution, in order:

1. a field mapping whose `target_field` is `finding`
2. a verdict-shaped string at `finding`, `verdict`, `disposition`, `classification`, `result`, `status`
3. a numeric score at `score`, `risk_score`, `threat_score`, `data.score`, `data.attributes.reputation` — ≥70 Malicious, ≥40 Suspicious, else Clean
4. otherwise **Unknown** — it never guesses

Two safety rules that are worth knowing before you test:

- The roll-up **will not lower** an existing verdict. `Unknown < Clean < Suspicious < Malicious`.
- The roll-up **will not touch** an observable with `has_manual_finding_override` set.

So re-running enrichment against a broken feed cannot erase a known-bad verdict. This is deliberate
and it is the behaviour you should try to break when testing.

### 1.4 Capability 2 — Phishing response

`new SecOpsPhishingHandler().analyzeIncident(incidentSysId, options)`

1. Reads `short_description`, `description`, `comments`, `work_notes` from `sn_si_incident`
   (journal fields via `getJournalEntry(-1)`, not `getValue` — the latter returns nothing)
2. Extracts indicators, **re-fanging** defanged notation first: `hxxp://` → `http://`,
   `1.1.1[.]1` → `1.1.1.1`, `[at]` → `@`, `(.)` → `.`
3. Caps at `x_335329_secops.detonate.max_indicators` (default 15) — each one is a synchronous call
4. Sends each to the `detonate` endpoint
5. Optionally creates an `sn_ti_observable` per indicator and links it to the incident
6. Returns the **worst** disposition across all indicators

Extracted types are verbatim `sn_ti_observable_type` names: `SHA256 hash`, `SHA1 hash`, `MD5 hash`,
`URL`, `Email address`, `IP address (V4)`, `Domain name`.

`ok` is true only if **at least one** indicator was successfully analysed. "Nothing malicious found"
and "the sandbox is down" deliberately do not look alike.

### 1.5 Capability 3 — Vulnerability telemetry ingestion

Two directions:

- **Push** — a scanner POSTs to `/api/x_335329_secops/secops_connector/vulnerability`
- **Pull** — `new SecOpsVulnIngestionHandler().pull({connector: id})` calls a configured `ingest` endpoint

Both land in `x_335329_secops_vuln_stage`. **Never** straight into Vulnerability Response.

If the endpoint has no field mappings, records are mapped **by convention** — this is why most
scanner payloads work with zero configuration:

| Staging field | Accepted source keys, in order |
|---|---|
| `external_id` | `external_id`, `id`, `vuln_id`, `finding_id`, `qid` |
| `cve` | `cve`, `cve_id`, `cveId`, `vulnerability_id` |
| `title` | `title`, `name`, `summary`, `synopsis` |
| `severity` | `severity`, `risk`, `criticality` |
| `cvss_score` | `cvss_score`, `cvss`, `score`, `base_score` |
| `ci_identifier` | `ci`, `host`, `hostname`, `asset`, `asset_name`, `ip`, `ip_address`, `fqdn` |

Severity is normalised: `critical`/`4`/`5` → critical, `high`/`3` → high, `medium`/`moderate`/`2` →
medium, `low`/`1` → low, `info`/`informational`/`0` → informational, anything else → unknown.

Other behaviour to test:

- **Envelope sniffing** — a bare array, or an object containing `records`, `results`, `items`, `data`, `vulnerabilities` or `findings`. Anything else, pass `records_path=a.b.c`.
- **De-duplication** — coalesced on `source` + `external_id`. Re-sending updates `last_seen` and keeps the original `first_seen`.
- **No identifier** — falls back to `cve@ci_identifier`, then `cve`, then the record is skipped with an error rather than staged as a duplicate of nothing.
- **CI matching** — two queries for the whole batch (by `name`, then by `ip_address` for whatever did not resolve). An identifier matching **more than one** CI is left unresolved on purpose.
- **Batch cap** — `x_335329_secops.ingest.max_records`, default 500. Over that, the first 500 are staged and the response says so.
- **Promotion into VR** — off by default (`x_335329_secops.vr.promotion_enabled`), and skipped entirely if the VR tables are absent.

### 1.6 Capability 4 — Containment

`new SecOpsContainmentHandler().contain({target_type, target_value, action, reason, incident})`

- `target_type`: `host`, `ip`, `user`, `url`, `hash`, `account`
- `action`: `isolate`, `release`, `block`, `unblock`
- Both `target_value` and `target_type` are **mandatory** — a request that cannot name its target is refused before any HTTP happens
- The requesting user and the reason are logged before the call, not after

### 1.7 Capability 5 — Health

`SecOpsHealthChecker.check(connectorId)` uses the connector's `health` endpoint, or synthesises a
GET against `health_endpoint_path` so a connector can be tested before any endpoint exists.

| Result | Health |
|---|---|
| success code | `healthy` |
| HTTP 4xx | `degraded` — it answered, so it is up; the config or credential is wrong |
| HTTP 5xx | `degraded` |
| no answer at all (status 0) | `down` |
| connector inactive | `unknown`, not tested |

### 1.8 The supporting machinery

| Component | What it does | Worth testing? |
|---|---|---|
| `SecOpsRestClient` | The single outbound path. Builds, authenticates, retries, logs. | Yes — §4.6 |
| `SecOpsTemplate` | `${path}` substitution. **Substitution only, never eval.** JSON-escapes values when the template is JSON. | Yes — §4.2 |
| `SecOpsJson` | Safe parse, dotted-path get, and **redaction** of credential-shaped keys | Yes — §4.3 |
| `SecOpsFieldMapper` | Applies mapping rows, with 8 transforms | Yes — §4.4 |
| `SecOpsTargetWriter` | Every write. `GlideRecordSecure` by default, coalesce, insert-only fields, schema checks | Yes — §4.5 |
| `SecOpsIndicatorExtractor` | IOC harvesting with de-fanging | Yes — §4.1 |
| `SecOpsWorkQueue` | Merges SIR incidents, SIR tasks and findings into one row shape | Yes — §2.4 |
| `SecOpsMetrics` | The overview aggregates | Yes — §2.5 |
| `SecOpsTransactionLogger` | Opens/closes the redacted audit row | Yes — §4.3 |

### 1.9 Scheduled jobs

| Job | Frequency | What it does |
|---|---|---|
| Connector health sweep | hourly | Health-checks every **active** connector |
| Transaction log cleanup | daily 02:15 | Deletes transactions older than `log.retention_days` (30), max 5000/run, **never** deletes `retry_pending` |
| Expire deferred retries | every 15 min | Marks `retry_pending` transactions past `next_retry` as `failed`. It does **not** replay them — the stored request is redacted, so replaying it would send a broken request |

### 1.10 Business rules

Both ship **inactive** *and* are gated by `x_335329_secops.enrichment.auto_enabled` (false). Two
independent switches, because enabling automation that spends a customer's API quota should never
be a side effect of installing an app.

| Rule | Table | When |
|---|---|---|
| Enrich observable on link to incident | `sn_ti_m2m_task_observable` | async insert |
| Re-enrich on finding reset | `sn_ti_observable` | async update, `finding` changes |

### 1.11 Roles

| Role | Can |
|---|---|
| `x_335329_secops.viewer` | Read all config, transactions, staging; open both dashboards |
| `x_335329_secops.operator` | viewer + execute the console's client-callable script include |
| `x_335329_secops.admin` | operator + create/update/delete all config; **required for the inbound ingestion API** |

### 1.12 What it deliberately does not do

- **Store credentials.** They live in Connection & Credential Aliases and resolve at call time.
- **Write into Vulnerability Response by default.** Staged, opt-in, runtime-guarded.
- **Lower a threat verdict, or override a manual analyst decision.**
- **Replay a failed request automatically.** See §1.9.
- **Refresh an OAuth token itself.** A 401 is reported with the fix, because a blind retry on a dead grant can lock out the service account.
- **Sleep between retries.** Scoped apps have no `gs.sleep()`; back-pressure is parked for the deferred job instead.

---

## Part 2 — Testing the inbound APIs with Postman

Import `test/postman/SecOps-Universal-Connector.postman_collection.json`. Everything below is in it.

### 2.0 Authentication

Basic auth with a user holding the right role. In the collection, set the environment variables
`base_url`, `sn_user`, `sn_password`.

| API | Path | Role required |
|---|---|---|
| Ingestion | `/api/x_335329_secops/secops_connector/*` | `x_335329_secops.admin` |
| Console | `/api/x_335329_secops/secops_console/*` | `x_335329_secops.viewer` (or operator/admin) |
| Table API | `/api/now/table/*` | per-table ACLs |

> Test the ACL itself: call the ingestion API as a user with only `viewer` and you should get
> **403**, not 200. If you get 200, the ACL is not doing its job.

### 2.1 Ingest vulnerabilities — the normal case

```
POST {{base_url}}/api/x_335329_secops/secops_connector/vulnerability?source=PostmanTest
Content-Type: application/json
```

```json
[
  {
    "id": "PT-1001",
    "cve": "CVE-2026-10001",
    "title": "Test finding - outdated TLS library",
    "severity": "high",
    "cvss_score": 7.5,
    "host": "postman-test-host-01"
  },
  {
    "id": "PT-1002",
    "cve": "CVE-2026-10002",
    "title": "Test finding - world-writable configuration file",
    "severity": "medium",
    "cvss_score": 5.3,
    "host": "postman-test-host-01"
  },
  {
    "id": "PT-1003",
    "cve": "CVE-2026-10003",
    "title": "Test finding - deprecated cipher suite offered",
    "severity": "low",
    "cvss_score": 3.1,
    "host": "postman-test-host-02"
  }
]
```

Expect **201**:

```json
{ "ok": true, "staged": 3, "skipped": 0, "errors": [], "promoted": null }
```

Verify: `x_335329_secops_vuln_stage` has three rows with `source=PostmanTest`, `state=new`,
`first_seen` and `last_seen` set. `ci` is empty unless a CI named `postman-test-host-01` exists.

### 2.2 De-duplication

**Send the exact same request again.** Still `staged: 3`, but the staging table still holds only
**three** rows. Check one: `last_seen` moved, `first_seen` did not.

That is the coalesce on `source` + `external_id` plus `insertOnly: ['first_seen']`. If you get six
rows, de-duplication is broken.

### 2.3 An envelope, and `records_path`

Auto-detected envelope — no parameter needed, because `findings` is a known wrapper key:

```
POST .../vulnerability?source=PostmanTest
```

```json
{
  "scan_id": "scan-2026-09-14-001",
  "completed": "2026-09-14T09:00:00Z",
  "findings": [
    { "id": "PT-2001", "cve": "CVE-2026-20001", "title": "Test finding in an envelope", "severity": "critical", "host": "postman-test-host-01" }
  ]
}
```

A wrapper the app does **not** know about needs the path:

```
POST .../vulnerability?source=PostmanTest&records_path=report.sections.vulnerabilities
```

```json
{
  "report": {
    "sections": {
      "vulnerabilities": [
        { "id": "PT-3001", "cve": "CVE-2026-30001", "title": "Test finding at a custom path", "severity": "medium", "host": "postman-test-host-02" }
      ]
    }
  }
}
```

Leave `records_path` off this one and you should get `staged: 0` with `ok: true` — nothing found,
no error. That is correct behaviour, and it is the most common misconfiguration in real feeds.

### 2.4 Convention mapping — a scanner-shaped payload with no configuration

Qualys-style keys (`qid`, `ip`), no field mappings anywhere:

```json
[
  {
    "qid": 38657,
    "vulnerability_id": "CVE-2026-40001",
    "synopsis": "Test finding - SSH weak MAC algorithms",
    "risk": "3",
    "base_score": 6.5,
    "ip": "192.0.2.11"
  }
]
```

Expect `severity: high` (risk `"3"` normalises to high) and `external_id: 38657`.

`192.0.2.0/24` is TEST-NET-1 from RFC 5737 — reserved for documentation, routes nowhere. Use it for
anything IP-shaped in your tests.

### 2.5 Redaction — the one to actually verify

```json
[
  {
    "id": "PT-5001",
    "cve": "CVE-2026-50001",
    "title": "Test finding with credentials in the payload",
    "severity": "low",
    "host": "postman-test-host-01",
    "api_key": "this-string-must-never-be-stored",
    "scanner_config": { "password": "also-must-never-be-stored", "token": "nor-this" }
  }
]
```

Then open the staged row and read `raw_payload`. Every one of those three values must read
`***REDACTED***`. Search the whole instance for `this-string-must-never-be-stored` — zero hits is
the pass condition.

Redacted key names include `password`, `secret`, `client_secret`, `api_key`, `apikey`, `token`,
`authorization`, `x-api-key` and whatever you add to `x_335329_secops.redact.extra_keys`.

### 2.6 A record with no usable identifier

```json
[
  { "title": "Test finding with no id and no cve", "severity": "low", "host": "postman-test-host-01" }
]
```

Expect **400** with `staged: 0`, `skipped: 1`, and an error naming the problem. It must not silently
stage an anonymous row.

### 2.7 Error handling

| Request | Expected |
|---|---|
| No `source` parameter | `400` — `The "source" query parameter is required` |
| Empty body | `400` — `A JSON request body is required` |
| Body `{ not json` | `400` — `The request body is not valid JSON`, **not 500** |
| `[]` | `201`, `staged: 0`, `ok: true` |
| 501+ records | `201`, `staged: 500`, error says only the first 500 were staged |
| Called as a `viewer` | `403` |

The malformed-JSON case is worth its own test: the script reads `request.body.dataString` rather
than `.data` precisely so a bad client payload is a 400 and not a platform 500.

To generate the oversize payload, use this Postman **pre-request script**:

```javascript
const records = []
for (let i = 1; i <= 501; i++) {
    records.push({ id: `PT-BULK-${i}`, cve: `CVE-2026-9${String(i).padStart(4, '0')}`,
                   title: `Bulk test finding ${i}`, severity: 'low', host: 'postman-test-host-03' })
}
pm.variables.set('bulk_payload', JSON.stringify(records))
```

…with `{{bulk_payload}}` as the raw body.

### 2.8 Promotion into Vulnerability Response

```
POST .../vulnerability?source=PostmanTest&promote=true
```

On an instance without VR you get an honest refusal rather than a failure:

```json
{ "promoted": { "ok": true, "promoted": 0, "skipped": true,
  "errors": ["Promotion is disabled (x_335329_secops.vr.promotion_enabled is false)"] } }
```

Set the property to `true` and re-send: the message changes to name the missing VR tables. Both are
`ok: true` with `skipped: true` — a disabled optional feature is not an error.

### 2.9 Connector health

```
GET {{base_url}}/api/x_335329_secops/secops_connector/health
```

```json
{ "ok": true, "total": 1, "summary": { "healthy": 1, "degraded": 0, "down": 0, "unknown": 0 },
  "connectors": [ { "sys_id": "...", "name": "...", "health_status": "healthy",
                    "last_health_check": "2026-09-14 09:00:00", "last_health_message": "Reachable (HTTP 200)" } ] }
```

This reports **stored** health and makes no outbound calls, so it is safe to poll from a monitoring
system. Confirm that: poll it ten times and check no new transactions appear.

### 2.10 The console APIs

```
GET {{base_url}}/api/x_335329_secops/secops_console/work?scope=me&sources=sir,findings&severities=critical,high&q=test&limit=50
GET {{base_url}}/api/x_335329_secops/secops_console/overview
GET {{base_url}}/api/x_335329_secops/secops_console/connectors
```

`/work` parameters: `scope` (`me`|`team`|`all`), `sources` (`sir`,`findings`), `severities`, `q`,
`limit` (1–300).

Two things to verify on `/work`:

- `scope=team` returns a `groups` count. If it is `0`, the response is honestly telling you the user
  is in no groups — it is not silently behaving like `scope=me`.
- Call it as two different users. The row sets must differ. Every read is `GlideRecordSecure`, so
  the API cannot widen what a user may see.

On `/overview`, note the intentional asymmetry: **the counts are organisation-wide** (GlideAggregate
does not apply record ACLs; the control is the role gate), while the drill-in in the UI is
ACL-filtered. The dashboard states that gap out loud rather than hiding it.

### 2.11 Configuring the app entirely over REST

You never need the UI. Create a connector:

```
POST {{base_url}}/api/now/table/x_335329_secops_connector
```

```json
{
  "name": "Postman Echo (test)",
  "vendor": "Postman",
  "category": "threat_intel",
  "active": "true",
  "base_url": "https://postman-echo.com",
  "auth_type": "none",
  "http_timeout_ms": "15000",
  "max_retries": "1",
  "health_endpoint_path": "/status/200",
  "description": "Harmless loopback connector for testing. Safe to delete."
}
```

An endpoint (`connector` takes the sys_id returned above):

```json
{
  "name": "Echo lookup",
  "connector": "{{connector_sys_id}}",
  "capability": "enrich",
  "active": "true",
  "http_method": "post",
  "path": "/post",
  "request_template": "{\"indicator\":\"${ioc}\",\"type\":\"${type}\",\"verdict\":\"suspicious\"}",
  "response_root": "json",
  "success_codes": "200"
}
```

A field mapping:

```json
{
  "endpoint": "{{endpoint_sys_id}}",
  "source_path": "verdict",
  "target_table": "sn_ti_lookup_result",
  "target_field": "finding",
  "transform": "none",
  "order": "100"
}
```

`https://postman-echo.com/post` echoes the JSON body back under `json`, so `response_root: "json"`
hands the handler back exactly what was sent. That is what makes it a complete round-trip test with
no vendor, no credential and no side effects. Confirmed working as of 2026-09-14.

---

## Part 3 — External applications you can connect to

### 3.1 What "connectable" means here

A tool is connectable if it speaks HTTP and this application can authenticate to it. Concretely:

| The framework handles | How |
|---|---|
| **JSON** request bodies | Native. Values are JSON-escaped on substitution. |
| **Form-encoded** or **XML** bodies | Yes — put the body in `request_template` and set `Content-Type` in the endpoint's *Additional request headers*. Without a Content-Type it logs a warning naming the fix. |
| **GraphQL** | Yes — it is a JSON POST. `{"query":"...","variables":{...}}` |
| **Basic auth** | Connection & Credential Alias (recommended), or a Basic auth profile |
| **OAuth 2.0** | An OAuth profile sys_id. The platform refreshes; a dead grant surfaces as a 401 with an actionable message. |
| **API key in a header** | Two ways: put it in the alias as `api_key` (injected as `Authorization: Bearer …` without you pasting it anywhere), or a literal header in *Additional request headers* |
| **On-premises tools** | Set a MID Server on the connector |
| Pagination, streaming, webhooks **out** | ❌ Not built. One call per endpoint execution. |

### 3.2 The vendor matrix

🔎 **verify every path and header against current vendor documentation.** These are the shapes as I
know them; the ServiceNow-side configuration is exact.

#### Threat intelligence — capability `enrich`

| Vendor | Base URL | Auth | Example endpoint |
|---|---|---|---|
| VirusTotal v3 | `https://www.virustotal.com/api/v3` | header `x-apikey` | `GET /ip_addresses/${ioc}` |
| AbuseIPDB | `https://api.abuseipdb.com/api/v2` | header `Key` | `GET /check?ipAddress=${ioc}&maxAgeInDays=90` |
| AlienVault OTX | `https://otx.alienvault.com/api/v1` | header `X-OTX-API-KEY` | `GET /indicators/IPv4/${ioc}/general` |
| GreyNoise | `https://api.greynoise.io` | header `key` | `GET /v3/community/${ioc}` |
| Shodan | `https://api.shodan.io` | key in query | `GET /shodan/host/${ioc}?key=…` |
| urlscan.io | `https://urlscan.io/api/v1` | header `API-Key` | `POST /scan/` |
| MISP | your instance | header `Authorization` | `POST /attributes/restSearch` |
| Pulsedive | `https://pulsedive.com/api` | key in query | `GET /v1/info.php?indicator=${ioc}` |
| IBM X-Force | `https://api.xforce.ibmcloud.com` | Basic (key:password) | `GET /ipr/${ioc}` |
| Recorded Future | `https://api.recordedfuture.com/v2` | header `X-RFToken` | `GET /ip/${ioc}` |
| Anomali ThreatStream | `https://api.threatstream.com/api/v2` | header `Authorization` | `GET /intelligence/?value=${ioc}` |
| ThreatConnect | your instance | HMAC | `GET /v3/indicators` |

**VirusTotal, ready to paste.** Connector: base URL as above, `auth_type: none`, additional request
headers `{"x-apikey":"…"}` — or put the key in an alias as `api_key` if the vendor accepts
`Authorization: Bearer`. VirusTotal does not, so use the header.

Endpoint:

| Field | Value |
|---|---|
| capability | `enrich` |
| http_method | `get` |
| path | `/ip_addresses/${ioc}` |
| response_root | `data.attributes.last_analysis_stats` |
| success_codes | `200` |

Field mapping: `source_path` `malicious` → `target_field` `finding` is **not** what you want here,
because `malicious` is a count, not a verdict. Instead leave the mapping off and let the score
fallback do it — or map `data.attributes.reputation` and rely on the numeric rule (§1.3). Test it
against a known-bad IP from your own threat feed, never against a live production indicator.

**AbuseIPDB, ready to paste.** `response_root: data`, and the score path
`data.abuseConfidenceScore` is 0–100 — which lines up exactly with the framework's ≥70 / ≥40
thresholds with no mapping at all.

Postman test before you wire it (proves your key works):

```
GET https://api.abuseipdb.com/api/v2/check?ipAddress=118.25.6.39&maxAgeInDays=90
Key: {{abuseipdb_key}}
Accept: application/json
```

#### Sandbox detonation — capability `detonate`

| Vendor | Base URL | Auth | Notes |
|---|---|---|---|
| Hybrid Analysis | `https://www.hybrid-analysis.com/api/v2` | header `api-key` | 🔎 requires `User-Agent: Falcon Sandbox` |
| Joe Sandbox | `https://jbxcloud.joesecurity.org/api` | form field `apikey` | form-encoded, set Content-Type |
| VMRay | your appliance | header `Authorization: api_key …` | |
| ANY.RUN | `https://api.any.run/v1` | header `Authorization: API-Key …` | |
| VirusTotal | as above | `x-apikey` | `GET /files/${ioc}` for a hash |
| Cuckoo / CAPE | your appliance | token | |

For the phishing flow, the `detonate` endpoint receives `${ioc}`, `${value}`, `${type}` and
`${incident}` in its context.

#### EDR / XDR containment — capability `contain`

| Vendor | Base URL | Auth | Isolate endpoint |
|---|---|---|---|
| CrowdStrike Falcon | `https://api.crowdstrike.com` | OAuth2 client credentials | `POST /devices/entities/devices-actions/v2?action_name=contain` |
| SentinelOne | `https://<tenant>.sentinelone.net` | header `Authorization: ApiToken …` | `POST /web/api/v2.1/agents/actions/disconnect` |
| Microsoft Defender for Endpoint | `https://api.securitycenter.microsoft.com` | OAuth2 (Entra) | `POST /api/machines/${target_value}/isolate` |
| Palo Alto Cortex XDR | `https://api-<fqdn>` | headers `x-xdr-auth-id` + `Authorization` | `POST /public_api/v1/endpoints/isolate` |
| VMware Carbon Black Cloud | `https://defense.conferdeploy.net` | header `X-Auth-Token` | quarantine device API |
| Cybereason | your instance | session cookie | 🔎 login-then-act flow, awkward here |
| Sophos Central | `https://api-<region>.central.sophos.com` | OAuth2 | endpoint isolation API |

**Microsoft Defender for Endpoint, ready to paste.**

| Field | Value |
|---|---|
| connector auth_type | `oauth2` + the profile sys_id |
| capability | `contain` |
| http_method | `post` |
| path | `/api/machines/${target_value}/isolate` |
| request_template | `{"Comment":"${reason}","IsolationType":"Full"}` |
| success_codes | `200,201` |

`${target_value}`, `${target_type}`, `${action}`, `${reason}`, `${incident}` and `${requested_by}`
are all available in a containment template. **Test with a lab machine ID.** Containment is the one
capability where a wrong target has an immediate human cost.

#### Firewall / NAC — capability `contain`

| Vendor | Notes |
|---|---|
| Palo Alto PAN-OS | 🔎 XML API — workable, set `Content-Type: application/xml` and template the XML |
| Fortinet FortiGate | REST + API token header |
| Cisco Umbrella | Enforcement API, POST a domain to a destination list |
| Zscaler | JSON API, but 🔎 session-based auth needs a login call first |
| Cloudflare | `POST /client/v4/…/firewall/rules`, header `Authorization: Bearer` |
| Cisco ISE | 🔎 ERS API, XML or JSON, Basic auth |

#### Vulnerability scanners — capability `ingest`

Two integration styles, and the choice matters:

- **Push** — the scanner (or a CI job, or a Lambda) POSTs to `/vulnerability`. No credentials stored
  in ServiceNow, works through a firewall, and it is the path this app is built around.
- **Pull** — configure an `ingest` endpoint and call `SecOpsVulnIngestionHandler.pull()`. Needs
  credentials, and needs the scanner to be reachable, but it is scheduleable.

| Vendor | Base URL | Auth | Pull endpoint |
|---|---|---|---|
| Tenable.io | `https://cloud.tenable.com` | header `X-ApiKeys: accessKey=…;secretKey=…` | `GET /workbenches/vulnerabilities` |
| Tenable.sc | your appliance | header `x-apikey` | `POST /rest/analysis` |
| Qualys VMDR | `https://qualysapi.<pod>.qualys.com` | Basic | 🔎 largely XML; set Content-Type |
| Rapid7 InsightVM | `https://<region>.api.insight.rapid7.com` | header `X-Api-Key` | `GET /vm/v4/integration/assets` |
| Wiz | your tenant | OAuth2 | 🔎 GraphQL POST |
| Snyk | `https://api.snyk.io` | header `Authorization: token …` | `GET /rest/orgs/{org}/issues` |
| AWS Inspector / Security Hub | 🔎 SigV4 signing — **not supported**, push from a Lambda instead |
| Trivy / Grype / Nuclei (CI) | n/a | n/a | push their JSON output — see below |

**A CI pipeline is the easiest real integration to build.** Trivy's JSON already carries
`VulnerabilityID` and `Severity`; a five-line `jq` reshape gives you the convention keys and a
`curl` posts it:

```bash
trivy image --format json myapp:latest \
  | jq '[.Results[].Vulnerabilities[]? | {id:.VulnerabilityID, cve:.VulnerabilityID,
        title:.Title, severity:(.Severity|ascii_downcase), cvss_score:.CVSS.nvd.V3Score,
        host:"myapp:latest"}]' \
  | curl -s -u "$SN_USER:$SN_PASS" -H 'Content-Type: application/json' -d @- \
    "$SN_INSTANCE/api/x_335329_secops/secops_connector/vulnerability?source=Trivy"
```

#### SIEM — capability `custom` (or `ingest`)

The framework has no SIEM-specific handler; you use `custom` and drive it from a Flow or script.

| Vendor | Notes |
|---|---|
| Splunk | 🔎 `POST /services/search/jobs/export` is **form-encoded**, not JSON — set Content-Type |
| Microsoft Sentinel | `POST https://api.loganalytics.io/v1/workspaces/{id}/query`, OAuth2, JSON KQL |
| IBM QRadar | header `SEC`, `GET /api/ariel/searches` |
| Elastic Security | `POST /_search`, API key header |
| Google SecOps (Chronicle) | 🔎 OAuth2 service account |
| Sumo Logic, Devo, Exabeam | REST + JSON, straightforward |

#### Identity — capability `contain`, target types `user` / `account`

| Vendor | Isolate/suspend |
|---|---|
| Okta | `POST /api/v1/users/${target_value}/lifecycle/suspend`, header `Authorization: SSWS …` |
| Microsoft Entra ID | 🔎 Graph `PATCH /v1.0/users/{id}` with `{"accountEnabled":false}`, OAuth2 |
| Duo | 🔎 HMAC-signed — awkward |
| Ping, JumpCloud | REST + token |

### 3.3 Things that will need work beyond configuration

| Blocker | Why | Workaround |
|---|---|---|
| **AWS SigV4** | Request signing is not implemented | Push from a Lambda instead of pulling |
| **HMAC request signing** (Duo, ThreatConnect) | Same | A small script include that pre-computes the header, called from a Flow |
| **Login-then-act** (Zscaler, Cybereason) | One endpoint execution = one call | Two endpoints and a Flow, or a wrapper script include |
| **Pagination** | Not built | Loop in a Flow, or pull smaller windows more often |
| **Very large responses** | `request_summary`/`response_summary` cap at 8000 chars, `raw_payload` at 32000 | Set a `response_root` so only the useful node is kept |
| **Webhooks out** | The app only receives | Use a Business Rule + RESTMessageV2, or Flow Designer |

---

## Part 4 — Internal functionality: step-by-step tests

These cannot be reached from Postman — they are script includes. Run them in
**System Definition → Scripts - Background**, and set the scope selector to **SecOps Universal
Connector Framework** first.

> **Why the scope matters.** The infrastructure script includes are `package_private`. In global
> scope `new SecOpsJson()` fails with "SecOpsJson is not defined". Only the five handlers are
> `public` (callable cross-scope as `x_335329_secops.SecOpsPhishingHandler`).

Everything below is read-only or creates records you can delete. Nothing calls a third party unless
it says so.

### 4.1 Indicator extraction — no network, no writes

```javascript
var text = [
    'Reported phish from finance-alerts[at]example-invoices.test',
    'Link: hxxps://login-verify.example-phish.test/session?id=99',
    'Callback IP 192.0.2.44 and 198.51.100.7',
    'Attachment SHA256 e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    'Also MD5 d41d8cd98f00b204e9800998ecf8427e',
    'Version string 1.2.3.4 should NOT be treated as an IP'
].join('\n')

var found = new SecOpsIndicatorExtractor().extract(text)
gs.info('Found ' + found.length + ' indicators')
found.forEach(function (i) { gs.info('  ' + i.type + ' = ' + i.value) })
```

**Pass:** the email address is re-fanged from `[at]`, the URL from `hxxps://`, both IPs are found,
both hashes are typed correctly, and `1.2.3.4` **is** reported as an IP (it is a valid dotted quad —
the guard rejects octets over 255, not plausible-looking version strings). Domain names are only
reported when they are not already part of a URL or email that was captured.

### 4.2 Template rendering and JSON escaping — the injection test

```javascript
var t = new SecOpsTemplate()

// A benign value
gs.info(t.render('{"indicator":"${ioc}"}', { ioc: '8.8.8.8' }, { jsonEscape: true }))

// A value that would break or hijack the body without escaping
var nasty = 'evil","admin":true,"x":"'
gs.info('UNESCAPED: ' + t.render('{"indicator":"${ioc}"}', { ioc: nasty }))
gs.info('ESCAPED:   ' + t.render('{"indicator":"${ioc}"}', { ioc: nasty }, { jsonEscape: true }))

// Unresolved placeholders must not ship literally
gs.info(t.render('{"a":"${missing.path}"}', {}, { jsonEscape: true }))

// Nested paths
gs.info(t.render('${a.b.c}', { a: { b: { c: 'deep' } } }))
```

**Pass:** the escaped output is still parseable JSON with exactly one key, the unescaped one is not,
the missing path renders as `""` and never as a literal `${missing.path}`, and the nested path
resolves. Note the real client always escapes for JSON templates — this test just proves why.

### 4.3 Redaction and safe parsing

```javascript
var json = new SecOpsJson()

var payload = {
    user: 'analyst',
    password: 'hunter2',
    nested: { api_key: 'AKIA-EXAMPLE', client_secret: 'shhh', keep: 'visible' },
    headers: { Authorization: 'Bearer abc.def.ghi', 'X-Api-Key': 'xyz' }
}

gs.info(json.forLog(payload, 4000, ''))
gs.info('Extra keys honoured: ' + json.forLog({ my_custom_secret: 'v' }, 4000, 'my_custom_secret'))
gs.info('Malformed parse returns null: ' + (json.parse('{ not json') === null))
gs.info('Dotted get: ' + json.get({ a: { b: [1, 2, 3] } }, 'a.b.1', 'fallback'))
```

**Pass:** every credential-shaped value reads `***REDACTED***`, `keep` survives, the custom key is
redacted, `parse` returns `null` rather than throwing, and the dotted path reaches into the array.

The behaviour most worth knowing: redaction **fails closed** at the depth limit. A structure nested
deeper than the limit is replaced wholesale rather than passed through unredacted.

### 4.4 Field mapping and transforms

```javascript
var maps = [
    { source_path: 'name',      target_table: 'x_335329_secops_vuln_stage', target_field: 'title',       transform: 'trim',   order: 100 },
    { source_path: 'sev',       target_table: 'x_335329_secops_vuln_stage', target_field: 'severity',    transform: 'lower',  order: 200 },
    { source_path: 'cvss.base', target_table: 'x_335329_secops_vuln_stage', target_field: 'cvss_score',  transform: 'number', order: 300 },
    { source_path: 'asset.fqdn',target_table: 'x_335329_secops_vuln_stage', target_field: 'ci_identifier', transform: 'lower', order: 400 },
    { source_path: 'nothing.here', target_table: 'x_335329_secops_vuln_stage', target_field: 'external_id',
      transform: 'none', default_value: 'FALLBACK-1', order: 500 }
]

var result = new SecOpsFieldMapper().apply(
    { name: '  Padded title  ', sev: 'HIGH', cvss: { base: '7.5' }, asset: { fqdn: 'HOST-A.example.test' } },
    maps,
    'x_335329_secops_vuln_stage'
)
gs.info(JSON.stringify(result, null, 2))
```

**Pass:** title trimmed, severity lower-cased, CVSS a number not a string, fqdn lower-cased, and the
missing path filled from `default_value`. Then flip that last row to `mandatory: true`, remove the
default, and confirm it comes back in `errors` instead of writing a partial record.

### 4.5 Writes: coalesce, insert-only, and ACLs

```javascript
var w = new SecOpsTargetWriter()
var T = 'x_335329_secops_vuln_stage'

var a = w.write(T, { source: 'BgScriptTest', external_id: 'BG-1', title: 'First write',
                     severity: 'low', first_seen: new GlideDateTime().getValue() },
                { secure: true, coalesce: ['source', 'external_id'], insertOnly: ['first_seen'] })
gs.info('insert: ' + JSON.stringify(a))

var b = w.write(T, { source: 'BgScriptTest', external_id: 'BG-1', title: 'Second write',
                     severity: 'high', first_seen: '2000-01-01 00:00:00' },
                { secure: true, coalesce: ['source', 'external_id'], insertOnly: ['first_seen'] })
gs.info('update: ' + JSON.stringify(b))
gs.info('same record: ' + (a.sys_id === b.sys_id))

// Coalescing on a field that is not set must NOT create a duplicate silently
gs.info(JSON.stringify(w.write(T, { source: 'BgScriptTest', title: 'No external id' },
                               { coalesce: ['source', 'external_id'] })))

// A field that does not exist is reported, not thrown
gs.info(JSON.stringify(w.write(T, { source: 'BgScriptTest', external_id: 'BG-2',
                                    no_such_field: 'x' }, { coalesce: ['source', 'external_id'] })));
```

**Pass:** one record, updated in place; `b.updated === true`; `first_seen` still the original value;
the unknown field appears in `skipped` rather than throwing. Clean up with
`source=BgScriptTest` afterwards.

Then repeat the first write **impersonating a user with no roles** (`gs.getSession().impersonate()`
in a sub-transaction, or just log in as them and use a scripted REST call). With `secure: true` the
write must be refused. That is `GlideRecordSecure` doing its job, and it is what makes the
"editing goes under the user's own session" claim true.

### 4.6 The verdict-monotonicity rule — the most important internal test

This is the rule that protects a known-bad verdict from being erased by a broken feed. Needs Threat
Intelligence installed.

```javascript
var ti = new SecOpsThreatIntelHandler()

// Create a throwaway observable
var typeId = ti.observableTypeId ? null : null   // types are looked up by name inside the handler
var obs = new GlideRecord('sn_ti_observable')
obs.initialize()
obs.setValue('value', '192.0.2.77')
var t = new GlideRecord('sn_ti_observable_type')
t.addQuery('name', 'IP address (V4)'); t.setLimit(1); t.query()
if (t.next()) { obs.setValue('type', t.getUniqueValue()) }
obs.setValue('finding', 'Malicious')
var id = obs.insert()
gs.info('observable ' + id + ' starts Malicious')

gs.info('downgrade to Clean accepted?    ' + ti.rollUpFinding(id, 'Clean'))       // expect false
gs.info('downgrade to Unknown accepted?  ' + ti.rollUpFinding(id, 'Unknown'))     // expect false
gs.info('same value accepted?            ' + ti.rollUpFinding(id, 'Malicious'))   // expect false

var check = new GlideRecord('sn_ti_observable')
check.get(id)
gs.info('final finding (must be Malicious): ' + check.getValue('finding'))

// Now the other direction
check.setValue('finding', 'Clean'); check.update()
gs.info('upgrade to Malicious accepted?  ' + ti.rollUpFinding(id, 'Malicious'))   // expect true

// And the manual override
check.get(id)
if (check.isValidField('has_manual_finding_override')) {
    check.setValue('has_manual_finding_override', true)
    check.setValue('finding', 'Clean')
    check.update()
    gs.info('override respected? ' + (ti.rollUpFinding(id, 'Malicious') === false))  // expect true
}

// Tidy up
var del = new GlideRecord('sn_ti_observable'); if (del.get(id)) { del.deleteRecord() }
```

**Pass:** the three downgrade attempts all return `false` and the finding stays `Malicious`; the
upgrade returns `true`; the override is respected. If any downgrade succeeds, automation can erase
an analyst's known-bad verdict — treat that as a stop-ship bug.

### 4.7 Health classification

Point a test connector at `https://httpbin.org/status/500` and run a check — expect `degraded`.
Point it at `https://192.0.2.1/nothing` (TEST-NET, unroutable) and expect `down` after the timeout.
Deactivate the connector and expect `unknown` with "Connector is inactive - not tested".

The self-test script in §5 does the `degraded` case for you.

### 4.8 Retry and back-pressure

Create an endpoint pointing at `https://httpbin.org/status/429`, `max_retries: 2`, then run it.

**Pass:** the transaction shows `retry_count: 2` (three attempts), `state: retry_pending`, and a
`next_retry` in the future. Then run the **Expire deferred retries** scheduled job manually
(`Scheduled Jobs → Execute Now`) after `next_retry` has passed: the state must become `failed` with
the "deferred retry window elapsed" message appended.

A `500` behaves differently — it is retryable but not back-pressure, so it ends as `failed`
immediately with no `next_retry`. Confirm both.

### 4.9 The scheduled jobs

| Job | How to test |
|---|---|
| Health sweep | Activate a connector, `Execute Now`, confirm `last_health_check` moved on every active connector and none on inactive ones |
| Transaction cleanup | Set `x_335329_secops.log.retention_days` to `0` → the job logs "disabled" and deletes nothing. Set it to `1`, back-date a transaction's `sys_created_on`, `Execute Now`, confirm it is gone — and confirm a back-dated `retry_pending` row **survives** |
| Expire deferred retries | See §4.8 |

The `retry_pending` exclusion is the one worth verifying: the cleanup job must never delete a
transaction that is still waiting.

### 4.10 The business rules

Both are inactive. To test:

1. Set `x_335329_secops.enrichment.auto_enabled` to `true`
2. Activate **SecOps Universal - Enrich observable on link to incident**
3. Link an observable to a security incident
4. Confirm a transaction appears — and that it appears **asynchronously**, i.e. the form saves
   immediately rather than waiting for the HTTP call

Then set the property back to `false` with the rule still active, repeat, and confirm **nothing**
happens. Two independent switches is the design; verify both work independently.

### 4.11 Cross-scope access and Restricted Caller Access

SIR runs with Restricted Caller Access. If enrichment silently writes nothing on your instance,
check **System Applications → Application Restricted Caller Access** for a pending entry naming this
application. `SecOpsTargetWriter` degrades gracefully rather than throwing, so an RCA denial looks
like "nothing happened" rather than an error — that is the first place to look.

### 4.12 The Node unit tests

Not on the instance, but they are the fastest signal:

```bash
npm test          # 146 tests
npm run verify    # build + tests
```

They cover JSON/redaction, templating, extraction, mapping, the writer, the REST client, all four
handlers, the work queue, chart geometry, and 21 named regressions from the audit in `BUGS.md`.

---

## Part 5 — The harmless end-to-end self-test

`test/manual/loopback-selftest.js` — paste into **Scripts - Background**, scope
**SecOps Universal Connector Framework**.

### What it does

Creates a temporary connector pointing at **postman-echo.com** and **httpbin.org** — public request
reflectors, no credentials, no side effects — then exercises the whole stack and prints a pass/fail
report.

| # | Check | Proves |
|---|---|---|
| 1 | Health check against `/status/200` | Outbound HTTP, health classification, health recorded |
| 2 | Health check against `/status/500` | `degraded` classification |
| 3 | Containment call to `/post` | Template rendering, transaction logging, redaction |
| 4 | Containment with no target | Validation refuses before any HTTP happens |
| 5 | Containment with a bad target type | Validation rejects unknown enum values |
| 6 | Ingest 3 records | Convention mapping, severity normalisation, staging |
| 7 | Re-ingest the same 3 | De-duplication, `first_seen` preserved |
| 8 | Ingest with an `api_key` | Redaction in `raw_payload` |
| 9 | Ingest a record with no id | Skipped with an error, not staged |
| 10 | Indicator extraction | De-fanging and typing, no network |
| 11 | Template JSON escaping | Injection safety, no network |
| 12 | Back-pressure against `/status/429` | Retry count, `retry_pending`, `next_retry` set |

Every target is either a public echo service or a reserved-for-documentation address
(`192.0.2.0/24`, RFC 5737). Every hostname it invents is prefixed `selftest-`. It touches no real
security data.

### Running it

```
System Definition → Scripts - Background
  Scope: SecOps Universal Connector Framework
  Paste the script → Run script
```

Set `CLEAN_UP = false` at the top if you want to inspect the records afterwards; then run
`test/manual/loopback-cleanup.js` when you are done. With `CLEAN_UP = true` (the default) it removes
everything it created except the transaction log, which is the evidence.

### Reading the result

The last lines are a summary. Anything marked `FAIL` names the check and what it expected. Two
failures are environmental rather than defects, and the script says so:

- **All HTTP checks fail with status 0** — the instance has no outbound internet access. Configure a
  MID Server on the connector, or run only checks 4, 5, 9, 10 and 11 (the no-network ones).
- **Check 12 shows `failed` instead of `retry_pending`** — something between you and httpbin turned
  the 429 into another status. Check the transaction's `http_status`.

---

## Part 6 — Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `SecOpsJson is not defined` | Background script running in global scope | Switch the scope selector to the app |
| `No active endpoint is configured for capability "x"` | Endpoint inactive, or connector inactive | Both records need `active = true` |
| `Connector X is inactive` | Connector not activated | Activate it |
| `Connection & Credential Alias could not be resolved` | No active connection for this domain, or the running user cannot read it | Check the alias has a connection record |
| Request body template produced invalid JSON | A placeholder resolved to something unescapable, or the template itself is malformed | The error names the endpoint; check `request_template` |
| 401 from the third party | Dead credential or grant | The log message names which and what to do — it is not retried on purpose |
| Ingest returns `staged: 0`, `ok: true` | The records array was not found | Set `records_path` |
| Ingest returns 500 | A real defect — a bad payload should be 400 | Check the app logs |
| Staged rows have no CI | No CI matched, or the identifier matched **more than one** | Ambiguous matches are left unresolved deliberately; check the warning log |
| Enrichment writes nothing | TI not installed, or RCA approval pending | §4.11 |
| Promotion always skipped | Property off, or VR not installed | The `errors` array says which |
| Transaction has no request/response | `skipLogging` was set, or the call failed before building the request | Check `error_message` |

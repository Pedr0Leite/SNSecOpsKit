# Use cases

All four handlers extend `SecOpsUniversalPayloadHandler`, so they share the same options and the
same result shape.

**Common options** (every handler): `connector` (sys_id — pin to one tool, otherwise the
lowest-ordered active endpoint wins), `endpoint` (pin an exact endpoint), `secure`
(`false` to write in system context — used by scheduled jobs and inbound REST), `write`
(`false` to skip field mapping), `correlation_id`.

**Common result**: `{ ok, error, status, payload, writes, transaction, endpoint, connector }`.

---

## 1. Threat intelligence enrichment

Enriches an observable across every configured `enrich` endpoint, writes one Threat Lookup Result
[`sn_ti_lookup_result`] per source, and rolls the most severe verdict onto the observable.

```javascript
var result = new SecOpsThreatIntelHandler().enrichObservable(observableSysId, {
    rollup: true,        // default true; copies the worst verdict onto sn_ti_observable.finding
    connector: null,     // null = fan out to every active enrich endpoint
});

// result.finding  → 'Malicious' | 'Suspicious' | 'Clean' | 'Unknown'
// result.results  → [{ endpoint_name, ok, status, finding, lookup_result, transaction, error }]
```

**Verdict derivation**, in order of preference:

1. A mapping row whose `target_field` is `finding`.
2. A verdict-shaped value at `finding`, `verdict`, `disposition`, `classification`, `result` or
   `status` — vendor vocabulary (`malware`, `phishing`, `benign`, `harmless`, …) is normalised.
3. A reputation score at `score`, `risk_score`, `threat_score`, `data.score` or
   `data.attributes.reputation`: `>= 70` Malicious, `>= 40` Suspicious, otherwise Clean.
4. Otherwise **`Unknown`** — never `Clean`.

`rollup` is skipped when the observable has `has_manual_finding_override` set.

### Automatic enrichment

Two async business rules ship **inactive** and are additionally gated by
`x_335329_secops.enrichment.auto_enabled`:

| Rule | Table | Trigger |
|---|---|---|
| Enrich observable on link to incident | `sn_ti_m2m_task_observable` | after insert |
| Re-enrich observable on finding reset | `sn_ti_observable` | after update, `finding` changes to `Unknown` |

Two switches is deliberate — enabling automation that spends a customer's third-party API quota
should not be a side effect of installing an application. The second rule only fires on a reset to
`Unknown` specifically to avoid re-triggering on the framework's own roll-up write.

---

## 2. Phishing response automation

```javascript
var result = new SecOpsPhishingHandler().analyzeIncident(incidentSysId, {
    createObservables: true,   // default true
    maxIndicators: 25,         // default: x_335329_secops.detonate.max_indicators (15)
});

// result.ok          → false if NO indicator could be analysed (outage / not configured)
// result.disposition → worst disposition across all indicators
// result.indicators  → [{ type, value, disposition, observable, transaction, ok, error }]
// result.truncated   → how many indicators were dropped by the cap, if any
```

Pipeline: read `short_description`, `description`, `comments`, `work_notes` (each skipped if absent)
→ extract indicators → send each to the `detonate` endpoint → derive a disposition → optionally
create the observable and attach it to the incident via `sn_ti_m2m_task_observable`.

`comments` and `work_notes` are journal fields, so they are read with `getJournalEntry(-1)` rather
than `getValue()` — work notes are the most common place a reported phish actually lands, and
`getValue()` on a journal field returns nothing.

**`ok` is derived, not assumed.** If no indicator could be analysed — no active `detonate` endpoint,
or the sandbox is unreachable — `ok` is `false` and `error` is populated. "Analysed, nothing
malicious" and "the integration is down" must not look alike to a caller.

**Verdicts are monotonic.** On an observable that already exists, the disposition goes through the
guarded roll-up: it will not overwrite a manual analyst decision, and it will not *lower* an
existing verdict. A failed detonation yields `Unknown`, and `Unknown` must never erase a
`Malicious`.

Each indicator costs one synchronous outbound call, hence the small default cap. Call
`analyzeIncident` from an async or scheduled context, not from a UI action on a busy form.

**Indicator types** are the verbatim `sn_ti_observable_type` names — `URL`, `MD5 hash`,
`SHA1 hash`, `SHA256 hash`, `IP address (V4)`, `Domain name`, `Email address`. Do not "tidy" the
casing; these are looked up as reference values.

Extraction handles defanged notation (`hxxp://`, `1.1.1[.]1`, `[at]`), rejects invalid dotted quads
(`999.999.999.999`, zero-padded `01.1.1.1`), and will not report the same host twice under two
different types.

---

## 3. Vulnerability telemetry ingestion

Push (a scanner calls ServiceNow):

```bash
curl -X POST -u "$USER:$PASS" -H 'Content-Type: application/json' \
  --data '{"results":[{"id":"V-1","cve":"CVE-2026-0001","severity":"high","host":"web01"}]}' \
  "https://<instance>.service-now.com/api/x_335329_secops/secops_connector/vulnerability?source=AcmeScanner"

# 201 {"result":{"ok":true,"staged":1,"skipped":0,"errors":[],"promoted":null}}
```

Query parameters: `source` (required), `records_path` (dotted path to the array), `promote`
(`true` to attempt VR promotion immediately).

Pull (ServiceNow calls the scanner):

```javascript
var result = new SecOpsVulnIngestionHandler().pull({
    connector: connectorSysId,
    source: 'AcmeScanner',
    recordsPath: 'data.findings',
    promote: false,
});
```

Records are de-duplicated on `source` + `external_id`, so re-posting the same feed updates rather
than duplicates. Envelope shapes `records`, `results`, `items`, `data`, `vulnerabilities` and
`findings` are unwrapped automatically; a bare object is treated as a single record. With no mapping
rules the framework maps by convention (`id`/`vuln_id`/`qid`, `cve`, `title`/`name`/`summary`,
`severity`, `cvss_score`, `host`/`asset`/`ip_address`/`fqdn`). CI matching resolves
`ci_identifier` against `cmdb_ci` by name then IP, and only accepts an unambiguous single match.

Promotion into Vulnerability Response is a separate, guarded step — see
[07-vulnerability-response.md](07-vulnerability-response.md).

---

## 4. Containment orchestration

```javascript
var result = new SecOpsContainmentHandler().contain({
    target_type: 'host',        // host | ip | user | url | hash | account
    target_value: 'WKSTN-0042',
    action: 'isolate',          // isolate | release | block | unblock
    reason: 'Confirmed ransomware beacon',
    incident: incidentSysId,    // optional, links the transaction to the incident
});
```

A request without a target value or a recognised target type is **refused before any HTTP call** —
an empty parameter reaching an EDR isolate API is how the wrong machine gets taken offline. Every
request is logged with `requested_by` and `reason`.

The template context exposes `${target_type}`, `${target_value}`, `${target}`, `${action}`,
`${reason}`, `${incident}` and `${requested_by}`.

---

## Adding a new capability

```javascript
var SecOpsMyHandler = Class.create();

SecOpsMyHandler.prototype = Object.extendsObject(SecOpsUniversalPayloadHandler, {
    initialize: function () {
        SecOpsUniversalPayloadHandler.prototype.initialize.call(this, 'SecOpsMyHandler');
    },

    CAPABILITY: 'custom',
    DEFAULT_TARGET_TABLE: 'sn_si_incident',

    onSuccess: function (response, context, options) {
        // optional hook
    },

    type: 'SecOpsMyHandler',
});
```

Then add a `ScriptInclude` record in `src/fluent/script-includes/handlers.now.ts` and, if the
capability needs its own choice value, extend the `capability` choice list on
`x_335329_secops_endpoints`. Do not re-implement transport, retry, logging or mapping.

# SecOps Universal Connector Framework

Universal, extensible middleware between ServiceNow Security Operations and **any** third-party
security tool — SIEM, EDR/XDR, threat intelligence, SOAR, vulnerability scanner or malware sandbox.

Onboarding a new vendor is **configuration, not code**: create a connector, add endpoints, add
field mappings. The handlers, transport, retry policy, credential resolution, redaction and audit
trail are already built.

| | |
|---|---|
| **Scope** | `x_335329_secops` |
| **Application** | SecOps Universal Connector Framework |
| **Built with** | ServiceNow SDK (Fluent) 4.12.1 |
| **Verified on** | dev296062.service-now.com — installed, REST ingestion smoke-tested end to end |
| **Tests** | 144 (`npm test`), including 21 regression tests for the audit findings in [BUGS.md](BUGS.md) |
| **Audited** | 21 findings from an independent code audit, all fixed and mutation-tested — see [BUGS.md](BUGS.md) |

> **Scope naming — read before Store submission.** The specified scope was `x_snc_secops_uni`, but a
> ServiceNow instance only accepts applications carrying **its own** vendor prefix, and this
> instance's prefix is `x_335329_`. A real Store submission must use *your publisher-assigned*
> vendor prefix, which means renaming the scope once more. Renaming changes every table, role and
> property name, so do it before you accumulate customer data. See
> [docs/06-store-certification.md](docs/06-store-certification.md).

## What this is, in one picture

Think of a **universal travel adapter with a built-in voltage converter**.

Every country has a different plug and a different voltage. You *could* buy a separate adapter per
country — that is the usual ServiceNow approach: one bespoke integration per security tool, each
with its own retry logic, its own credential handling, its own logging.

This application is the single adapter. The **plug shape** is configuration (a Connector record).
The **voltage conversion** is configuration (Field Mapping records). The wire in the middle —
retries, credentials, redaction, audit — is built once and shared by everything.

```
   CONFIGURATION (what an admin fills in)
   ┌──────────────┐      ┌──────────────┐      ┌──────────────┐
   │  Connector   │─1:N─▶│   Endpoint   │─1:N─▶│ Field Mapping│
   │              │      │              │      │              │
   │ the SYSTEM   │      │ one CALLABLE │      │ response path│
   │ base URL     │      │ OPERATION    │      │      ↓       │
   │ credential   │      │ capability   │      │ SN field     │
   │ alias        │      │ method/path  │      │              │
   │ MID server   │      │ body template│      │              │
   └──────────────┘      └──────────────┘      └──────────────┘
                                │
                       capability picks the handler
                                ▼
   BEHAVIOUR (what the app does)
   ┌─────────┬──────────┬─────────┬──────────┬────────┐
   │ enrich  │ detonate │ contain │  ingest  │ health │
   └─────────┴──────────┴─────────┴──────────┴────────┘
                                │
   PLUMBING (built once, shared by all)                │
   ┌────────────────────────────────────────────────── ▼ ──────┐
   │ credential resolution · retry · redaction · audit trail    │
   └────────────────────────────────────────────────────────────┘
                                │
   OUTPUT                       ▼
   ┌───────────────────┬──────────────────┬────────────────────┐
   │ SIR / Threat Intel│ Vuln staging     │ Transaction log    │
   │ (observables,     │ (own table,      │ (redacted, every   │
   │  lookup results)  │  opt-in to VR)   │  call)             │
   └───────────────────┴──────────────────┴────────────────────┘
```

## Capabilities

| Capability | Handler | What it does |
|---|---|---|
| `enrich` | `SecOpsThreatIntelHandler` | Enriches a Threat Intelligence observable; writes a Threat Lookup Result per source and rolls the verdict up onto the observable. |
| `detonate` | `SecOpsPhishingHandler` | Harvests indicators from a Security Incident, sends each to a sandbox, returns a disposition, optionally creates observables and attaches them to the incident. |
| `ingest` | `SecOpsVulnIngestionHandler` | Stages third-party vulnerability telemetry; optional, guarded promotion into Vulnerability Response. |
| `contain` | `SecOpsContainmentHandler` | Requests endpoint isolation or a network block from an EDR/firewall. |
| `health` | `SecOpsHealthChecker` | Reachability probe; drives the console and the hourly health sweep. |

Plus two React + TypeScript UI Pages sharing one component library, with light/dark/Matrix themes:

| Page | URL | For |
|---|---|---|
| **Analyst console** | `/x_335329_secops_analyst_console.do` | Unified work queue (SIR incidents, SIR tasks, findings), inline record pane with editing, and a personal metrics tab |
| **Security overview** | `/x_335329_secops_security_overview.do` | Organisation-wide posture, findings by source and asset, and integration health — the question only this app can answer |

See [docs/08-analyst-console.md](docs/08-analyst-console.md).

### The five capabilities in detail

**1. Threat intel enrichment (`enrich`)**
Give it an observable sys_id. It fans out to *every* configured intel source, writes one Threat
Lookup Result per source, and rolls the worst verdict onto the observable. Vendor vocabulary is
normalised (`malware`, `benign`, `harmless` → platform choices). If a response cannot be
understood, the verdict is `Unknown` — **never** `Clean`.

**2. Phishing response (`detonate`)**
Give it a Security Incident. It scrapes URLs, hashes, IPs, domains and addresses out of the
description *and the work notes*, including defanged ones (`hxxp://`, `1.1.1[.]1`), sends each to a
sandbox, and returns a disposition. It can create the observables and attach them to the incident,
turning a reported phish into reusable intel.

**3. Containment (`contain`)**
Isolate a host, block an IP, disable an account — through whatever EDR or firewall you configure.
Validates hard before calling: a request that cannot name its target is refused, not sent with an
empty parameter.

**4. Vulnerability ingestion (`ingest`)**
Scanners push to a REST endpoint, or the app pulls on a schedule. Data lands in the application's
**own staging table** first, de-duplicated on source + external ID and CI-matched against the CMDB.
Promotion into Vulnerability Response is a separate, opt-in step.

**5. Health (`health`)**
Hourly sweep plus an on-demand **Test** button in the Service Portal console, so a credential that
expired overnight surfaces before an analyst hits it mid-investigation.

## Walking through one call

A business rule fires: *enrich observable `8.8.8.8`.*

```
1. Registry     "which endpoint handles 'enrich'?"
                → lowest-ordered ACTIVE endpoint on an ACTIVE connector
                  (one dot-walked query, not one query per endpoint)

2. RestClient   build the request
                ├─ credentials: resolved NOW from the Connection &
                │  Credential Alias. Never stored by this app.
                ├─ body: {"indicator":"${ioc}"} → {"indicator":"8.8.8.8"}
                │  ...with the value JSON-escaped, so a quote in an
                │  indicator cannot inject extra keys
                └─ Content-Type set explicitly

3. Transaction  open a PENDING audit row — request body redacted first

4. HTTP         send. On 500/timeout → retry (bounded).
                On 429/503 → park as retry_pending, do not hammer them.
                On 401 → log which credential died and how to fix it.

5. Map          response → Threat Lookup Result, using the Field Mapping
                rows. Defaults supplied, admin mappings override them.

6. Write        TargetWriter checks the table exists, checks each field
                exists, checks permission — then writes.

7. Roll up      worst verdict → observable.finding, but ONLY if it
                raises the verdict and there is no analyst override

8. Transaction  close it: success/failed, status, duration, redacted
                response
```

## Walking through a phishing analysis

`enrich` handles one indicator. `detonate` handles a whole incident, and chains three subsystems to
do it — so it is worth its own walkthrough.

Think of a **mailroom X-ray desk**. Someone forwards a suspicious envelope. The operator reads the
whole report *including the sticky notes attached to it*, highlights every identifier on it, sends
each one to the lab, files an evidence card per item, staples the cards to the case file, and
reports the worst single result rather than an average. That is the handler, in order.

```
                       sn_si_incident
                             │
     ┌───────────────────────┴────────────────────────┐
     │ collectText()                                  │
     │   short_description ─┐                         │
     │   description       ─┴─ getValue()             │
     │   comments          ─┐                         │
     │   work_notes        ─┴─ getJournalEntry(-1)    │
     └───────────────────────┬────────────────────────┘
                             │  one joined string
                             ▼
     ┌────────────────────────────────────────────────┐
     │ SecOpsIndicatorExtractor.extract()             │
     │   re-fang:  hxxps://  → https://               │
     │             1.1.1[.]1 → 1.1.1.1                │
     │             name[at]x → name@x                 │
     │   match in order, de-duplicating as it goes:   │
     │   SHA256 ▸ SHA1 ▸ MD5 ▸ URL ▸ email ▸ IP ▸ domain
     └───────────────────────┬────────────────────────┘
                             │  [{type, value}, …]
                             ▼
              cap at detonate.max_indicators (15)
                             │
   ╔═════════════════════════▼══════════════════════════╗
   ║  per indicator — processIndicator()                ║
   ║                                                    ║
   ║   run({ioc, value, type, incident}, write:false)   ║
   ║        └─▶ SecOpsRestClient ─▶ sandbox ─▶ payload  ║
   ║                                     │              ║
   ║   intel.findingFrom(payload) ◀──────┘              ║
   ║        │   Malicious │ Suspicious │ Clean │ Unknown║
   ║        ▼                                           ║
   ║   upsertObservable()          sn_ti_observable     ║
   ║     coalesce on value+type                         ║
   ║     finding written on INSERT ONLY                 ║
   ║        │                                           ║
   ║        └─ already existed? ─▶ intel.rollUpFinding()║
   ║        ▼                                           ║
   ║   linkObservableToIncident()                       ║
   ║                        sn_ti_m2m_task_observable   ║
   ╚═════════════════════════╤══════════════════════════╝
                             ▼
                    worstDisposition()  ─▶  outcome
```

**Why the journal fields get different treatment.** `comments` and `work_notes` store their content
in `sys_journal_field`, so `getValue()` returns the empty journal *input*, not the entries. A
forwarded phish usually arrives *as a comment* — reading these with `getValue()` would silently drop
the most common place the evidence lives, and the handler would report success having found nothing.

**Why extraction order matters.** Longest hashes first, because a 64-character hex string contains
32-character substrings. Domains are matched last, against text with URLs and emails already
stripped out, so one string is never reported twice under two types. The IPv4 check rejects octets
above 255 and zero-padded forms like `01.1.1.1`, but deliberately accepts `1.2.3.4` — that is a
valid dotted quad, and deciding it is "probably a version string" would be the wrong kind of clever.

**Why the cap is small and has its own property.** Each indicator is one *synchronous* outbound
call. A report pasted with a full header block can yield fifty; fifty sequential HTTP calls in one
transaction is how you exhaust the quota and leave an incident half-processed. When it truncates it
sets `outcome.truncated` rather than staying quiet.

**Why the verdict is insert-only.** Re-analysing the same phish coalesces onto the existing
observable. Writing `finding` unconditionally would be a bug in two directions: a failed detonation
returns `Unknown`, which would erase a previous `Malicious`, and it would ignore an analyst's manual
override. Existing observables route through `rollUpFinding()` instead, which refuses both.

### The gotcha

**Field mappings on a `detonate` endpoint do nothing — unless `target_field` is `finding`.**

`processIndicator` calls the base handler with `write: false`, because the handler writes the
observable itself. That skips `mapAndWrite()` entirely. The only place mappings are consulted is
inside `findingFrom()`, which scans them for one targeting `finding` and ignores every other row.

So mapping `sandbox_verdict → finding` works exactly as expected, and mapping anything else on the
same endpoint is configured, saved, executed — and silently does nothing. This differs from an
`enrich` endpoint, where non-`finding` mappings *do* override the default value set. Same-looking
configuration table, different behaviour per capability.

Two smaller ones for callers:

- **`ok: true` with zero indicators is a real outcome.** Nothing was analysed, but nothing failed.
  `disposition` stays `Unknown`. Check `indicators.length`, not just `ok`.
- **`ok` means "at least one indicator was analysed"**, not all of them. Read
  `outcome.indicators[].ok` for per-indicator truth.

## What it deliberately will not do

These are design decisions, not gaps. Each one exists because the alternative fails badly in a
security context.

- **It will not erase a verdict.** A sandbox outage returns `Unknown`, and `Unknown` must never
  overwrite a known `Malicious`. Verdicts are monotonic: automation can raise a finding, never lower
  it, and never overrides an analyst's manual decision.
- **It will not call `sn_vul_vulnerability`.** That table is *Remediation Tasks*, not
  vulnerabilities — a very common mistake. The real targets are `sn_vul_third_party_entry` and
  `sn_vul_vulnerable_item`. See [docs/07-vulnerability-response.md](docs/07-vulnerability-response.md).
- **It will not write straight into Vulnerability Response.** VR is a separate subscription.
  Staging first means the app installs anywhere, a bad feed is reversible, and Store review gets the
  staging pattern it expects.
- **It will not store a secret.** Not in a table, not in a system property, not in a log.
  Credentials live in Connection & Credential Aliases and are resolved per call; every logged
  payload is redacted, and redaction fails *closed* at its recursion limit.
- **It will not report success when the records were refused.** A 200 from the third party whose
  mapped writes were blocked by an ACL or Restricted Caller Access reports `ok: false` with the
  reason.
- **It will not retry a dead OAuth grant.** It names the credential that expired and where to
  re-authorise it. Blind retries on a dead grant lock service accounts out.
- **It will not sleep between retries** — scoped applications have no `gs.sleep()`. Transient
  failures retry immediately; rate-limited ones are parked for a scheduled job rather than
  busy-waiting on a worker thread.

## Current status — read this before demoing

**This is a framework, not a finished integration.** It ships with five working capabilities and a
sample configuration, but **zero real vendors wired up** — that is the administrator's job, and
doing it requires no code.

| Path | Status |
|---|---|
| Vulnerability ingestion (REST push) | **Proven end to end** on a live instance |
| Connector health | **Proven end to end** on a live instance |
| Threat intel enrichment | Unit-tested; never called a real third-party API |
| Phishing detonation | Unit-tested; never called a real sandbox |
| Containment | Unit-tested; never called a real EDR |
| VR promotion | Unit-tested both ways; never run against real `sn_vul` tables (VR is not installed on the verified instance) |

## Quick start

```bash
npm install
npm run build      # compile + validate Fluent sources
npm test           # 119 unit tests, no instance needed
npm run verify     # build + test in one step
npm run deploy     # install onto the authenticated instance
```

Then, on the instance:

1. Create a **Connection & Credential Alias** for your third-party tool
   (*Connections & Credentials > Connection & Credential Aliases*).
2. **SecOps Universal Connector > Connectors** — create a connector, select that alias, set the
   base URL, activate it.
3. **Endpoints** — add one endpoint per operation (capability, method, path, request template).
4. **Field mappings** — map response paths onto ServiceNow fields.
5. Drop the **SecOps Connector Console** widget on a Service Portal page to watch it work.

Full walkthrough: [docs/04-install-and-config.md](docs/04-install-and-config.md).

## Documentation

| Document | Contents |
|---|---|
| [01-architecture.md](docs/01-architecture.md) | Layers, data model, request lifecycle, design decisions and their rationale |
| [02-use-cases.md](docs/02-use-cases.md) | The four use cases, with the exact API calls |
| [03-flow-designer-actions.md](docs/03-flow-designer-actions.md) | Reusable Flow Designer action setup + script step logic |
| [04-install-and-config.md](docs/04-install-and-config.md) | Installation, credentials, Restricted Caller Access, configuration reference |
| [05-xml-blueprint.md](docs/05-xml-blueprint.md) | Table and cross-scope privilege XML blueprint |
| [06-store-certification.md](docs/06-store-certification.md) | Certification checklist, what is done, what the publisher must still do |
| [07-vulnerability-response.md](docs/07-vulnerability-response.md) | VR ingestion and promotion, including a correction to a common table-name mistake |
| [08-analyst-console.md](docs/08-analyst-console.md) | The React UI Page console: hosting choice, data paths, record pane, drill-in, editable layout, themes, accessibility |
| [09-testing-guide.md](docs/09-testing-guide.md) | **Start here to test anything.** Full capability inventory, Postman payloads for every inbound API, the external tools you can connect and how, and step-by-step tests for the internals |
| [10-knowledge-base.md](docs/10-knowledge-base.md) | **Start here if the security concepts are new.** What an indicator is, what detonation actually means and who does it, why indicators are written `hxxp://`, which addresses are safe in test data, and why automation may raise a verdict but never lower one |

Testing assets that go with `09`:

| Path | What it is |
|---|---|
| [test/postman/](test/postman/) | 30-request Postman collection with assertions, plus an environment template. Creates a credential-free loopback connector, exercises the whole inbound surface, and tears itself down. |
| [test/manual/loopback-selftest.js](test/manual/loopback-selftest.js) | Background script: 15 checks against public echo services. No credentials, no real security data, no third-party account. |
| [test/manual/loopback-cleanup.js](test/manual/loopback-cleanup.js) | Removes what the self-test creates. |
| [docs/test-bench.html](docs/test-bench.html) | The same reference as a single self-contained page: copy buttons on every payload, one instance field that rewrites every URL, and a filterable vendor matrix. Download it and open it in any browser — no server, no account, no build step. |

> `docs/test-bench.html` is deliberately in `docs/`, which is one of the two folders GitHub Pages
> can serve from. Turning Pages on (Settings → Pages → Deploy from branch → `main` / `/docs`)
> publishes it at `https://pedr0leite.github.io/SNSecOpsKit/test-bench.html` with no other changes.
> It stays a plain file until you do — nothing depends on Pages being enabled.

## Project layout

```
src/
  fluent/              # Fluent (TypeScript) metadata definitions
    tables/            #   5 tables
    security/          #   roles, ACLs, cross-scope privileges
    script-includes/   #   script include records
    business-rules/    #   async enrichment triggers (inactive by default)
    rest/              #   Scripted REST API
    jobs/              #   scheduled jobs
    ui/                #   console widget, application menu + modules
    properties.now.ts  #   runtime configuration
    demo-data.now.ts   #   sample connector/endpoint/mappings (demo install only)
  script-includes/     # 16 ES5 Class.create() script includes — the logic
  business-rules/      # business rule bodies
  rest/                # Scripted REST route bodies
  jobs/                # scheduled job bodies
  widget/              # Service Portal widget (html/client/server/scss)
test/                  # 119 Node unit tests + platform double
  harness.js           #   emulates Class.create, GlideRecord, sn_ws, sn_cc, gs...
  regressions.test.js  #   one test per finding in BUGS.md
```

> **A note on the test double.** `test/harness.js` is deliberately kept no more capable than the
> real platform. An earlier version invented `ConnectionInfo.getConnectionUrl()`, and because the
> production code called that non-existent method, the whole suite passed over a bug that broke
> every alias-authenticated connector. A double that is more convenient than the API it stands in
> for is worse than no double at all.

## Security posture

- **No credential is ever stored by this application.** Secrets live in Connection & Credential
  Aliases and are resolved per call via `sn_cc.ConnectionInfoProvider`. System properties hold only
  non-sensitive tuning.
- **Every logged payload is redacted.** Request and response bodies pass through
  `SecOpsJson.redact` before reaching the transaction table or the system log — verified by test
  and by live smoke test.
- **No `eval`.** The template and JSON-path engines are pure string/structure operations, because
  third-party payloads are untrusted input.
- **Every custom table, the client-callable script include and the REST endpoint carry ACLs.**
- **Writes into SecOps tables are schema- and permission-checked** and degrade to a reported skip,
  so a SecOps upgrade or a denied Restricted Caller Access grant cannot take the integration down.

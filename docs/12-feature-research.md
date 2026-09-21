# Feature research — where this framework should go next

**Date:** 2026-09-21. **Method:** read the shipped code and docs, then researched what ServiceNow's
own Security Operations module offers and what the market and the SecOps community are asking for.

This document is deliberately opinionated. It says what to build, in what order, and — for each
item — where in *this* codebase it lands. It does not commit to any of it; it exists so the
decision can be made with the evidence in front of you.

---

## Part 1 — What the application does today

Five runtime capabilities, one scheduled job, two UI pages, on top of a config-driven transport.

| Capability | Handler | Aligns to a native SecOps concept? |
|---|---|---|
| `enrich` | `SecOpsThreatIntelHandler` | **Yes** — Observable Enrichment / Threat Lookup |
| `detonate` | `SecOpsPhishingHandler` | **Partly** — sandbox detonation is a SecOps pattern, but native SIR reaches it via Email Analysis, which this app does not implement |
| `contain` | `SecOpsContainmentHandler` | **Yes** — Response tasks / host isolation |
| `ingest` | `SecOpsVulnIngestionHandler` | **Yes** — third-party vulnerability entries, staged |
| `health` | `SecOpsHealthChecker` | No native equivalent — this is a genuine differentiator |
| `SecOpsCveWatch` (scheduled) | — | No native equivalent — differentiator |

The transport layer underneath — credential resolution via `sn_cc`, bounded retry, 429/503 parking,
redaction that fails closed, a transaction row per call, schema- and ACL-checked writes — is the
real asset. **Every recommendation below is a new capability on that existing spine, not a new
spine.**

### The structural gap

The framework's capability vocabulary is `enrich | detonate | contain | ingest | health | custom`
(`src/fluent/tables/endpoints.now.ts:33`). ServiceNow's own **Security Operations Integration
Framework** — the contract that every certified vendor integration in the Store implements —
publishes a *different and larger* vocabulary, persisted in
`sn_sec_cmn_integration_capability` with vendor implementations in
`sn_sec_cmn_integration_capability_implementation`:

- Threat Lookup
- Observable Enrichment
- **Sightings Search**
- **Block / unblock indicator (detection lists)**
- **Event search / past-incident observable search**
- Get Email (Email Analysis)
- Endpoint & network containment

Two of those — **Sightings Search** and **block indicator** — are the ones customers name first and
this app has no answer for. That is the single largest alignment gap, and it is also the cheapest
to close, because both are just another handler on the same `run()` spine.

---

## Part 2 — What the market is asking for

### 2.1 ServiceNow's own direction (this is the alignment constraint)

- **Autonomous Security**, announced 2026, organises the portfolio into six areas — agentic
  incident response, unified exposure management, continuous vulnerability detection, cyber risk
  and compliance, identity security, cyber-physical. A **Tier 2 SOC AI Specialist** that builds and
  executes multi-phase response plans is slated for **December 2026**.
  ([newsroom](https://newsroom.servicenow.com/press-releases/details/2026/ServiceNow-delivers-Autonomous-Security-the-industrys-most-complete-security-offering/default.aspx),
  [Help Net Security](https://www.helpnetsecurity.com/2026/08/04/servicenow-ai-specialists/))
- **AI-Powered Integration Builder went GA in Q1 2026** — point an LLM at a vendor's API docs and
  it generates the integration logic, action steps and observable mappings.
  ([community](https://www.servicenow.com/community/secops-articles/revolutionizing-security-integration-introducing-the-llm-powered/ta-p/3416418))
- **MITRE D3FEND** now surfaces recommended defensive techniques against a mapped ATT&CK technique,
  inside the SIR workspace. ATT&CK association is via `sn_ti_stix2_m2m_incident_attack`.
- **Q1 2026 SIR quality-of-life:** bulk-link many incidents to a parent (campaign handling),
  read-only external sharing of an incident, multi-select quick filters on the SOC queue.
- **TISC** (Threat Intelligence Security Center) gained confidence levels, tags, notes and a
  default TLP when pushing observables from the SIR workspace.

**The Integration Builder is the strategic threat to this application.** It attacks exactly the
value proposition in the README — "onboarding a vendor is configuration, not code". The honest
response is not to race it; it is to lean into the three things it does not do: *auditability of
every call*, *health and credential-expiry surveillance*, and *capabilities the native framework
does not ship*.

### 2.2 What SOC teams say they lack

- Analysts, especially juniors, burn time researching the right response steps across playbooks and
  KB articles — the pain that the Gen AI "Recommended Actions" and "Post-Incident Analysis"
  features were built to answer.
- ESG research cited by ServiceNow: **70%** find SOC hiring hard; the top two priorities are
  *integrating security and IT tools* and *improving security/IT collaboration*.
- Generic SOAR expectations for 2026: STIX 2.1 / TAXII 2.1 support, ATT&CK mapping of detections,
  enrichment-plus-prioritisation, and **retraction of expired indicators from wherever they were
  deployed** — that last one is a capability almost nobody implements and everybody wants.

---

## Part 3 — Recommendations, ranked

Each is scored on *demand*, *alignment with the native SecOps module*, and *cost here*.

### Tier 1 — build these

#### 1. `sightings` capability — Sightings Search
**Demand: high · Alignment: exact · Cost: low**

"Has this indicator been seen anywhere else in my estate?" is the question an analyst asks
immediately after a verdict comes back, and it is a first-class capability in the native
integration framework (MISP, Chronicle, Cisco, Splunk all implement it).

Implementation: a `SecOpsSightingsHandler` mirroring `SecOpsThreatIntelHandler`. Take an observable
or a raw indicator, fan out to every active `sightings` endpoint (typically a SIEM query), and write
one sighting row per hit — host, user, timestamp, source. Stage into the app's own table first, the
same way `ingest` stages vulnerabilities, so the app still installs without the SecOps
subscription; optionally link results onto `sn_si_incident` where present.

Touches: new `src/script-includes/secops-sightings-handler.js`, a `sightings_stage` table, one
choice on the endpoint capability list, one cross-scope privilege.

#### 2. `block` / `unblock` capability — indicator deployment with retraction
**Demand: high · Alignment: exact · Cost: low-medium**

Push an IoC to a firewall blocklist, an EDR detection list or a proxy category — and, critically,
**track where each indicator was deployed and retract it when it expires or is downgraded**.

The retraction half is the differentiator. Every SOAR pushes blocks; very few keep a ledger and
pull them back, and stale blocks are a real operational cost (an IP recycled to a legitimate
service that nobody can reach for eight months). The app already has the two pieces needed: a
transaction ledger, and a verdict model that is explicitly monotonic. A `deployment` table keyed on
indicator + connector + external ID, plus a scheduled sweep, closes the loop.

Reuses `SecOpsContainmentHandler`'s validation discipline — refuse a request that cannot name its
target rather than send an empty parameter.

#### 3. MITRE ATT&CK technique extraction and mapping
**Demand: high · Alignment: exact · Cost: low**

Vendors put technique IDs in their payloads (`T1078`, `TA0005`) and almost nobody maps them.
Extend `SecOpsIndicatorExtractor` with a technique pattern — it already does ordered, de-duplicating
extraction over incident text and journal fields, so this is one more matcher — and add a field
mapping target that writes `sn_ti_stix2_m2m_incident_attack`.

Pairs directly with the D3FEND work ServiceNow shipped in Q1 2026: once the technique is mapped,
the platform supplies the recommended countermeasure for free. Strictly additive, and it makes the
app visibly current with the module's own direction.

#### 4. Email Analysis / `get_email` capability
**Demand: high · Alignment: exact · Cost: medium**

Native SIR's phishing path starts by parsing an attached `.eml` against email matching rules, then
submitting the extracted observables. This app's `detonate` handler starts *after* that, from the
incident's text. That means the most common real-world phishing intake — a forwarded message as an
attachment — is the one input it handles worst, because the indicators live in the attachment, not
the description.

Add `.eml`/`.msg` parsing over `sys_attachment`: headers (`Received`, `Return-Path`, SPF/DKIM/DMARC
results), body, and attachment hashes, feeding the existing extractor. This is the highest-value
item in Tier 1 for an analyst, and the most work — MIME parsing in ES5 with no libraries, and
attachment reads need their own cross-scope privilege.

### Tier 2 — strong, but bigger or more speculative

#### 5. OpenAPI / API-doc connector generator
**Demand: high · Alignment: competitive with native · Cost: medium**

The direct answer to the Integration Builder, scoped to what is defensible: ingest an OpenAPI 3
document and generate draft Connector + Endpoint + Field Mapping records — deterministic, no LLM,
no data leaving the instance. For teams that cannot send API documentation to a hosted model (and
in security organisations that is many), a local, auditable generator is the *preferable* option,
not the consolation prize.

Start with OpenAPI only. Pattern-match paths and response schemas onto the capability vocabulary;
generate everything inactive and require a human to activate it.

#### 6. STIX 2.1 / TAXII 2.1 client
**Demand: medium-high · Alignment: good · Cost: medium**

A `taxii` capability that polls a TAXII 2.1 collection and stages STIX bundles into observables.
Standards-based, so one implementation covers MISP, OpenCTI, CISA AIS, ISAC feeds and most
commercial providers — a much better return per line of code than another bespoke connector.
Bounded scope: consume `indicator`, `malware`, `threat-actor` and `relationship` objects; ignore
the rest of the STIX vocabulary rather than half-implementing it.

#### 7. Correlation and campaign linking
**Demand: high · Alignment: exact · Cost: medium**

ServiceNow shipped bulk parent-linking in Q1 2026 precisely because campaign handling was manual.
The app is uniquely placed to *suggest* the links: it already sees every observable across every
incident. A scheduled correlator that finds incidents sharing observables within a window, scores
the overlap, and proposes a parent would feed straight into the native bulk-link action.

Suggest, never link automatically. An automatic merge that is wrong buries a real incident inside
someone else's campaign.

#### 8. Operational analytics on the transaction log
**Demand: medium · Alignment: neutral · Cost: low**

The transaction table already holds latency, status and outcome for every call. The overview page
shows health but not *performance*. Per-connector p50/p95 latency, error-rate trend, quota
consumption, and a credential-expiry forecast from 401 patterns are nearly free — the data is
already there, and it is the kind of thing that makes an integration platform trustworthy rather
than merely functional.

Extends `src/rest/console-overview.js` and `src/client/components/charts/`.

### Tier 3 — watch, do not build yet

- **Agentic response plans.** The Tier 2 SOC AI Specialist lands December 2026. Building a
  competing agent now means competing with the platform vendor on their own roadmap. The useful
  move is to make this app's capabilities *callable by* that agent — clean, well-described Flow
  Designer actions and a stable API surface — so it is a tool the agent uses, not a rival.
- **Cloud-native containment** (AWS/Azure/GCP quarantine actions). Real demand, but it is a set of
  connector configurations, not framework code. It belongs in a content pack once a real cloud API
  has been exercised.
- **Identity containment** (disable user, force re-auth, revoke sessions). Fits the `contain`
  handler with no framework change — again a content pack, and one that needs very careful
  validation before it ships.

---

## Part 4 — Recommended sequence

**Do first, together:** Sightings Search + block/unblock with retraction. They close the alignment
gap against the native integration framework, share a staging-table pattern the app already has,
and both are low-risk additions to a handler spine that is already tested.

**Do second:** ATT&CK extraction (cheap, current, rides the D3FEND work) and transaction analytics
(nearly free, and it strengthens the audit story that is this app's defence against the Integration
Builder).

**Then decide, with a real user in the room:** Email Analysis versus the OpenAPI generator. They
serve different buyers — Email Analysis serves the analyst, the generator serves the admin — and
doing both at once would be the point where this stops being a framework and starts being a
product with two personalities.

### Before any of it

The blockers in [NEXT-STEPS.md](../NEXT-STEPS.md) do not get cheaper by waiting. Three of the five
existing capabilities have **never called a real third-party API**. The first real connector will
surface auth and payload-shape issues no mock predicts, and every recommendation above inherits
that risk. Wiring one real vendor end to end is worth more than any feature in this document.

---

## Sources

- [Key Features Released in Q1 2026 for Security Incident Response](https://www.servicenow.com/community/secops-articles/key-features-released-in-q1-2026-for-security-incident-response/ta-p/3518413)
- [Revolutionizing Security Integration: the LLM-Powered SIR Integration Builder](https://www.servicenow.com/community/secops-articles/revolutionizing-security-integration-introducing-the-llm-powered/ta-p/3416418)
- [ServiceNow delivers Autonomous Security](https://newsroom.servicenow.com/press-releases/details/2026/ServiceNow-delivers-Autonomous-Security-the-industrys-most-complete-security-offering/default.aspx)
- [ServiceNow organizes autonomous security around six solution areas — Help Net Security](https://www.helpnetsecurity.com/2026/08/04/servicenow-ai-specialists/)
- [Security Operations Integration — Sightings Search capability](https://www.servicenow.com/docs/bundle/xanadu-security-management/page/product/security-operations-common/concept/sightings-search-capability.html)
- [MITRE ATT&CK framework overview — ServiceNow docs](https://www.servicenow.com/docs/r/security-management/about-mitre-attack.html)
- [An introduction to the ServiceNow SecOps and MITRE ATT&CK framework integration](https://www.servicenow.com/community/secops-articles/an-introduction-to-the-servicenow-secops-and-mitre-att-ck-framework-integration/ta-p/2316736)
- [Threat Intelligence Security Center (TISC) Feature Updates](https://www.servicenow.com/community/secops-blog/threat-intelligence-security-center-tisc-feature-updates-august/ba-p/3454272)
- [MISP integration for Security Operations — ServiceNow Store](https://store.servicenow.com/store/app/f53a6fe21b246a50a85b16db234bcbbb)
- [Revolutionizing Security Incident Management: November Gen AI Capabilities](https://www.servicenow.com/community/secops-articles/revolutionizing-security-incident-management-introducing/ta-p/3098002)
- [Security Operations Use Case Guide (PDF)](https://www.servicenow.com/content/dam/servicenow-assets/public/en-us/doc-type/resource-center/white-paper/security-operations-use-case-guide.pdf)
- [Best SOAR Solutions: Top 6 Options in 2026 — Exabeam](https://www.exabeam.com/explainers/soar/best-soar-solutions-top-5-options/)
- [What Is STIX/TAXII? — VMRay](https://www.vmray.com/stix-taxii-threat-intelligence/)

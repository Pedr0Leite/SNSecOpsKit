# Vendor walkthroughs — wiring a real API in ten minutes each

Minimal steps per vendor: sign up, get a key, create two records, run one test. For the full
configuration reference see [04-install-and-config.md](04-install-and-config.md); for the vendor
matrix and the free-tier terms see [09-testing-guide.md](09-testing-guide.md) §3.2 and §3.4.

🔎 Paths and header names change. Check the vendor's current docs before blaming your config.

---

## Read this first — the custom-header problem

`SecOpsRestClient` injects an alias-held key as **`Authorization: Bearer <key>`** and nothing else
(`src/script-includes/secops-rest-client.js:290`). That is hardcoded.

Most threat-intel vendors do not use `Authorization`. They use their own header name — `X-OTX-API-KEY`,
`Key`, `key`, `x-apikey`, `API-Key`, `api-key`. For those, the only way to send the key today is to
paste it into the endpoint's `request_headers` field, **in plain text, in a database record**.

That contradicts the application's own stated position — *"it will not store a secret. Not in a
table, not in a system property, not in a log."* It is a real framework gap, not a documentation
one, and it is cheap to close: add an `api_key_header` field to the connector (default
`Authorization`) and a `api_key_prefix` (default `Bearer `), then honour them at line 290. One
field, one line, and every vendor below moves onto the alias path.

**Until that is fixed:**

| Vendor | Key can live in an alias? |
|---|---|
| Hatching Triage, LimaCharlie | ✅ Yes — they use `Authorization: Bearer` |
| OTX, AbuseIPDB, GreyNoise, urlscan, VirusTotal, Hybrid Analysis | ❌ No — plain-text header on a dev instance only |

For the ❌ row: **use a throwaway key, on a personal dev instance, and rotate it when you are done.**
Never do this on an instance holding anyone's real data, and never commit the record.

---

## Common setup (do once)

1. **Alias** — *Connections & Credentials > Connection & Credential Aliases* > New.
   Type `Credential`, name it, save. Create a **Connection** under it with the vendor's base URL,
   and a **Credential** record holding the key as `api_key`.
2. **Connector** — *SecOps Universal Connector > Connectors* > New.
   `base_url`, `auth_type`, `connection_alias` (or `none` + a header), `active: true`.
3. **Endpoint** — child of the connector. `capability`, `http_method`, `path`, `success_codes`,
   `active: true`, `order` (lowest wins when several serve one capability).
4. **Test** — the *Test* button in the SecOps Connector Console widget, or a background script.

Test indicators that are safe to use are listed in [10-knowledge-base.md](10-knowledge-base.md).
Never submit real customer data to any of these.

---

## 1. AlienVault OTX — `enrich` · start here

**Sign up:** otx.alienvault.com, email only. Key is on your profile page immediately.

| Field | Value |
|---|---|
| base_url | `https://otx.alienvault.com/api/v1` |
| auth_type | `none` |
| request_headers | `{"X-OTX-API-KEY":"<key>"}` |
| capability | `enrich` |
| http_method | `get` |
| path | `/indicators/IPv4/${ioc}/general` |
| response_root | *(leave empty)* |
| success_codes | `200` |

**Test:** enrich an observable for an IP with known reports.
**Expect:** `ok: true`, a Threat Lookup Result row, a transaction row with a redacted payload.
**Read the verdict carefully.** OTX returns `pulse_info.count`, not a verdict word. If your finding
comes back `Unknown`, that is the mapping doing its job, not a bug — add a field mapping from
`pulse_info.count` to `finding` and let the numeric rule decide (§1.3 of the testing guide).

---

## 2. AbuseIPDB — `enrich` · the second source

The point of this one is **fan-out**: two active `enrich` endpoints prove the worst-verdict roll-up,
which a single source never exercises. Do not skip it.

**Sign up:** abuseipdb.com, email. Key under Account > API.

| Field | Value |
|---|---|
| base_url | `https://api.abuseipdb.com/api/v2` |
| auth_type | `none` |
| request_headers | `{"Key":"<key>"}` |
| capability | `enrich` |
| http_method | `get` |
| path | `/check?ipAddress=${ioc}&maxAgeInDays=90` |
| response_root | `data` |
| success_codes | `200` |

`abuseConfidenceScore` is 0–100, which lines up with the framework's ≥70 / ≥40 thresholds with no
mapping at all.

**Test:** enrich the same observable you used for OTX.
**Expect:** two Threat Lookup Result rows, one per source, and the observable carrying the **worse**
of the two verdicts. Then verify the monotonicity rule: deactivate AbuseIPDB, re-run, and confirm
the verdict does **not** drop.

---

## 3. GreyNoise — `enrich` · cheap third opinion

**Sign up:** greynoise.io, email. Community API key from your account page.

| Field | Value |
|---|---|
| base_url | `https://api.greynoise.io` |
| auth_type | `none` |
| request_headers | `{"key":"<key>"}` |
| capability | `enrich` |
| path | `/v3/community/${ioc}` · `get` · `200` |

Returns a `classification` of `benign` / `malicious` / `unknown` — **actual verdict words**, so this
is the one that properly exercises vocabulary normalisation. Map `classification` → `finding`.

**Expect:** `benign` normalises to a clean platform choice, not to `Unknown`. If it lands on
`Unknown`, the normaliser is missing a word — that is a genuine bug and worth a test.

---

## 4. urlscan.io — `enrich` + the two-call pattern

**Sign up:** urlscan.io, email. Key under Settings & API.

Submission and result are **two separate calls**, and the framework does one call per endpoint
execution. So build two endpoints and chain them in a Flow — this is the §3.3 "login-then-act"
shape, and it is worth doing once to understand the limit.

| | Submit | Retrieve |
|---|---|---|
| capability | `custom` | `enrich` |
| method / path | `post` `/scan/` | `get` `/result/${scan_id}/` |
| request_headers | `{"API-Key":"<key>"}` | same |
| request_template | `{"url":"${ioc}","visibility":"unlisted"}` | — |

**Use `visibility: unlisted`.** The default publishes your scan publicly.
**Expect:** the submit returns a `uuid`; results are not ready instantly, so a retrieve straight
after returns 404. That 404 is correct behaviour and a good test of your error handling.

---

## 5. Hatching Triage — `detonate` · the real sandbox

**Sign up:** tria.ge, email. You need a **Researcher** account for an API key to appear on your
account page — request it if the field is empty.

**Uses `Authorization: Bearer`, so the key goes in an alias.** ✅

| Field | Value |
|---|---|
| base_url | `https://tria.ge/api/v0` |
| auth_type | `alias` (credential attribute `api_key`) |
| capability | `detonate` |
| http_method | `post` |
| path | `/samples` |
| request_template | `{"kind":"fetch","url":"${ioc}","interactive":false}` |
| success_codes | `200,201` |

**Test with EICAR or a benign URL. Never live malware, never a customer's file.**
Submitting to a public sandbox publishes the sample permanently, to everyone.

**Expect:** analysis is asynchronous, so the immediate response has no verdict. `detonate` returns
`Unknown` — which is correct, and is exactly why the app refuses to let `Unknown` overwrite a known
verdict. To get a real disposition you need a second endpoint polling `/samples/{id}/overview.json`,
mapped `analysis.score` → `finding`.

**The gotcha worth seeing for yourself:** on a `detonate` endpoint, field mappings do nothing unless
`target_field` is `finding`. The README explains why. Configure one that isn't, watch it silently
do nothing, and you will never be confused by it again.

---

## 6. Hybrid Analysis — `detonate` · alternative

**Sign up:** hybrid-analysis.com, email plus vetting (not instant).

| Field | Value |
|---|---|
| base_url | `https://www.hybrid-analysis.com/api/v2` |
| auth_type | `none` |
| request_headers | `{"api-key":"<key>","User-Agent":"Falcon Sandbox"}` |
| capability | `detonate` · `get` · `/search/hash?hash=${ioc}` · `200` |

**The `User-Agent` header is mandatory.** Without it you get a 403 that says nothing useful.
Hash lookup is the easiest starting endpoint — no upload, no polling.

---

## 7. LimaCharlie — `contain` · the important one

This is the only free EDR with a real isolation API, and `contain` is your most dangerous untested
path. **Uses `Authorization: Bearer`, so the key goes in an alias.** ✅

**Sign up:** limacharlie.io, email. Create an organisation, then:
1. Install a sensor on **a throwaway VM you own** — a disposable Linux or Windows box, nothing else.
2. Create an API key with sensor-command permissions (Access > REST API).
3. Note your Organisation ID (OID) and the sensor ID (SID).

LimaCharlie issues a short-lived JWT from your API key. The framework has no token-exchange step, so
either mint the JWT and store it in the alias (it expires — refresh it), or add a small script
include that fetches it. For a first test, minting it by hand is fine.

| Field | Value |
|---|---|
| base_url | `https://api.limacharlie.io/v1` |
| auth_type | `alias` |
| capability | `contain` |
| http_method | `post` |
| path | `/${target_value}` *(the sensor ID)* |
| request_template | `{"task":"segregate_network"}` |
| success_codes | `200` |

Context available to a `contain` endpoint: `${target_value}`, `${target_type}`, `${action}`,
`${reason}`, `${incident}`, `${requested_by}`.

**Test on your throwaway VM, and confirm it actually loses network.** Then `rejoin_network` to
release it.

**Test the refusals too** — they matter more than the success:
- A containment request with **no target** must be refused, not sent with an empty parameter.
- A request with **no reason** must be refused.

That validation is the whole point of the handler, and this is the first chance to prove it against
something real.

---

## 8. Wazuh — `sightings` (W1)

Only needed when you start W1 ([13-tier1-build-strategy.md](13-tier1-build-strategy.md)). Stand it
up **before** you write the handler, so sightings is built against a real search API rather than
retro-fitted to one. Splunk's free tiers block REST API access; Wazuh does not.

**Set up:** `docker run` the single-node compose from wazuh.com, then create an API user.
Auth is Basic → JWT, so the same token-exchange caveat as LimaCharlie applies.

Search the indexer (`POST /_search` on port 9200) rather than the manager API — that is the shape a
real SIEM sightings query takes, and it is what you want W1 designed against.

**Expect:** zero hits on a fresh install. That is the case to build for first — *searched, not
seen* is `ok: true` with an empty result, not a failure.

---

## 9. MISP — `enrich` and `sightings`

Optional, but it is the reference implementation of the native SecOps sightings capability, so it is
the best model for what W1 should look like.

**Set up:** the official Docker image. Generate an auth key under Administration > List Auth Keys.
Header is `Authorization: <key>` with **no `Bearer` prefix**, so it needs the plain-text header
route until the `api_key_prefix` fix lands.

| Field | Value |
|---|---|
| capability | `enrich` · `post` · `/attributes/restSearch` |
| request_headers | `{"Authorization":"<key>","Content-Type":"application/json"}` |
| request_template | `{"value":"${ioc}","limit":10}` |
| response_root | `response.Attribute` |

---

## Suggested order and what each proves

| # | Vendor | Proves |
|---|---|---|
| 1 | OTX | The transport works at all. First real 200. |
| 2 | AbuseIPDB | Fan-out, worst-verdict roll-up, monotonicity |
| 3 | GreyNoise | Vocabulary normalisation against real verdict words |
| 4 | Triage | Async detonation, and the mapping gotcha |
| 5 | LimaCharlie | Containment, and the validation refusals |
| 6 | Wazuh / MISP | W1 designed against a real search API |

After each one, check the transaction record: **status, duration, and a redacted payload**. A key
visible in `request_summary` is a redaction bug and the most important thing you could find here.

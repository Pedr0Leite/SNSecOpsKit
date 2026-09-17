# Knowledge base — concepts behind the SecOps Universal Connector

The other documents explain **how the application works**. This one explains **the security concepts
it assumes you already know** — the things that are obvious to a SOC analyst and genuinely opaque to
everyone else, including experienced ServiceNow developers.

It is written as questions, because that is how the doubts actually arrive. If you hit one that is
not here, add it — the format is deliberately easy to extend.

---

## "Does the app create a virtual IP, like 1.1.1.1, to test the malware in a reported phishing email?"

**No. Nothing is created. No IP is provisioned, no VM is started, no network interface appears
anywhere.**

This is the single most common misunderstanding, and it is worth being precise about, because the
answer *is* the security model.

The IP addresses you see in this repository — in test payloads, in examples, in the self-test — are
**text**. Characters in a JSON body, or characters sitting in an incident's description field. The
framework treats them the way a spellchecker treats a word: it recognises the shape, and that is all.

### The analogy

Someone hands you an unlabelled pill bottle they found. You have two options:

1. **Swallow the pill and see what happens.** Nobody does this.
2. **Read the serial number off the bottle and phone poison control:** *"what is 4H2-9981?"* They
   check their database and tell you. **The pill never leaves the bag.**

This framework is option 2, always. It reads identifiers out of an incident and asks a third party
what they know about them. It never connects to the attacker's server, never opens the link, never
runs the attachment.

Option 1 does exist — it is called **detonation** — but it happens in a sealed, disposable virtual
machine, **at a different company**. ServiceNow phones them and reads the verdict back.

### Where the boundary sits

```
   YOUR SERVICENOW INSTANCE          │        THE OUTSIDE WORLD
                                     │
  incident text                      │
  "click hxxps://evil[.]test         │
   callback 192.0.2.44"              │
         │                           │
         ▼                           │
  extract the STRINGS                │
  ["https://evil.test",              │
   "192.0.2.44"]                     │
         │                           │
         │  HTTPS to the VENDOR ─────┼──▶  VirusTotal / ANY.RUN / Joe Sandbox
         │  "what do you know        │          │
         │   about this string?"     │          │  THEY run it, in THEIR
         │                           │          │  disposable VM, on THEIR
         │       verdict ◀───────────┼──────────┘  network
         ▼                           │
  write Malicious / Suspicious /     │
  Clean / Unknown                    │
                                     │
                          ╳ never connects to evil.test ╳
```

Every outbound call this application makes goes to **a vendor's API**. It never goes to the
indicator. That distinction is the whole safety model, and it is why the app can run on a production
instance without a lab, a quarantine network, or a security exception.

---

## "So what is an indicator, then?"

An **indicator of compromise** (IOC) is a forensic clue — a string that identifies something involved
in an attack. In ServiceNow's Threat Intelligence module the record type is called an
**observable** (`sn_ti_observable`), and the two words mean the same thing here.

The framework extracts seven types, and the type names are verbatim `sn_ti_observable_type` values:

| Type | Example | Where it comes from in a phish |
|---|---|---|
| `URL` | `https://login-verify.example.test/session` | the link the victim was asked to click |
| `Email address` | `finance-alerts@example-invoices.test` | the forged sender |
| `IP address (V4)` | `192.0.2.44` | where the malware calls home to |
| `Domain name` | `example-phish.test` | the attacker's infrastructure |
| `SHA256 hash` / `SHA1 hash` / `MD5 hash` | `e3b0c442…b855` | a fingerprint of the attachment |

A hash is worth dwelling on, because it explains why this works without ever touching the file: a
hash is a fixed-length fingerprint computed *from* a file. Identical files produce identical hashes.
So "have you seen `e3b0c442…`?" is a complete question — the vendor can answer it from a database
without anyone re-sending the file anywhere.

---

## "What is detonation, and does this app do it?"

Detonation means **actually running the suspicious thing** — opening the attachment, visiting the
URL — inside a disposable virtual machine while recording everything it does: files written,
registry keys changed, processes spawned, network connections attempted.

The app has a `detonate` capability, but the name describes **what it asks for**, not what it does.
It sends the indicator to a sandbox vendor's API and reads the result. The detonation happens on the
vendor's infrastructure.

Nothing detonates until you configure a sandbox connector with real credentials. Out of the box, and
throughout every test in this repository, nothing is executed anywhere.

---

## "Why is it written `hxxps://` and `1.1.1[.]1`? Is that obfuscation by the attacker?"

No — it is **defanging**, and the analyst did it deliberately.

`http://evil.com` pasted into a ticket, a chat message or an email is usually rendered as a **live
hyperlink**. One mis-click by a tired colleague at 3am, and someone has visited attacker
infrastructure from a corporate machine. So the industry convention is to break the syntax on
purpose:

| Live | Defanged |
|---|---|
| `http://evil.com` | `hxxp://evil[.]com` |
| `1.1.1.1` | `1.1.1[.]1` |
| `attacker@phish.net` | `attacker[at]phish[.]net` |

Readable, but inert. Essentially every vendor threat report — CrowdStrike, Mandiant, Talos — publishes
its IOC appendix this way.

This is why `SecOpsIndicatorExtractor` **re-fangs on the way in**. Analysts paste defanged indicators
into tickets constantly. An extractor that only understood `http://` would miss most of the real
evidence in the field where evidence most often lands.

---

## "Which addresses and domains are safe to put in test data?"

Three categories, and the distinction matters.

**Reserved for documentation — use these in anything that gets sent.** RFC 5737 sets aside three
IPv4 ranges that *"SHOULD NOT appear on the public Internet"*, and tells network operators to treat
them as non-routable:

| Range | Name |
|---|---|
| `192.0.2.0/24` | TEST-NET-1 |
| `198.51.100.0/24` | TEST-NET-2 |
| `203.0.113.0/24` | TEST-NET-3 |

Every IP in this repository's test data comes from `192.0.2.0/24`. If something ever did try to
connect, it goes nowhere.

**Reserved domain names.** RFC 2606 reserves `.test`, `.example`, `.invalid` and `.localhost`, plus
`example.com` / `.net` / `.org`. The test data here uses `.test` names like
`selftest-invoices.test` — unmistakably fake, and unregisterable by anyone.

**Famous real addresses — for readability in prose only.** `1.1.1.1` is Cloudflare's public DNS
resolver and `8.8.8.8` is Google's. Both are real, both are harmless, and both appear in this
repository purely because everyone recognises them on sight. They are used in *examples*, never in
payloads that get sent.

That is the rule the whole repo follows: **famous real addresses for readability, reserved ranges
for anything that travels.**

---

## "What do the four verdicts mean, and why can automation never lower one?"

The vocabulary is ServiceNow's, not ours — they are the literal choices on `sn_ti_observable`:

| Verdict | Rank | Means |
|---|---|---|
| `Malicious` | 3 | confirmed bad |
| `Suspicious` | 2 | probably bad, not proven |
| `Clean` | 1 | checked, and fine |
| `Unknown` | 0 | **not assessed** — not the same as clean |

`Unknown` carrying rank 0 is the important part. It is what an unrecognised response body produces —
a vendor changing their JSON shape, a timeout, a malformed reply.

So if roll-up were allowed to lower a verdict, a feed that quietly broke would walk through your
observables **overwriting `Malicious` with `Unknown`**, and nobody would notice until an incident.
That is why `rollUpFinding()` only ever raises, and why it refuses outright when an analyst has set
`has_manual_finding_override`.

The same reasoning is why a failed lookup returns `Unknown` rather than `Clean`. A wrong "Clean" is
far more dangerous than an honest "I don't know".

---

## "What are the 'vulnerability findings' on the security overview? Are they Vulnerability Response records?"

**No.** They are rows in this application's own staging table, `x_335329_secops_vuln_stage`.

The distinction matters, because the words look the same and the tables are not:

| | Vulnerability findings (this app) | Vulnerable items (ServiceNow VR) |
|---|---|---|
| Table | `x_335329_secops_vuln_stage` | `sn_vul_vulnerable_item` |
| Needs a subscription | no | **yes** |
| Written by | the `ingest` capability, from scanner telemetry | Vulnerability Response |
| Deduplicated on | `source` + `external_id` | VR's own rules |

Everything a scanner pushes to `/api/x_335329_secops/secops_connector/vulnerability`, or that the app
pulls from an `ingest` endpoint, lands here first — **always**, and never straight into VR. Promotion
into Vulnerability Response is a separate, opt-in, runtime-guarded step, so that the application
installs and runs on an instance where VR does not exist. See
[07-vulnerability-response.md](07-vulnerability-response.md).

So when the overview says *"12 vulnerability findings"*, it means twelve rows of staged third-party
telemetry, not twelve VR records.

### Why so many have no matched CI

The staging table holds a raw `ci_identifier` (whatever the scanner called the host — `web01`,
`192.0.2.11`, an FQDN) and a separate `ci` reference that is filled in **only if** that string
resolves to exactly one `cmdb_ci`. Two queries per batch, by name and then by IP address.

An identifier matching **more than one** CI is deliberately left empty. Attaching a vulnerability to
the wrong asset is worse than attaching it to none, and the warning log names the ambiguous ones.

On a demo or test instance the count is usually *all of them*, because invented hostnames like
`web01` do not exist in the CMDB. That is the CMDB having no such record, not the matcher failing.

### All four figures drill into a list

Every findings number on the overview opens the records behind it: by severity, by source, most
affected assets, the headline total, and the unmatched-CI count. Clicking shows only what you have
access to — see the drill-in rules in [08-analyst-console.md](08-analyst-console.md).

---

## "How does the CVE watch search the official CVE page?"

**It does not.** It never loads `cve.org` at all.

That page is a *reading room*: its search terminal is built for a person standing in front of it, and
it runs entirely in the browser. There is no documented endpoint behind it to call, and scraping a
single-page application is the kind of integration that breaks on a Tuesday for no reason.

Instead the app uses the two official services the CVE ecosystem publishes — the library's
**catalogue API** to find the call numbers, and the **archive desk** to request each document by
number:

| | Service | Answers |
|---|---|---|
| **Call 1** | NVD 2.0 — `services.nvd.nist.gov/rest/json/cves/2.0` | *Which CVEs mention ServiceNow in this date range?* Returns ids, descriptions and CVSS. |
| **Call 2** | CVE Services — `cveawg.mitre.org/api/cve/{id}` | *Which versions does this one affect?* Returns the CNA's own strings, like `"Australia Patch 3 Hot Fix 2"`. |

Neither is sufficient alone. NVD has **no CPE data at all** for recent ServiceNow CVEs, so version
matching is impossible from it. CVE Services has no search. Both are free and unauthenticated.

A real discovery request, verified working:

```
GET https://services.nvd.nist.gov/rest/json/cves/2.0
      ?keywordSearch=ServiceNow
      &pubStartDate=2026-05-20T00:00:00.000
      &pubEndDate=2026-09-16T00:00:00.000
      &resultsPerPage=200
      &startIndex=0
```

Two constraints worth carrying in your head if you ever write against NVD yourself:

- **Any date range wider than 120 days returns HTTP 404**, and the failure looks like an empty body
  rather than a validation error. A six-month backfill is two calls, not one.
- Unauthenticated callers get **5 requests per 30 seconds**. An NVD API key raises it to 50.

### The catch nobody expects

`keywordSearch` searches the **description text**, not a product field. It works today because of a
convention rather than a guarantee: ServiceNow is its own CNA, and their advisories all open with
*"ServiceNow has addressed…"*.

So it can **miss** a CVE in a third-party library shipped inside ServiceNow whose write-up never
types the word, and it can **pull in** a CVE for some other product that merely mentions ServiceNow
in passing. Treat the feed as a net, not a guarantee — the vendor's own security advisory mailing
list is still what catches the rest. Full detail in [11-cve-watch.md](11-cve-watch.md).

---

## "Do I need a malware lab to test this application?"

**No.** The Postman collection and the background self-test send made-up strings to
`postman-echo.com`, a public request reflector that simply echoes them back. Nothing is executed
anywhere, by anyone. See [09-testing-guide.md](09-testing-guide.md).

If you ever *do* want a real analysis lab, the shape of it is: an isolated virtual machine, host-only
networking so it cannot reach your LAN, something like INetSim or FakeNet-NG faking the internet so
the sample never reaches the real one, and snapshot-and-revert between runs. It is a legitimate and
well-documented discipline — and also a completely separate project from this application. Most teams
pay a sandbox vendor rather than run their own.

---

## Where to learn this properly

Found by search and not individually vetted — the descriptions match, but judge the quality yourself.

**The best visual explanation, by a distance.** [ANY.RUN](https://any.run/) has a free tier where you
**watch a video of malware executing** in a VM: files being written, registry keys changed, network
calls going out, in real time. Five minutes there teaches more than any article. It is a vendor, so
read their blog as marketing — but the product genuinely is the demo.

| Topic | Resource |
|---|---|
| What an IOC is | [Day 3 – IOC Explained for SOC Beginners](https://www.youtube.com/watch?v=R8irSnmLBSo) (video) · [Splunk introductory guide](https://www.splunk.com/en_us/blog/learn/ioc-indicators-of-compromise.html) · [Microsoft Security 101](https://www.microsoft.com/en-us/security/business/security-101/what-are-indicators-of-compromise-ioc) · [CrowdStrike](https://www.crowdstrike.com/en-us/cybersecurity-101/threat-intelligence/indicators-of-compromise-ioc/) |
| Why some indicators matter more | [The IoC Pyramid of Pain](https://www.youtube.com/watch?v=iOxoS7F2NxM) (video) |
| Sandboxes and detonation | [What is an Interactive Malware Sandbox?](https://any.run/cybersecurity-blog/interactive-malware-sandbox/) · [Interactive vs automated](https://any.run/cybersecurity-blog/interactive-vs-automated-sandbox/) |
| Defanging | [URL defanging explained](https://inventivehq.com/blog/what-is-url-defanging-cybersecurity) · [What are defanged IOCs](https://inventivehq.com/blog/what-are-defanged-iocs) |
| Reserved test addresses | [RFC 5737](https://www.rfc-editor.org/rfc/rfc5737.html) — short and readable, unusually for an RFC |
| The whole workflow, hands-on | [TryHackMe — Phishing Analysis Tools (SOC Level 1)](https://www.jalblas.com/blog/tryhackme-phishing-analysis-tools-soc-level-1/) — best "learn by doing" · [Analyze a phishing email like a SOC analyst](https://medium.com/@venna.eshwar/how-to-analyze-a-phishing-email-like-a-soc-analyst-d3238a18d3ea) |

---

## Adding to this file

One `##` heading per question, phrased the way somebody would actually ask it — including the
mistaken assumption, if there is one, because that is what the next person will search for. Lead with
the direct answer, then the reasoning. Analogies earn their place here; this file exists for readers
who do not already have the mental model.

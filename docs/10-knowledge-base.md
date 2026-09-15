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

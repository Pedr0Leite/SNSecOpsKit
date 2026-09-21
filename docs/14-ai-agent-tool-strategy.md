# Being a tool the SecOps AI agents call

**Status:** strategy, not built. Written 2026-09-21 to be executed from a cold start.
**Prerequisite reading:** [12-feature-research.md](12-feature-research.md) Tier 3,
[03-flow-designer-actions.md](03-flow-designer-actions.md).

---

## Part 0 — The licensing question, answered

> *"Will Tier 3 be available if the client buys the SecOps module?"*

**No. Buying Security Operations is necessary but not sufficient.** There are three separate
things to own, and a customer can have the first without the other two:

| Layer | What it gets you | Separate purchase? |
|---|---|---|
| **Security Incident Response** (Standard / Professional) | `sn_si_*`, `sn_ti_*`, the SecOps workspace, the Integration Framework | The base SecOps subscription |
| **Now Assist for Security Operations** | The Gen AI and agentic features — Recommended Actions, Post-Incident Analysis, the SOC AI Specialists | **Yes — its own SKU**, billed as a generative-AI overlay per fulfilled user |
| **Assists** (consumption) | The metered units every agentic action burns, pooled at account level | **Yes — capacity, bought or bundled separately** |

On top of that, the **Tier 2 SOC AI Specialist** — the agent that builds and executes multi-phase
response plans, the one worth being a tool for — is not shipping yet. ServiceNow has it slated for
**December 2026**.

### What that means for this application

Three consequences, and they are the whole reason this document exists:

1. **The agent tool surface must be strictly optional.** A meaningful share of installs will never
   buy Now Assist. If registering the tools is a hard dependency, the app stops installing for the
   majority to serve the minority. Treat AI Agent Studio exactly the way the app already treats
   Vulnerability Response: **detect, guard, degrade to a reported skip.** The pattern is already in
   the codebase — `SecOpsVulnIngestionHandler.promote()` and its `sn_vul` guard. Copy it.

2. **Build the contract, not the integration.** What makes a capability agent-callable — narrow
   scope, a truthful description, typed structured output, idempotency, a dry run, a gate on
   destructive actions — is **the same work whether the caller is an AI agent, a Flow, a Virtual
   Agent, or a human with Postman.** All of it pays off today, on instances with no Now Assist at
   all. None of it is speculative spend against a December roadmap. That is the only honest reason
   to start now, and it is a sufficient one.

3. **Hedge the caller.** ServiceNow's agent is one consumer. The same contract, exposed through the
   existing Scripted REST API, serves an external orchestrator or a customer's own agent framework
   just as well. Design the facade so the transport is interchangeable and the app is not betting
   on one vendor's SKU attach rate.

---

## Part 1 — How a ServiceNow AI agent actually calls something

An AI agent in **AI Agent Studio** is given a role, and a set of **tools**. Tool types:

- **Flow action** — one published Action Designer action.
- **Subflow** — a published subflow, inputs passed from the agent's reasoning.
- **Script** — a script the agent invokes with named inputs.
- **Skill** — a Now Assist skill.

This application's logic is already ES5 script includes with a clean `run()` contract, and
[03-flow-designer-actions.md](03-flow-designer-actions.md) already documents two Flow Actions that
are thin script steps over a handler. **The distance from here to "registrable as an agent tool" is
short.** That is the good news.

The uncomfortable news is this: **the tool description is the API.** An agent does not read your
code, your ACLs or your docs. It reads a name, a description and an input schema, and from those
alone decides whether to call you and what to pass. A description written for a human admin —
"Enriches an observable" — is not enough for an agent to choose correctly between your tool and
four others. Description quality is an engineering deliverable here, not documentation polish.

---

## Part 2 — The agent-callable contract

Six properties. Each is testable, and none requires Now Assist to build or verify.

### 2.1 Narrow, single-purpose tools
One tool, one decision. `SecOps - Enrich Observable` is a good tool. `SecOps - Do Security Thing`
with a `mode` parameter is not — the agent will pick the wrong mode and you will never know why.
Where the app currently has one handler serving several shapes (`contain` covers isolate, release,
block, unblock), expose **one tool per action**, not one tool with an action parameter.

### 2.2 Descriptions written for a model
Every tool description states, in this order: what it does, when to choose it, **when NOT to choose
it**, what it costs (one synchronous outbound HTTP call, and roughly how long), and what it
returns. The negative clause matters most — it is what stops the agent calling `detonate` on an
incident with no indicators, or `contain` when it meant `block`.

### 2.3 Typed, bounded, structured output
Handlers already return `{ ok, error, status, payload, writes, transaction, ... }` — good. Two
problems for an agent caller:

- `payload` is **arbitrary third-party JSON**. A verbose EDR response can be hundreds of KB, which
  blows the agent's context and burns Assists on tokens nobody reads. Agent-facing output must be
  **summarised and truncated** to a declared budget, with the full payload reachable by transaction
  sys_id rather than inlined.
- `payload` is also **untrusted input** that will be read by a model that acts on what it reads.
  Anything from a third party that reaches an agent's context must be clearly delimited as data.
  This is a prompt-injection surface and it should be treated as one.

### 2.4 Idempotency
An agent retries. It retries because it misread the first result, because a plan step re-ran,
because a human re-asked. `contain` is destructive; running it twice must not isolate a host twice
or raise two response tasks. Accept an `idempotency_key`, record it on the transaction, and return
the **original** result on a repeat rather than re-calling the third party.

### 2.5 Dry run
Every destructive tool takes `dry_run`. It resolves the endpoint, builds the request, runs every
validation, and returns exactly what it *would* send — without sending it. This is how an agent
proposes a multi-phase plan to a human without executing it, and it is how you test the tools with
no third party wired up. The CVE watch already ships a dry-run mode
(`test/manual/cve-watch-run.js`); reuse the idea.

### 2.6 Attribution and gating
Every transaction row records **which actor** made the call — and for an agent call, which agent
and which plan. Without it, "why is this host isolated?" has no answer, and an agentic SOC where
nobody can reconstruct who did what is worse than no agent at all.

Then gate the destructive half: a property-driven policy that decides, per action, whether an
agent may execute directly or must produce an approval record for a human. Default **must-approve**
for `contain`, `block` and anything that writes to a third party. Ship it locked; let the customer
unlock it deliberately.

---

## Part 3 — Execution plan

Five phases. **P0–P2 have no dependency on Now Assist, AI Agent Studio, or any December release**
and should be judged on their own merits. P3–P4 are the parts that only pay off if the customer
buys in.

### P0 — Agent options on the handler spine
*Size: small. Touches: `secops-universal-payload-handler.js`, `secops-rest-client.js`,
`secops-transaction-logger.js`, `tables/transaction.now.ts`.*

Extend the shared `options` object every handler already accepts with `dry_run`,
`idempotency_key` and `actor`. Add `actor_type`, `actor_id` and `idempotency_key` columns to the
transaction table; index the key. Implement the replay: on a repeat key within a configurable
window, return the recorded outcome and do not call out.

`dry_run` short-circuits inside `SecOpsRestClient.execute` **after** the request is fully built and
redacted, so the returned preview is the real request, not a description of one.

**Acceptance:** a dry run produces a transaction row marked as such and zero outbound calls; the
same idempotency key twice produces one outbound call and two identical results.

### P1 — Six agent-grade Flow Actions
*Size: medium, mostly UI work. Touches: Action Designer on the instance, plus
`docs/03-flow-designer-actions.md`.*

| Action | Handler | Destructive |
|---|---|---|
| `SecOps - Enrich Observable` | `SecOpsThreatIntelHandler` | No |
| `SecOps - Search Sightings` | `SecOpsSightingsHandler` (Tier 1 item 1) | No |
| `SecOps - Analyse Incident Indicators` | `SecOpsPhishingHandler` | No |
| `SecOps - Isolate Host` | `SecOpsContainmentHandler` (`isolate`) | **Yes** |
| `SecOps - Block Indicator` | `SecOpsContainmentHandler` (`block`) | **Yes** |
| `SecOps - Check Connector Health` | `SecOpsHealthChecker` | No |

Each is a thin script step, per the existing pattern. Each carries a description written to §2.2.
Each destructive one exposes `dry_run` and `idempotency_key` as inputs.

Because actions cannot be authored in Fluent, these are built in the UI and captured in an update
set — so the doc that describes them is the source of truth and must be exact.

### P2 — `SecOpsAgentTools` facade and manifest
*Size: medium. Touches: new script include, new REST resource on the existing Scripted REST API.*

A single flat, JSON-in / JSON-out facade over the handlers, so any caller — Flow, script tool,
external orchestrator — hits one contract:

```
SecOpsAgentTools.invoke(tool_name, input_object, { actor, dry_run, idempotency_key })
  -> { ok, summary, data, truncated, transaction, error_code, error }
```

`summary` is a short human- and model-readable sentence. `data` is the bounded structured result.
`error_code` is a stable enumerated string (`NO_ENDPOINT`, `AUTH_EXPIRED`, `RATE_LIMITED`,
`TARGET_REQUIRED`, `WRITE_REFUSED`) — agents branch on codes, not on prose.

Plus `SecOpsAgentTools.manifest()`, returning the tool list with descriptions and input schemas,
exposed read-only at `/api/x_335329_secops/agent/tools`. That manifest is what makes the tool set
discoverable to a non-ServiceNow agent, and it is the natural shape to hand to an MCP bridge later.

**Acceptance:** every tool is invocable through the facade with no Flow and no agent present; the
manifest validates as JSON Schema; a 400 KB third-party payload comes back truncated with
`truncated: true` and the transaction sys_id for the full record.

### P3 — Safety rails
*Size: medium. Touches: new approval table, properties, ACLs.*

Approval gate table (`agent_action_request`) holding a proposed destructive action, the requesting
actor, the justification, the dry-run preview, and a state. Property per action class deciding
`auto | approve | deny`, defaulting to `approve`. Per-actor rate limiting reusing the transaction
table as its own counter. Output delimiting for third-party text reaching an agent context.

### P4 — Optional registration package
*Size: small-medium. Touches: a guarded installer script, `06-store-certification.md`.*

Register the tools in AI Agent Studio **only if** its tables exist — probed the same way
`promote()` probes for `sn_vul`. Absent, log a clear skip and carry on. Document in the Store
listing that the agent tools require Now Assist for Security Operations, so no customer buys this
app expecting agentic behaviour they are not licensed for.

---

## Part 4 — How to run this tomorrow

Start a Claude Code session on `claude/app-secops-feature-research-n61kio` (or a fresh branch off
it) and give it one phase at a time. P0 first — every later phase depends on it.

```
Read docs/14-ai-agent-tool-strategy.md and implement P0 only.
Follow the existing code conventions: ES5 Class.create script includes, Fluent for metadata,
a Node unit test per behaviour in test/, no new runtime dependencies.
Run npm test before and after; do not proceed to P1.
```

Do not let one session attempt P0 through P4. P1 is instance UI work that cannot be verified from
the repo, and P3 is a security control that deserves its own review.

## Part 5 — The honest risk

If the customer never buys Now Assist, P3 and P4 are dead weight. **P0 through P2 are not** — they
are idempotency, dry run, stable error codes, bounded output and an attributed audit trail, which
are simply what a mature integration framework owes any caller. Build P0–P2 because they are right.
Build P3–P4 when a real customer with a real Now Assist licence asks for them.

---

## Sources

- [Now Assist for Security Incident Response — ServiceNow Store](https://store.servicenow.com/store/app/e929af6e1be06a50a85b16db234bcb12)
- [ServiceNow SecOps Licensing Guide — Redress Compliance](https://redresscompliance.com/servicenow-secops-licensing-guide)
- [ServiceNow AI-Native Licensing in 2026: Assists, Consumption, Governance](https://www.servicenow.com/community/upgrades-and-patching-forum/servicenow-ai-native-licensing-in-2026-a-practical-guide-to/td-p/3565858)
- [Now Assist FAQs](https://www.servicenow.com/community/now-assist-articles/now-assist-faqs/ta-p/2685122)
- [ServiceNow delivers Autonomous Security](https://newsroom.servicenow.com/press-releases/details/2026/ServiceNow-delivers-Autonomous-Security-the-industrys-most-complete-security-offering/default.aspx)
- [Get familiar with agentic workflows & AI Agent](https://www.servicenow.com/community/developer-articles/get-familiar-with-agentic-workflows-amp-ai-agent/ta-p/3326559)
- [Passing inputs to subflow tools in AI agents](https://www.servicenow.com/community/ceg-ai-coe-articles/passing-inputs-to-subflow-tools-in-ai-agents-using-prompts/ta-p/3477126)
- [AI Agents — ServiceNow](https://www.servicenow.com/products/ai-agents.html)

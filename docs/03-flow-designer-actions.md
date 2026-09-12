# Flow Designer actions

Flow Designer **actions** (`sys_hub_action_type_definition`) are not authored in Fluent — the SDK
has no `Action` API for custom action definitions (`Action` covers built-in step usage inside a
flow). They are built once in the Action Designer UI and then reused across flows and subflows.

The logic is already packaged: each action is a thin **Script step** that calls a handler. That
keeps the action's own script to a dozen lines and means the action inherits retry, redaction and
audit behaviour for free.

Both actions below are scoped to **SecOps Universal Connector Framework** so they can call the
script includes directly.

---

## Action 1 — Enrich observable

*Flow Designer > Actions > New*, Application: **SecOps Universal Connector Framework**,
Name: `SecOps - Enrich Observable`.

### Inputs

| Label | Name | Type | Mandatory | Notes |
|---|---|---|---|---|
| Observable | `observable` | Reference · `sn_ti_observable` | Yes | |
| Connector | `connector` | Reference · `x_335329_secops_connector` | No | Empty = fan out to every active enrich endpoint |
| Roll up finding | `rollup` | True/False | No | Default `true` |

### Outputs

| Label | Name | Type |
|---|---|---|
| Success | `success` | True/False |
| Finding | `finding` | String |
| Sources queried | `source_count` | Integer |
| Error message | `error_message` | String |
| Result JSON | `result_json` | String |

### Script step

Script step inputs: drag `observable`, `connector`, `rollup` onto the step so they are available as
`inputs.*`.

```javascript
(function execute(inputs, outputs) {
    var handler = new SecOpsThreatIntelHandler();

    var result = handler.enrichObservable(String(inputs.observable), {
        connector: inputs.connector ? String(inputs.connector) : null,
        rollup: inputs.rollup !== false,
        // Flows run as the triggering user; system context keeps enrichment working when that
        // user cannot write to Threat Intelligence tables.
        secure: false
    });

    outputs.success = result.ok;
    outputs.finding = result.finding || 'Unknown';
    outputs.source_count = result.results ? result.results.length : 0;
    outputs.error_message = result.error || '';
    outputs.result_json = new SecOpsJson().stringify(result);
})(inputs, outputs);
```

Then map the script step's outputs onto the action outputs.

---

## Action 2 — Contain endpoint

Name: `SecOps - Contain Endpoint`.

### Inputs

| Label | Name | Type | Mandatory |
|---|---|---|---|
| Target type | `target_type` | Choice (`host`, `ip`, `user`, `url`, `hash`, `account`) | Yes |
| Target value | `target_value` | String | Yes |
| Action | `action` | Choice (`isolate`, `release`, `block`, `unblock`) | Yes |
| Reason | `reason` | String | Yes |
| Security incident | `incident` | Reference · `sn_si_incident` | No |
| Connector | `connector` | Reference · `x_335329_secops_connector` | No |

### Outputs

| Label | Name | Type |
|---|---|---|
| Success | `success` | True/False |
| HTTP status | `http_status` | Integer |
| Transaction | `transaction` | Reference · `x_335329_secops_transaction` |
| Error message | `error_message` | String |

### Script step

```javascript
(function execute(inputs, outputs) {
    var handler = new SecOpsContainmentHandler();

    var result = handler.contain(
        {
            target_type: String(inputs.target_type),
            target_value: String(inputs.target_value),
            action: String(inputs.action),
            reason: String(inputs.reason || ''),
            incident: inputs.incident ? String(inputs.incident) : null
        },
        {
            connector: inputs.connector ? String(inputs.connector) : null,
            secure: false
        }
    );

    outputs.success = result.ok;
    outputs.http_status = result.status || 0;
    outputs.transaction = result.transaction || '';
    outputs.error_message = result.error || '';
})(inputs, outputs);
```

> Containment is destructive. Put an approval step before this action in any flow that a
> non-analyst can trigger, and branch on `success` — do not assume the isolate worked.

---

## Action 3 — Detonate incident indicators (optional)

Name: `SecOps - Analyse Phishing Incident`. Input: `incident` (Reference · `sn_si_incident`).
Outputs: `success`, `disposition`, `indicator_count`, `result_json`.

```javascript
(function execute(inputs, outputs) {
    var result = new SecOpsPhishingHandler().analyzeIncident(String(inputs.incident), {
        createObservables: true,
        secure: false
    });

    outputs.success = result.ok;
    outputs.disposition = result.disposition || 'Unknown';
    outputs.indicator_count = result.indicators ? result.indicators.length : 0;
    outputs.result_json = new SecOpsJson().stringify(result);
})(inputs, outputs);
```

---

## Why `secure: false` in a flow

`SecOpsTargetWriter` defaults to `GlideRecordSecure`, which enforces the *running user's* ACLs. A
flow triggered by an analyst who lacks write access to `sn_ti_lookup_result` would silently produce
zero enrichment records. Actions therefore run the write in system context, and authorisation is
enforced where it belongs — on who can run the flow, and by the ACLs on this application's own
tables.

If your governance model requires per-user enforcement inside the flow instead, drop `secure` and
grant the analyst roles the necessary Threat Intelligence access.

## Packaging actions with the application

Actions built in the UI belong to the application scope and are captured in the application
automatically. To bring them back into this Fluent project:

```bash
npx now-sdk transform --table sys_hub_action_type_definition
```

This pulls the instance definitions into `.now.ts` files so they ship with the source rather than
living only on the instance.

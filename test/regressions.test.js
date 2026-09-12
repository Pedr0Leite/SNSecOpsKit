'use strict'

/**
 * Regression tests for the findings in BUGS.md.
 *
 * Each test names its bug id and asserts the corrected behaviour. Several of these were originally
 * invisible because test/harness.js implemented platform methods that do not exist; the doubles
 * have since been narrowed to the real API surface, which is what makes these tests meaningful.
 */

const test = require('node:test')
const assert = require('node:assert')
const { loadScriptIncludes } = require('./harness')

const ALL = [
    'secops-json.js',
    'secops-log.js',
    'secops-template.js',
    'secops-registry.js',
    'secops-transaction-logger.js',
    'secops-rest-client.js',
    'secops-field-mapper.js',
    'secops-target-writer.js',
    'secops-indicator-extractor.js',
    'secops-universal-payload-handler.js',
    'secops-threat-intel-handler.js',
    'secops-phishing-handler.js',
    'secops-vuln-ingestion-handler.js',
    'secops-containment-handler.js',
]

function connector(overrides) {
    return Object.assign(
        {
            sys_id: 'c1',
            name: 'TestTool',
            active: 'true',
            category: 'threat_intel',
            auth_type: 'none',
            base_url: 'https://api.example.com',
            http_timeout_ms: '5000',
            max_retries: '0',
        },
        overrides
    )
}

function endpoint(overrides) {
    return Object.assign(
        {
            sys_id: 'e1',
            name: 'Op',
            connector: 'c1',
            capability: 'enrich',
            active: 'true',
            http_method: 'post',
            path: '/lookup',
            request_template: '{"ioc":"${ioc}"}',
            success_codes: '200',
            order: '100',
        },
        overrides
    )
}

function baseDb(extra, overrides) {
    return Object.assign(
        {
            x_335329_secops_connector: [connector((overrides || {}).connector)],
            x_335329_secops_endpoints: [endpoint((overrides || {}).endpoint)],
            x_335329_secops_field_map: [],
            x_335329_secops_transaction: [],
            x_335329_secops_vuln_stage: [],
        },
        extra || {}
    )
}

// ---------------------------------------------------------------------- BUG-001

test('BUG-001: the connection URL is read via getAttribute, not a non-existent getConnectionUrl', () => {
    const sandbox = loadScriptIncludes(ALL, {
        db: baseDb({}, { connector: { auth_type: 'alias', connection_alias: 'alias1', base_url: '' } }),
        connections: {
            alias1: { url: 'https://from-alias.example.com', credentials: { user_name: 'svc', password: 'p' } },
        },
        restResponder: () => ({ status: 200, body: '{}' }),
    })

    const registry = new sandbox.SecOpsRegistry()
    const result = new sandbox.SecOpsRestClient().execute(registry.findEndpointForCapability('enrich'), {})

    assert.strictEqual(result.ok, true, 'the alias path is the DEFAULT auth mode - it must work')
    assert.strictEqual(sandbox._restCalls[0].endpoint, 'https://from-alias.example.com/lookup')
    assert.deepStrictEqual(sandbox._restCalls[0].basicAuth, { user: 'svc', password: 'p' })
})

// ---------------------------------------------------------------------- BUG-002

test('BUG-002: setMIDServer receives the MID Server name, never its sys_id', () => {
    const sandbox = loadScriptIncludes(ALL, {
        db: baseDb(
            { ecc_agent: [{ sys_id: 'mid_sys_id_1', name: 'MID-EU-01' }] },
            { connector: { mid_server: 'mid_sys_id_1' } }
        ),
        restResponder: () => ({ status: 200, body: '{}' }),
    })

    const registry = new sandbox.SecOpsRegistry()
    new sandbox.SecOpsRestClient().execute(registry.findEndpointForCapability('enrich'), {})

    assert.strictEqual(sandbox._restCalls[0].midServer, 'MID-EU-01')
    assert.notStrictEqual(sandbox._restCalls[0].midServer, 'mid_sys_id_1')
})

// ---------------------------------------------------------------------- BUG-003

test('BUG-003: a refused write downgrades ok - a 200 with rejected records is not a success', () => {
    const sandbox = loadScriptIncludes(ALL, {
        db: baseDb({ target_table: [] }, { endpoint: { capability: 'contain' } }),
        schema: { __denyCreate: ['target_table'] },
        restResponder: () => ({ status: 200, body: '{"result":"ok"}' }),
    })
    sandbox._db.x_335329_secops_field_map.push({
        sys_id: 'm1',
        endpoint: 'e1',
        source_path: 'result',
        target_table: 'target_table',
        target_field: 'status',
        transform: 'none',
        mandatory: 'false',
        order: '100',
    })

    const outcome = new sandbox.SecOpsContainmentHandler().contain({
        target_type: 'host',
        target_value: 'WKSTN-1',
        action: 'isolate',
        reason: 'test',
    })

    assert.strictEqual(outcome.status, 200, 'the HTTP call itself succeeded')
    assert.strictEqual(outcome.ok, false, 'but the containment record was refused, so ok must be false')
    assert.ok(outcome.error, 'the caller must be told why')
    assert.ok(outcome.writes, 'the write detail is surfaced, not discarded')
})

// ---------------------------------------------------------------- BUG-004 / 015

test('BUG-015: roll-up never lowers an existing verdict', () => {
    const sandbox = loadScriptIncludes(ALL, {
        db: baseDb({
            sn_ti_observable: [{ sys_id: 'obs1', value: '8.8.8.8', type: 'type1', finding: 'Malicious' }],
            sn_ti_observable_type: [{ sys_id: 'type1', name: 'IP address (V4)' }],
            sn_ti_lookup_result: [],
        }),
        // A source that changed its response shape: HTTP 200, unrecognisable verdict -> Unknown.
        restResponder: () => ({ status: 200, body: '{"totally":"different shape"}' }),
    })

    const result = new sandbox.SecOpsThreatIntelHandler().enrichObservable('obs1')

    assert.strictEqual(result.finding, 'Unknown')
    assert.strictEqual(
        sandbox._db.sn_ti_observable[0].finding,
        'Malicious',
        'an unrecognised response must not erase a known-bad verdict'
    )
})

test('BUG-015: roll-up still raises a verdict', () => {
    const sandbox = loadScriptIncludes(ALL, {
        db: baseDb({
            sn_ti_observable: [{ sys_id: 'obs1', value: '8.8.8.8', type: 'type1', finding: 'Clean' }],
            sn_ti_observable_type: [{ sys_id: 'type1', name: 'IP address (V4)' }],
            sn_ti_lookup_result: [],
        }),
        restResponder: () => ({ status: 200, body: '{"verdict":"malicious"}' }),
    })

    new sandbox.SecOpsThreatIntelHandler().enrichObservable('obs1')
    assert.strictEqual(sandbox._db.sn_ti_observable[0].finding, 'Malicious')
})

test('BUG-004: a failed detonation does not overwrite an existing observable verdict', () => {
    const sandbox = loadScriptIncludes(ALL, {
        db: baseDb(
            {
                sn_si_incident: [{ sys_id: 'inc1', short_description: 'see http://evil.example.com/a', description: '' }],
                sn_ti_observable: [{ sys_id: 'obs1', value: 'http://evil.example.com/a', type: 't_url', finding: 'Malicious' }],
                sn_ti_observable_type: [{ sys_id: 't_url', name: 'URL' }],
                sn_ti_m2m_task_observable: [],
                sn_ti_lookup_result: [],
            },
            { endpoint: { capability: 'detonate' } }
        ),
        restResponder: () => ({ status: 500, body: 'sandbox down' }),
    })

    new sandbox.SecOpsPhishingHandler().analyzeIncident('inc1')

    assert.strictEqual(
        sandbox._db.sn_ti_observable[0].finding,
        'Malicious',
        'a sandbox outage must not clear a known-bad observable'
    )
})

test('BUG-004: an analyst override survives phishing re-analysis', () => {
    const sandbox = loadScriptIncludes(ALL, {
        db: baseDb(
            {
                sn_si_incident: [{ sys_id: 'inc1', short_description: 'see http://site.example.com/a', description: '' }],
                sn_ti_observable: [
                    {
                        sys_id: 'obs1',
                        value: 'http://site.example.com/a',
                        type: 't_url',
                        finding: 'Clean',
                        has_manual_finding_override: 'true',
                    },
                ],
                sn_ti_observable_type: [{ sys_id: 't_url', name: 'URL' }],
                sn_ti_m2m_task_observable: [],
                sn_ti_lookup_result: [],
            },
            { endpoint: { capability: 'detonate' } }
        ),
        restResponder: () => ({ status: 200, body: '{"verdict":"malicious"}' }),
    })

    new sandbox.SecOpsPhishingHandler().analyzeIncident('inc1')

    assert.strictEqual(sandbox._db.sn_ti_observable[0].finding, 'Clean', 'automation must yield to a human decision')
})

// ---------------------------------------------------------------------- BUG-005

test('BUG-005: indicators in journal fields (work notes) are extracted', () => {
    const sandbox = loadScriptIncludes(ALL, {
        db: baseDb(
            {
                sn_si_incident: [
                    {
                        sys_id: 'inc1',
                        short_description: 'Reported phish',
                        description: '',
                        // getValue() on a journal field returns nothing; only getJournalEntry does.
                        __journal_work_notes: 'user forwarded http://evil.example.com/payload.exe',
                    },
                ],
                sn_ti_observable: [],
                sn_ti_observable_type: [{ sys_id: 't_url', name: 'URL' }],
                sn_ti_m2m_task_observable: [],
                sn_ti_lookup_result: [],
            },
            { endpoint: { capability: 'detonate' } }
        ),
        schema: { __journal: { sn_si_incident: ['comments', 'work_notes'] } },
        restResponder: () => ({ status: 200, body: '{"verdict":"malicious"}' }),
    })

    const result = new sandbox.SecOpsPhishingHandler().analyzeIncident('inc1')

    const urls = result.indicators.filter((i) => i.type === 'URL').map((i) => i.value)
    assert.deepStrictEqual(urls, ['http://evil.example.com/payload.exe'], 'work notes are where reported phish lands')
})

// ---------------------------------------------------------------------- BUG-006

test('BUG-006: an incident whose detonations all failed reports ok:false', () => {
    const db = baseDb({
        sn_si_incident: [{ sys_id: 'inc1', short_description: 'http://evil.example.com/a', description: '' }],
        sn_ti_observable: [],
        sn_ti_observable_type: [{ sys_id: 't_url', name: 'URL' }],
        sn_ti_m2m_task_observable: [],
    })
    db.x_335329_secops_endpoints = [] // no detonate endpoint configured at all

    const sandbox = loadScriptIncludes(ALL, { db })
    const result = new sandbox.SecOpsPhishingHandler().analyzeIncident('inc1')

    assert.strictEqual(result.ok, false, '"not configured" must not look like "nothing malicious"')
    assert.ok(result.error)
})

test('BUG-006: an incident with no indicators at all still reports ok:true', () => {
    const sandbox = loadScriptIncludes(ALL, {
        db: baseDb({
            sn_si_incident: [{ sys_id: 'inc1', short_description: 'nothing here', description: '' }],
            sn_ti_observable: [],
            sn_ti_observable_type: [],
            sn_ti_m2m_task_observable: [],
        }),
    })
    const result = new sandbox.SecOpsPhishingHandler().analyzeIncident('inc1')
    assert.strictEqual(result.ok, true)
    assert.deepStrictEqual(result.indicators, [])
})

// ---------------------------------------------------------------------- BUG-007

test('BUG-007: a negative max_retries still makes exactly one attempt and does not throw', () => {
    const sandbox = loadScriptIncludes(ALL, {
        db: baseDb({}, { connector: { max_retries: '-5' } }),
        restResponder: () => ({ status: 200, body: '{}' }),
    })

    const registry = new sandbox.SecOpsRegistry()
    const result = new sandbox.SecOpsRestClient().execute(registry.findEndpointForCapability('enrich'), {})

    assert.strictEqual(result.ok, true)
    assert.strictEqual(sandbox._restCalls.length, 1)
    const txn = sandbox._db.x_335329_secops_transaction[0]
    assert.notStrictEqual(txn.state, 'pending', 'the transaction must never be abandoned in pending')
})

test('BUG-007: max_retries is clamped to the documented ceiling', () => {
    const sandbox = loadScriptIncludes(ALL, { db: baseDb({}, { connector: { max_retries: '999' } }) })
    const registry = new sandbox.SecOpsRegistry()
    const connectorGr = registry.getConnector('c1')
    assert.strictEqual(registry.connectorToObject(connectorGr).max_retries, 5)
})

// ---------------------------------------------------------------------- BUG-009

test('BUG-009: a quote in a substituted value cannot break or inject into a JSON body', () => {
    const sandbox = loadScriptIncludes(ALL, {
        db: baseDb({}, { endpoint: { request_template: '{"indicator":"${ioc}"}' } }),
        restResponder: () => ({ status: 200, body: '{}' }),
    })

    const registry = new sandbox.SecOpsRegistry()
    new sandbox.SecOpsRestClient().execute(registry.findEndpointForCapability('enrich'), {
        ioc: 'a","injected":"1',
    })

    const sent = sandbox._restCalls[0].body
    const parsed = JSON.parse(sent)
    assert.strictEqual(parsed.injected, undefined, 'no extra key may be injected into the request')
    assert.strictEqual(parsed.indicator, 'a","injected":"1', 'the hostile value is preserved as data')
})

test('BUG-009: a body that should be JSON but is not is never sent', () => {
    const sandbox = loadScriptIncludes(ALL, {
        // A malformed template: the placeholder sits outside any quoting and breaks the JSON.
        db: baseDb({}, { endpoint: { request_template: '{"broken": ${missing}}' } }),
        restResponder: () => ({ status: 200, body: '{}' }),
    })

    const registry = new sandbox.SecOpsRegistry()
    const result = new sandbox.SecOpsRestClient().execute(registry.findEndpointForCapability('enrich'), {})

    assert.strictEqual(result.ok, false)
    assert.strictEqual(sandbox._restCalls.length, 0, 'a malformed JSON body must not reach the third party')
    assert.ok(result.error.indexOf('not valid JSON') !== -1)
})

test('BUG-009: Content-Type is set for a JSON template', () => {
    const sandbox = loadScriptIncludes(ALL, {
        db: baseDb(),
        restResponder: () => ({ status: 200, body: '{}' }),
    })
    const registry = new sandbox.SecOpsRegistry()
    new sandbox.SecOpsRestClient().execute(registry.findEndpointForCapability('enrich'), { ioc: 'x' })
    assert.strictEqual(sandbox._restCalls[0].headers['Content-Type'], 'application/json')
})

// ---------------------------------------------------------------------- BUG-012

test('BUG-012: endpoint resolution filters inactive connectors in the query, not per row', () => {
    const sandbox = loadScriptIncludes(ALL, {
        db: {
            x_335329_secops_connector: [connector({ sys_id: 'c1', active: 'false' }), connector({ sys_id: 'c2', name: 'Live' })],
            x_335329_secops_endpoints: [
                endpoint({ sys_id: 'e1', connector: 'c1', order: '1' }),
                endpoint({ sys_id: 'e2', connector: 'c2', order: '2' }),
            ],
            x_335329_secops_field_map: [],
            x_335329_secops_transaction: [],
        },
    })

    const resolved = new sandbox.SecOpsRegistry().findEndpointForCapability('enrich')
    assert.strictEqual(resolved.sys_id, 'e2', 'the endpoint on the inactive connector must be skipped')

    const all = new sandbox.SecOpsRegistry().listEndpointsForCapability('enrich')
    assert.deepStrictEqual(all.map((e) => e.sys_id), ['e2'])
})

// ---------------------------------------------------------------------- BUG-013

test('BUG-013: CI matching resolves a whole batch, and leaves ambiguous names unresolved', () => {
    const sandbox = loadScriptIncludes(ALL, {
        db: baseDb({
            cmdb_ci: [
                { sys_id: 'ci_web', name: 'web01', ip_address: '10.0.0.1' },
                { sys_id: 'ci_dup_a', name: 'dup01', ip_address: '10.0.0.2' },
                { sys_id: 'ci_dup_b', name: 'dup01', ip_address: '10.0.0.3' },
            ],
        }),
    })

    const handler = new sandbox.SecOpsVulnIngestionHandler()
    const map = handler.resolveCiBatch([{ ci_identifier: 'web01' }, { ci_identifier: 'dup01' }, { ci_identifier: '10.0.0.3' }])

    assert.strictEqual(map['web01'], 'ci_web')
    assert.strictEqual(map['dup01'], undefined, 'an ambiguous host must not be guessed')
    assert.strictEqual(map['10.0.0.3'], 'ci_dup_b', 'falls back to ip_address')
})

// ---------------------------------------------------------------------- BUG-017

test('BUG-017: a staged row records the transaction that produced it', () => {
    const sandbox = loadScriptIncludes(ALL, {
        db: baseDb({}, { endpoint: { capability: 'ingest', response_root: '' } }),
        restResponder: () => ({ status: 200, body: '{"results":[{"id":"V-1","cve":"CVE-1","host":"h1"}]}' }),
    })

    const result = new sandbox.SecOpsVulnIngestionHandler().pull({ source: 'Feed' })

    assert.strictEqual(result.staged, 1)
    const row = sandbox._db.x_335329_secops_vuln_stage[0]
    assert.ok(row.transaction, 'a staged row must be traceable to its call')
    assert.strictEqual(row.transaction, result.transaction)
})

// ---------------------------------------------------------------------- BUG-020

test('BUG-020: first_seen is set on insert and preserved on re-ingestion', () => {
    const sandbox = loadScriptIncludes(ALL, { db: baseDb() })
    const handler = new sandbox.SecOpsVulnIngestionHandler()

    handler.ingest([{ id: 'V-1', cve: 'CVE-1', host: 'h1' }], { source: 'Feed' })
    const firstSeen = sandbox._db.x_335329_secops_vuln_stage[0].first_seen
    assert.ok(firstSeen, 'first_seen must be populated')

    sandbox._db.x_335329_secops_vuln_stage[0].first_seen = '2020-01-01 00:00:00'
    handler.ingest([{ id: 'V-1', cve: 'CVE-1', host: 'h1' }], { source: 'Feed' })

    assert.strictEqual(sandbox._db.x_335329_secops_vuln_stage.length, 1)
    assert.strictEqual(
        sandbox._db.x_335329_secops_vuln_stage[0].first_seen,
        '2020-01-01 00:00:00',
        're-ingestion must not reset first_seen'
    )
    assert.ok(sandbox._db.x_335329_secops_vuln_stage[0].last_seen, 'last_seen still refreshes')
})

// ---------------------------------------------------------------------- BUG-018

test('BUG-018: a non-finding field mapping on an enrich endpoint is applied', () => {
    const sandbox = loadScriptIncludes(ALL, {
        db: baseDb({
            sn_ti_observable: [{ sys_id: 'obs1', value: '8.8.8.8', type: 'type1', finding: 'Unknown' }],
            sn_ti_observable_type: [{ sys_id: 'type1', name: 'IP address (V4)' }],
            sn_ti_lookup_result: [],
        }),
        restResponder: () => ({ status: 200, body: '{"verdict":"malicious","engine_version":"7.2.1"}' }),
    })
    sandbox._db.x_335329_secops_field_map.push({
        sys_id: 'm1',
        endpoint: 'e1',
        source_path: 'engine_version',
        target_table: 'sn_ti_lookup_result',
        target_field: 'source_engine_version',
        transform: 'none',
        mandatory: 'false',
        order: '100',
    })

    new sandbox.SecOpsThreatIntelHandler().enrichObservable('obs1')

    const row = sandbox._db.sn_ti_lookup_result[0]
    assert.strictEqual(row.source_engine_version, '7.2.1', 'an administrator mapping a field must see it take effect')
    assert.strictEqual(row.finding, 'Malicious', 'finding stays the normalised platform choice')
})

// ---------------------------------------------------------------------- BUG-019

test('BUG-019: redaction fails closed at the recursion limit', () => {
    const sandbox = loadScriptIncludes(['secops-json.js'])
    const json = new sandbox.SecOpsJson()

    // Bury a credential deeper than the recursion limit.
    const deep = { password: 'leaked-secret' }
    let node = deep
    for (let i = 0; i < 20; i++) {
        node = { nested: node }
    }

    const out = json.stringify(json.redact(node))
    assert.ok(out.indexOf('leaked-secret') === -1, 'a secret below the depth limit must not be logged verbatim')
    assert.ok(out.indexOf('DEPTH_LIMIT') !== -1, 'the truncation point is marked')
})

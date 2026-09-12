'use strict'

const test = require('node:test')
const assert = require('node:assert')
const { loadScriptIncludes } = require('./harness')

const FILES = [
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

function baseDb(extra) {
    return Object.assign(
        {
            x_335329_secops_connector: [
                {
                    sys_id: 'c1',
                    name: 'TestTI',
                    active: 'true',
                    category: 'threat_intel',
                    auth_type: 'none',
                    base_url: 'https://api.example.com',
                    http_timeout_ms: '5000',
                    max_retries: '0',
                },
            ],
            x_335329_secops_endpoints: [
                {
                    sys_id: 'e1',
                    name: 'Lookup',
                    connector: 'c1',
                    capability: 'enrich',
                    active: 'true',
                    http_method: 'post',
                    path: '/lookup',
                    request_template: '{"ioc":"${ioc}"}',
                    success_codes: '200',
                    order: '100',
                },
            ],
            x_335329_secops_field_map: [],
            x_335329_secops_transaction: [],
            x_335329_secops_vuln_stage: [],
        },
        extra || {}
    )
}

function load(options) {
    return loadScriptIncludes(FILES, options || {})
}

// ---------------------------------------------------------------- threat intel

test('normalizeFinding maps vendor vocabulary onto platform choices', () => {
    const intel = new (load({ db: baseDb() }).SecOpsThreatIntelHandler)()
    assert.strictEqual(intel.normalizeFinding('malicious'), 'Malicious')
    assert.strictEqual(intel.normalizeFinding('MALWARE'), 'Malicious')
    assert.strictEqual(intel.normalizeFinding('phishing'), 'Malicious')
    assert.strictEqual(intel.normalizeFinding('suspicious'), 'Suspicious')
    assert.strictEqual(intel.normalizeFinding('benign'), 'Clean')
    assert.strictEqual(intel.normalizeFinding('harmless'), 'Clean')
    assert.strictEqual(intel.normalizeFinding('Unknown'), 'Unknown')
})

test('normalizeFinding returns null for vocabulary it does not recognise', () => {
    const intel = new (load({ db: baseDb() }).SecOpsThreatIntelHandler)()
    assert.strictEqual(intel.normalizeFinding('wibble'), null)
    assert.strictEqual(intel.normalizeFinding(null), null)
})

test('findingFromScore uses conservative thresholds', () => {
    const intel = new (load({ db: baseDb() }).SecOpsThreatIntelHandler)()
    assert.strictEqual(intel.findingFromScore({ score: 95 }), 'Malicious')
    assert.strictEqual(intel.findingFromScore({ score: 70 }), 'Malicious')
    assert.strictEqual(intel.findingFromScore({ score: 55 }), 'Suspicious')
    assert.strictEqual(intel.findingFromScore({ score: 10 }), 'Clean')
    assert.strictEqual(intel.findingFromScore({ nothing: true }), 'Unknown')
})

test('an unrecognised response yields Unknown, never Clean', () => {
    // Defaulting to Clean on an unparseable response would silently suppress real detections.
    const intel = new (load({ db: baseDb() }).SecOpsThreatIntelHandler)()
    assert.strictEqual(intel.findingFrom({ something: 'unparseable' }, { sys_id: 'e1' }), 'Unknown')
    assert.strictEqual(intel.findingFrom(null, { sys_id: 'e1' }), 'Unknown')
})

test('worstFinding takes the most severe verdict across sources', () => {
    const intel = new (load({ db: baseDb() }).SecOpsThreatIntelHandler)()
    assert.strictEqual(intel.worstFinding([{ finding: 'Clean' }, { finding: 'Malicious' }, { finding: 'Unknown' }]), 'Malicious')
    assert.strictEqual(intel.worstFinding([{ finding: 'Clean' }, { finding: 'Suspicious' }]), 'Suspicious')
    assert.strictEqual(intel.worstFinding([{ finding: 'Unknown' }]), 'Unknown')
    assert.strictEqual(intel.worstFinding([]), null)
})

test('enrichObservable writes a lookup result and rolls the finding up', () => {
    const sandbox = load({
        db: baseDb({
            sn_ti_observable: [{ sys_id: 'obs1', value: '8.8.8.8', type: 'type1', finding: 'Unknown' }],
            sn_ti_observable_type: [{ sys_id: 'type1', name: 'IP address (V4)' }],
            sn_ti_lookup_result: [],
        }),
        restResponder: () => ({ status: 200, body: '{"verdict":"malicious"}' }),
    })

    const result = new sandbox.SecOpsThreatIntelHandler().enrichObservable('obs1')

    assert.strictEqual(result.ok, true)
    assert.strictEqual(result.finding, 'Malicious')
    assert.strictEqual(sandbox._db.sn_ti_lookup_result.length, 1)
    assert.strictEqual(sandbox._db.sn_ti_lookup_result[0].observable, 'obs1')
    assert.strictEqual(sandbox._db.sn_ti_lookup_result[0].source_engine, 'TestTI')
    assert.strictEqual(sandbox._db.sn_ti_observable[0].finding, 'Malicious')
})

test('enrichObservable respects an analyst finding override', () => {
    const sandbox = load({
        db: baseDb({
            sn_ti_observable: [
                { sys_id: 'obs1', value: '8.8.8.8', type: 'type1', finding: 'Clean', has_manual_finding_override: 'true' },
            ],
            sn_ti_observable_type: [{ sys_id: 'type1', name: 'IP address (V4)' }],
            sn_ti_lookup_result: [],
        }),
        restResponder: () => ({ status: 200, body: '{"verdict":"malicious"}' }),
    })

    new sandbox.SecOpsThreatIntelHandler().enrichObservable('obs1')

    assert.strictEqual(sandbox._db.sn_ti_observable[0].finding, 'Clean', 'automation must not overwrite a human decision')
    assert.strictEqual(sandbox._db.sn_ti_lookup_result.length, 1, 'the lookup result is still recorded')
})

test('enrichObservable reports a missing observable without throwing', () => {
    const sandbox = load({ db: baseDb({ sn_ti_observable: [], sn_ti_lookup_result: [] }) })
    const result = new sandbox.SecOpsThreatIntelHandler().enrichObservable('nope')
    assert.strictEqual(result.ok, false)
    assert.ok(result.error.indexOf('could not be read') !== -1)
})

test('enrichObservable reports when no endpoint is configured', () => {
    const db = baseDb({
        sn_ti_observable: [{ sys_id: 'obs1', value: '8.8.8.8', type: 'type1' }],
        sn_ti_observable_type: [{ sys_id: 'type1', name: 'IP address (V4)' }],
        sn_ti_lookup_result: [],
    })
    db.x_335329_secops_endpoints = []
    const sandbox = load({ db })

    const result = new sandbox.SecOpsThreatIntelHandler().enrichObservable('obs1')
    assert.strictEqual(result.ok, false)
    assert.ok(result.error.indexOf('No active threat intelligence endpoint') !== -1)
})

// ------------------------------------------------------------------ containment

test('containment refuses a request with no target', () => {
    const sandbox = load({ db: baseDb() })
    const handler = new sandbox.SecOpsContainmentHandler()
    assert.ok(handler.validate({ target_type: 'host' }).indexOf('target value') !== -1)
    assert.ok(handler.validate({ target_value: 'h1' }).indexOf('target type') !== -1)
    assert.ok(handler.validate({ target_value: 'h1', target_type: 'satellite' }).indexOf('Unsupported target type') !== -1)
    assert.ok(handler.validate({ target_value: 'h1', target_type: 'host', action: 'vaporize' }).indexOf('Unsupported') !== -1)
    assert.strictEqual(handler.validate({ target_value: 'h1', target_type: 'host', action: 'isolate' }), null)
})

test('containment does not call the third party when validation fails', () => {
    const sandbox = load({ db: baseDb(), restResponder: () => ({ status: 200, body: '{}' }) })
    const result = new sandbox.SecOpsContainmentHandler().contain({ target_type: 'host' })
    assert.strictEqual(result.ok, false)
    assert.strictEqual(sandbox._restCalls.length, 0)
})

// -------------------------------------------------------------- vuln ingestion

test('toRecordArray unwraps the common envelope shapes', () => {
    const handler = new (load({ db: baseDb() }).SecOpsVulnIngestionHandler)()
    assert.strictEqual(handler.toRecordArray([{ a: 1 }]).length, 1)
    assert.strictEqual(handler.toRecordArray({ results: [{ a: 1 }, { b: 2 }] }).length, 2)
    assert.strictEqual(handler.toRecordArray({ data: [{ a: 1 }] }).length, 1)
    assert.strictEqual(handler.toRecordArray({ vulnerabilities: [{ a: 1 }] }).length, 1)
    assert.strictEqual(handler.toRecordArray({ a: 1 }).length, 1, 'a bare object is a single record')
    assert.strictEqual(handler.toRecordArray(null).length, 0)
})

test('toRecordArray honours an explicit records path', () => {
    const handler = new (load({ db: baseDb() }).SecOpsVulnIngestionHandler)()
    assert.strictEqual(handler.toRecordArray({ nested: { rows: [{ a: 1 }, { b: 2 }] } }, 'nested.rows').length, 2)
})

test('normalizeSeverity maps vendor severities and numbers', () => {
    const handler = new (load({ db: baseDb() }).SecOpsVulnIngestionHandler)()
    assert.strictEqual(handler.normalizeSeverity('Critical'), 'critical')
    assert.strictEqual(handler.normalizeSeverity('5'), 'critical')
    assert.strictEqual(handler.normalizeSeverity('high'), 'high')
    assert.strictEqual(handler.normalizeSeverity('Moderate'), 'medium')
    assert.strictEqual(handler.normalizeSeverity('1'), 'low')
    assert.strictEqual(handler.normalizeSeverity('informational'), 'informational')
    assert.strictEqual(handler.normalizeSeverity('wat'), 'unknown')
    assert.strictEqual(handler.normalizeSeverity(null), 'unknown')
})

test('ingest stages records and redacts the raw payload', () => {
    const sandbox = load({ db: baseDb() })
    const result = new sandbox.SecOpsVulnIngestionHandler().ingest(
        { results: [{ id: 'V-1', cve: 'CVE-2026-1111', severity: 'high', host: 'web01', api_key: 'leak-me' }] },
        { source: 'TestScanner' }
    )

    assert.strictEqual(result.ok, true)
    assert.strictEqual(result.staged, 1)

    const row = sandbox._db.x_335329_secops_vuln_stage[0]
    assert.strictEqual(row.source, 'TestScanner')
    assert.strictEqual(row.external_id, 'V-1')
    assert.strictEqual(row.cve, 'CVE-2026-1111')
    assert.strictEqual(row.severity, 'high')
    assert.strictEqual(row.state, 'new')
    assert.ok(row.raw_payload.indexOf('leak-me') === -1, 'a secret in the feed must not be stored in the staging row')
})

test('ingest skips a record with no usable identifier rather than writing junk', () => {
    const sandbox = load({ db: baseDb() })
    const result = new sandbox.SecOpsVulnIngestionHandler().ingest([{ description: 'no id at all' }], { source: 'S' })
    assert.strictEqual(result.staged, 0)
    assert.strictEqual(result.skipped, 1)
    assert.strictEqual(sandbox._db.x_335329_secops_vuln_stage.length, 0)
})

test('ingest derives an identifier from cve and host when none is supplied', () => {
    const sandbox = load({ db: baseDb() })
    new sandbox.SecOpsVulnIngestionHandler().ingest([{ cve: 'CVE-2026-2222', host: 'db01' }], { source: 'S' })
    assert.strictEqual(sandbox._db.x_335329_secops_vuln_stage[0].external_id, 'CVE-2026-2222@db01')
})

test('ingest coalesces a repeated finding instead of duplicating it', () => {
    const sandbox = load({ db: baseDb() })
    const handler = new sandbox.SecOpsVulnIngestionHandler()
    handler.ingest([{ id: 'V-1', cve: 'CVE-1' }], { source: 'S' })
    handler.ingest([{ id: 'V-1', cve: 'CVE-1' }], { source: 'S' })
    assert.strictEqual(sandbox._db.x_335329_secops_vuln_stage.length, 1)
})

test('ingest rejects an unparseable payload', () => {
    const sandbox = load({ db: baseDb() })
    const result = new sandbox.SecOpsVulnIngestionHandler().ingest('{not json', { source: 'S' })
    assert.strictEqual(result.ok, false)
    assert.ok(result.errors[0].indexOf('could not be parsed') !== -1)
})

test('ingest enforces the configured record cap', () => {
    const sandbox = load({
        db: baseDb(),
        properties: { 'x_335329_secops.ingest.max_records': '2' },
    })
    const records = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }]
    const result = new sandbox.SecOpsVulnIngestionHandler().ingest(records, { source: 'S' })
    assert.strictEqual(result.staged, 2)
    assert.ok(result.errors.some((e) => e.indexOf('only the first 2') !== -1))
})

test('promotion is skipped when disabled', () => {
    const sandbox = load({ db: baseDb() })
    const result = new sandbox.SecOpsVulnIngestionHandler().promote({})
    assert.strictEqual(result.skipped, true)
    assert.strictEqual(result.ok, true)
})

test('promotion is skipped with a clear message when VR is not installed', () => {
    const sandbox = load({
        db: baseDb(),
        properties: { 'x_335329_secops.vr.promotion_enabled': 'true' },
    })
    const result = new sandbox.SecOpsVulnIngestionHandler().promote({})
    assert.strictEqual(result.skipped, true)
    assert.ok(result.errors[0].indexOf('Vulnerability Response is not installed') !== -1)
})

test('promotion writes entry and vulnerable item when VR is present', () => {
    const sandbox = load({
        db: baseDb({
            sn_vul_third_party_entry: [],
            sn_vul_vulnerable_item: [],
        }),
        properties: { 'x_335329_secops.vr.promotion_enabled': 'true' },
    })

    const handler = new sandbox.SecOpsVulnIngestionHandler()
    handler.ingest([{ id: 'V-9', cve: 'CVE-2026-9999', title: 'Bad thing', host: 'web01' }], { source: 'S' })
    const result = handler.promote({})

    assert.strictEqual(result.ok, true)
    assert.strictEqual(result.promoted, 1)
    assert.strictEqual(sandbox._db.sn_vul_third_party_entry.length, 1)
    assert.strictEqual(sandbox._db.sn_vul_third_party_entry[0].id, 'CVE-2026-9999')
    assert.strictEqual(sandbox._db.sn_vul_vulnerable_item.length, 1)
    assert.strictEqual(sandbox._db.x_335329_secops_vuln_stage[0].state, 'promoted')
})

// ------------------------------------------------------------------- phishing

test('phishing analysis extracts indicators, detonates them and links observables', () => {
    const db = baseDb({
        sn_si_incident: [
            {
                sys_id: 'inc1',
                short_description: 'Phish reported',
                description: 'Link http://evil.example.com/a from 203.0.113.9',
            },
        ],
        sn_ti_observable: [],
        sn_ti_observable_type: [
            { sys_id: 't_url', name: 'URL' },
            { sys_id: 't_ip', name: 'IP address (V4)' },
            { sys_id: 't_dom', name: 'Domain name' },
        ],
        sn_ti_m2m_task_observable: [],
        sn_ti_lookup_result: [],
    })
    db.x_335329_secops_endpoints[0].capability = 'detonate'

    const sandbox = load({ db, restResponder: () => ({ status: 200, body: '{"verdict":"malicious"}' }) })

    const result = new sandbox.SecOpsPhishingHandler().analyzeIncident('inc1')

    assert.strictEqual(result.ok, true)
    assert.strictEqual(result.disposition, 'Malicious')
    assert.ok(result.indicators.length >= 2)
    assert.ok(sandbox._db.sn_ti_observable.length >= 2, 'observables are created from the extracted indicators')
    assert.ok(sandbox._db.sn_ti_m2m_task_observable.length >= 2, 'each observable is attached to the incident')
    assert.strictEqual(sandbox._db.sn_ti_m2m_task_observable[0].task, 'inc1')
})

test('phishing analysis reports an unreadable incident', () => {
    const sandbox = load({ db: baseDb({ sn_si_incident: [] }) })
    const result = new sandbox.SecOpsPhishingHandler().analyzeIncident('nope')
    assert.strictEqual(result.ok, false)
    assert.ok(result.error.indexOf('could not be read') !== -1)
})

test('phishing analysis succeeds quietly when there are no indicators', () => {
    const sandbox = load({
        db: baseDb({
            sn_si_incident: [{ sys_id: 'inc1', short_description: 'nothing here', description: 'no iocs' }],
            sn_ti_observable: [],
            sn_ti_observable_type: [],
            sn_ti_m2m_task_observable: [],
        }),
    })
    const result = new sandbox.SecOpsPhishingHandler().analyzeIncident('inc1')
    assert.strictEqual(result.ok, true)
    assert.deepStrictEqual(result.indicators, [])
    assert.strictEqual(sandbox._restCalls.length, 0)
})

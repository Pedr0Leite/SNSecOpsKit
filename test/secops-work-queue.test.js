'use strict'

const test = require('node:test')
const assert = require('node:assert')
const { loadScriptIncludes } = require('./harness')

const FILES = ['secops-json.js', 'secops-log.js', 'secops-registry.js', 'secops-work-queue.js']

const ME = 'test_user_sys_id' // matches gs.getUserID() in the harness
const MY_GROUP = 'grp_soc'
const OTHER_GROUP = 'grp_network'

function db(extra) {
    return Object.assign(
        {
            x_335329_secops_vuln_stage: [],
            sys_user_grmember: [{ sys_id: 'm1', user: ME, group: MY_GROUP }],
            sn_si_incident: [],
            sn_si_task: [],
        },
        extra || {}
    )
}

function incident(overrides) {
    return Object.assign(
        {
            sys_id: 'inc_' + Math.random().toString(16).slice(2, 8),
            number: 'SIR0001',
            short_description: 'Something happened',
            active: 'true',
            severity: '2',
            priority: '3',
            state: '10',
            assigned_to: '',
            assignment_group: '',
            opened_at: '2026-09-12 08:00:00',
        },
        overrides
    )
}

function queue(options) {
    const sandbox = loadScriptIncludes(FILES, options)
    return { sandbox, wq: new sandbox.SecOpsWorkQueue() }
}

// ------------------------------------------------------------------- scoping

test('scope "me" returns only work assigned to the current user', () => {
    const { wq } = queue({
        db: db({
            sn_si_incident: [
                incident({ number: 'MINE', assigned_to: ME }),
                incident({ number: 'THEIRS', assigned_to: 'someone_else' }),
                incident({ number: 'GROUP', assignment_group: MY_GROUP }),
            ],
        }),
    })

    const result = wq.list({ scope: 'me', sources: ['sir'] })
    assert.deepStrictEqual(result.rows.map((r) => r.number), ['MINE'])
})

test('scope "team" also returns unassigned work in my groups - the OR branch', () => {
    // This is the case SIR auto-assignment made impossible to demonstrate against a live
    // instance: an incident sitting in my group with nobody on it.
    const { wq } = queue({
        db: db({
            sn_si_incident: [
                incident({ number: 'MINE', assigned_to: ME }),
                incident({ number: 'GROUP-UNASSIGNED', assignment_group: MY_GROUP }),
                incident({ number: 'OTHER-GROUP', assignment_group: OTHER_GROUP }),
                incident({ number: 'THEIRS', assigned_to: 'someone_else' }),
            ],
        }),
    })

    const result = wq.list({ scope: 'team', sources: ['sir'] })
    const numbers = result.rows.map((r) => r.number).sort()

    assert.deepStrictEqual(numbers, ['GROUP-UNASSIGNED', 'MINE'])
    assert.strictEqual(result.groups, 1, 'group membership must resolve for "team" to mean anything')
    assert.strictEqual(result.summary.unassigned, 1)
})

test('scope "all" ignores ownership entirely', () => {
    const { wq } = queue({
        db: db({
            sn_si_incident: [
                incident({ number: 'MINE', assigned_to: ME }),
                incident({ number: 'THEIRS', assigned_to: 'someone_else' }),
            ],
        }),
    })
    assert.strictEqual(wq.list({ scope: 'all', sources: ['sir'] }).rows.length, 2)
})

test('an unresolvable group list degrades to "assigned to me" rather than erroring', () => {
    const { wq } = queue({
        db: db({
            sys_user_grmember: [],
            sn_si_incident: [incident({ number: 'MINE', assigned_to: ME }), incident({ number: 'GROUP', assignment_group: MY_GROUP })],
        }),
    })

    const result = wq.list({ scope: 'team', sources: ['sir'] })
    assert.strictEqual(result.groups, 0)
    assert.deepStrictEqual(result.rows.map((r) => r.number), ['MINE'])
})

// ------------------------------------------------------------------ severity

test('priority 1 is elevated to critical; SIR severity otherwise maps 1/2/3 to high/medium/low', () => {
    const { wq } = queue({
        db: db({
            sn_si_incident: [
                incident({ number: 'P1', priority: '1', severity: '3' }),
                incident({ number: 'S1', priority: '3', severity: '1' }),
                incident({ number: 'S2', priority: '3', severity: '2' }),
                incident({ number: 'S3', priority: '3', severity: '3' }),
                incident({ number: 'NONE', priority: '3', severity: '' }),
            ],
        }),
    })

    const bySeverity = {}
    wq.list({ scope: 'all', sources: ['sir'] }).rows.forEach((row) => {
        bySeverity[row.number] = row.severity
    })

    assert.strictEqual(bySeverity.P1, 'critical', 'a priority-1 record outranks its severity field')
    assert.strictEqual(bySeverity.S1, 'high')
    assert.strictEqual(bySeverity.S2, 'medium')
    assert.strictEqual(bySeverity.S3, 'low')
    assert.strictEqual(bySeverity.NONE, 'info', 'an unset severity is info, never a guess')
})

test('rows sort by severity, then by longest dwelling', () => {
    const { wq } = queue({
        db: db({
            sn_si_incident: [
                incident({ number: 'LOW', priority: '3', severity: '3' }),
                incident({ number: 'CRIT', priority: '1' }),
                incident({ number: 'HIGH-OLD', priority: '3', severity: '1', opened_at: '2026-09-01 08:00:00' }),
                incident({ number: 'HIGH-NEW', priority: '3', severity: '1', opened_at: '2026-09-12 07:00:00' }),
            ],
        }),
    })

    const order = wq.list({ scope: 'all', sources: ['sir'] }).rows.map((r) => r.number)
    assert.deepStrictEqual(order, ['CRIT', 'HIGH-OLD', 'HIGH-NEW', 'LOW'])
})

// ------------------------------------------------------------------ filters

test('severity and text filters narrow the queue', () => {
    const { wq } = queue({
        db: db({
            sn_si_incident: [
                incident({ number: 'A', priority: '1', short_description: 'Ransomware beacon' }),
                incident({ number: 'B', priority: '3', severity: '3', short_description: 'Phishing report' }),
            ],
        }),
    })

    assert.deepStrictEqual(
        wq.list({ scope: 'all', sources: ['sir'], severities: ['critical'] }).rows.map((r) => r.number),
        ['A']
    )
    assert.deepStrictEqual(
        wq.list({ scope: 'all', sources: ['sir'], search: 'phish' }).rows.map((r) => r.number),
        ['B'],
        'search is case-insensitive and matches the title'
    )
    assert.strictEqual(wq.list({ scope: 'all', sources: ['sir'], search: 'nothing here' }).rows.length, 0)
})

// ------------------------------------------------------------------ sources

test('findings are included for "all" and carry their own severity', () => {
    const { wq } = queue({
        db: db({
            x_335329_secops_vuln_stage: [
                {
                    sys_id: 'f1',
                    source: 'AcmeScanner',
                    external_id: 'V-1',
                    cve: 'CVE-2026-0001',
                    title: 'Heap overflow',
                    severity: 'critical',
                    state: 'new',
                    ci_identifier: 'web01',
                    last_seen: '2026-09-12 08:00:00',
                },
            ],
        }),
    })

    const rows = wq.list({ scope: 'all', sources: ['findings'] }).rows
    assert.strictEqual(rows.length, 1)
    assert.strictEqual(rows[0].kind, 'finding')
    assert.strictEqual(rows[0].severity, 'critical')
    assert.strictEqual(rows[0].number, 'CVE-2026-0001')
    assert.strictEqual(rows[0].ci, 'web01')
})

test('promoted findings drop out of the queue', () => {
    const { wq } = queue({
        db: db({
            x_335329_secops_vuln_stage: [
                { sys_id: 'f1', source: 'S', external_id: 'V-1', severity: 'high', state: 'promoted', last_seen: '2026-09-12 08:00:00' },
                { sys_id: 'f2', source: 'S', external_id: 'V-2', severity: 'high', state: 'new', last_seen: '2026-09-12 08:00:00' },
            ],
        }),
    })
    assert.deepStrictEqual(wq.list({ scope: 'all', sources: ['findings'] }).rows.map((r) => r.number), ['V-2'])
})

test('a source that is not installed is skipped, not fatal', () => {
    // No sn_si_incident / sn_si_task tables at all - an instance without SIR.
    const { wq } = queue({
        db: {
            x_335329_secops_vuln_stage: [
                { sys_id: 'f1', source: 'S', external_id: 'V-1', severity: 'low', state: 'new', last_seen: '2026-09-12 08:00:00' },
            ],
            sys_user_grmember: [],
        },
    })

    const result = wq.list({ scope: 'all', sources: ['sir', 'findings'] })
    assert.strictEqual(result.rows.length, 1, 'the console still works where SIR is absent')
})

test('the row limit is clamped to a sane range', () => {
    const { wq } = queue({ db: db() })
    assert.strictEqual(wq.clampLimit('abc'), 100)
    assert.strictEqual(wq.clampLimit('5'), 5)
    assert.strictEqual(wq.clampLimit('99999'), 300)
    assert.strictEqual(wq.clampLimit('-3'), 1)
})

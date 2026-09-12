'use strict'

const test = require('node:test')
const assert = require('node:assert')
const { loadScriptIncludes } = require('./harness')

function makeWriter(options) {
    const sandbox = loadScriptIncludes(['secops-json.js', 'secops-log.js', 'secops-target-writer.js'], options)
    return { writer: new sandbox.SecOpsTargetWriter(), sandbox }
}

test('reports a missing table instead of throwing', () => {
    const { writer } = makeWriter({ db: {} })
    const out = writer.write('sn_vul_vulnerable_item', { a: 1 })
    assert.strictEqual(out.ok, false)
    assert.ok(out.error.indexOf('does not exist') !== -1)
    assert.ok(out.error.indexOf('not installed') !== -1, 'the message should point at the real cause')
})

test('tableExists distinguishes present from absent tables', () => {
    const { writer } = makeWriter({ db: { sn_ti_observable: [] } })
    assert.strictEqual(writer.tableExists('sn_ti_observable'), true)
    assert.strictEqual(writer.tableExists('sn_vul_entry'), false)
    assert.strictEqual(writer.tableExists(''), false)
    assert.strictEqual(writer.tableExists(null), false)
})

test('writes a record and returns its sys_id', () => {
    const { writer, sandbox } = makeWriter({ db: { sn_ti_observable: [] } })
    const out = writer.write('sn_ti_observable', { value: '8.8.8.8', finding: 'Clean' })
    assert.strictEqual(out.ok, true)
    assert.ok(out.sys_id)
    assert.strictEqual(sandbox._db.sn_ti_observable.length, 1)
    assert.strictEqual(sandbox._db.sn_ti_observable[0].value, '8.8.8.8')
})

test('skips fields the target schema does not have, and still writes the rest', () => {
    const { writer, sandbox } = makeWriter({
        db: { sn_ti_observable: [] },
        schema: { sn_ti_observable: ['value', 'finding', 'sys_id'] },
    })
    const out = writer.write('sn_ti_observable', { value: '1.1.1.1', finding: 'Clean', renamed_in_a_later_release: 'x' })

    assert.strictEqual(out.ok, true)
    assert.deepStrictEqual(out.skipped, ['renamed_in_a_later_release'])
    assert.strictEqual(sandbox._db.sn_ti_observable[0].value, '1.1.1.1')
    assert.strictEqual(sandbox._db.sn_ti_observable[0].renamed_in_a_later_release, undefined)
})

test('refuses to write when creation is denied, and says why', () => {
    const { writer } = makeWriter({
        db: { sn_si_incident: [] },
        schema: { __denyCreate: ['sn_si_incident'] },
    })
    const out = writer.write('sn_si_incident', { short_description: 'x' })
    assert.strictEqual(out.ok, false)
    assert.ok(out.error.indexOf('Restricted Caller Access') !== -1, 'the operator needs to know RCA may be the cause')
})

test('coalesce updates the existing record instead of creating a duplicate', () => {
    const { writer, sandbox } = makeWriter({
        db: { sn_ti_observable: [{ sys_id: 'existing1', value: '8.8.8.8', type: 'typeA', finding: 'Unknown' }] },
    })

    const out = writer.write(
        'sn_ti_observable',
        { value: '8.8.8.8', type: 'typeA', finding: 'Malicious' },
        { coalesce: ['value', 'type'] }
    )

    assert.strictEqual(out.ok, true)
    assert.strictEqual(out.updated, true)
    assert.strictEqual(out.sys_id, 'existing1')
    assert.strictEqual(sandbox._db.sn_ti_observable.length, 1, 'must not create a duplicate observable')
    assert.strictEqual(sandbox._db.sn_ti_observable[0].finding, 'Malicious')
})

test('coalesce creates a record when nothing matches', () => {
    const { writer, sandbox } = makeWriter({
        db: { sn_ti_observable: [{ sys_id: 'existing1', value: '1.1.1.1', type: 'typeA' }] },
    })
    const out = writer.write('sn_ti_observable', { value: '9.9.9.9', type: 'typeA' }, { coalesce: ['value', 'type'] })
    assert.strictEqual(out.ok, true)
    assert.strictEqual(out.updated, false)
    assert.strictEqual(sandbox._db.sn_ti_observable.length, 2)
})

test('coalesce is all-or-nothing: a field absent from the schema means insert, not a partial match', () => {
    const { writer, sandbox } = makeWriter({
        db: { sn_ti_observable: [{ sys_id: 'existing1', value: '8.8.8.8' }] },
        schema: { sn_ti_observable: ['value', 'sys_id'] },
    })
    // 'type' is not a column here. Matching on 'value' alone would identify a DIFFERENT record
    // than the caller's key describes and then overwrite it. Inserting a duplicate is recoverable;
    // overwriting the wrong row is not.
    const out = writer.write('sn_ti_observable', { value: '8.8.8.8', type: 'typeA' }, { coalesce: ['value', 'type'] })
    assert.strictEqual(out.updated, false, 'must not update on a partial key')
    assert.strictEqual(out.ok, true)
    assert.strictEqual(sandbox._db.sn_ti_observable.length, 2)
})

test('coalesce is all-or-nothing: a valueless key field means insert', () => {
    const { writer, sandbox } = makeWriter({
        db: { sn_vul_vulnerable_item: [{ sys_id: 'vi1', vulnerability: 'entry1', cmdb_ci: 'ci1' }] },
    })
    // This is the promoteOne case where CI matching found nothing: without the all-or-nothing
    // rule it would match on `vulnerability` alone and overwrite another CI's vulnerable item.
    const out = writer.write(
        'sn_vul_vulnerable_item',
        { vulnerability: 'entry1', cmdb_ci: null },
        { coalesce: ['vulnerability', 'cmdb_ci'] }
    )
    assert.strictEqual(out.updated, false)
    assert.strictEqual(sandbox._db.sn_vul_vulnerable_item.length, 2)
})

test('insertOnly fields are set on create but left untouched on update', () => {
    const { writer, sandbox } = makeWriter({
        db: { sn_ti_observable: [{ sys_id: 'obs1', value: '8.8.8.8', type: 't1', finding: 'Malicious' }] },
    })

    const out = writer.write(
        'sn_ti_observable',
        { value: '8.8.8.8', type: 't1', finding: 'Unknown' },
        { coalesce: ['value', 'type'], insertOnly: ['finding'] }
    )

    assert.strictEqual(out.updated, true)
    assert.strictEqual(
        sandbox._db.sn_ti_observable[0].finding,
        'Malicious',
        'a failed lookup must not erase a known-bad verdict'
    )
})

test('rejects an empty value set rather than inserting a blank row', () => {
    const { writer } = makeWriter({ db: { sn_ti_observable: [] } })
    const out = writer.write('sn_ti_observable', {})
    assert.strictEqual(out.ok, false)
    assert.ok(out.error.indexOf('No values') !== -1)
})

test('rejects a missing table name', () => {
    const { writer } = makeWriter({ db: {} })
    const out = writer.write('', { a: 1 })
    assert.strictEqual(out.ok, false)
})

test('readField returns null instead of throwing for absent tables, records and fields', () => {
    const { writer } = makeWriter({
        db: { sn_ti_observable_type: [{ sys_id: 'type1', name: 'URL' }] },
        schema: { sn_ti_observable_type: ['sys_id', 'name'] },
    })
    assert.strictEqual(writer.readField('sn_ti_observable_type', 'type1', 'name'), 'URL')
    assert.strictEqual(writer.readField('sn_ti_observable_type', 'nope', 'name'), null)
    assert.strictEqual(writer.readField('missing_table', 'type1', 'name'), null)
    assert.strictEqual(writer.readField('sn_ti_observable_type', 'type1', 'missing_field'), null)
})

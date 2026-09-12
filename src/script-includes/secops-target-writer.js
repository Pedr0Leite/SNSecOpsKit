/**
 * SecOpsTargetWriter - the only place this application writes into SecOps-owned tables.
 *
 * Everything here is defensive by design, because the target schema is not ours:
 *   - the table may not exist (Vulnerability Response is a separate subscription),
 *   - a field may have been renamed between SecOps releases,
 *   - Restricted Caller Access may deny the write even when a cross-scope privilege is declared.
 *
 * Each of those degrades to a logged, reported skip rather than an exception, so a SecOps upgrade
 * cannot take a customer's integration offline.
 */
var SecOpsTargetWriter = Class.create()

SecOpsTargetWriter.prototype = {
    initialize: function () {
        this.log = new SecOpsLog('SecOpsTargetWriter')
        this.json = new SecOpsJson()
    },

    /** True when the table is present on this instance. Used to detect optional SecOps products. */
    tableExists: function (tableName) {
        if (!tableName) {
            return false
        }
        try {
            return new GlideRecord(String(tableName)).isValid()
        } catch (e) {
            return false
        }
    },

    /**
     * Inserts a record.
     *
     * @param tableName target table
     * @param values    { field: value }
     * @param options   { secure: boolean (default true), coalesce: [fieldNames],
     *                    insertOnly: [fieldNames] - set on create, left untouched on update }
     * @returns { ok, sys_id, skipped, error, updated }
     */
    write: function (tableName, values, options) {
        var opts = options || {}
        var outcome = { ok: false, sys_id: null, skipped: [], error: null, updated: false }

        if (!tableName) {
            outcome.error = 'No target table supplied'
            return outcome
        }
        if (!values || Object.keys(values).length === 0) {
            outcome.error = 'No values to write to ' + tableName
            return outcome
        }

        var gr
        try {
            gr = opts.secure === false ? new GlideRecord(String(tableName)) : new GlideRecordSecure(String(tableName))
        } catch (e) {
            outcome.error = 'Unable to open ' + tableName + ': ' + String(e)
            return outcome
        }

        if (!gr.isValid()) {
            outcome.error =
                'Table ' + tableName + ' does not exist on this instance - the product that owns it is probably not installed'
            this.log.warn(outcome.error)
            return outcome
        }

        // Coalesce: update the existing record instead of creating a duplicate observable/entry.
        var existing = opts.coalesce && opts.coalesce.length > 0 ? this.findExisting(gr, tableName, values, opts) : null
        if (existing) {
            return this.applyValues(existing, tableName, this.withoutInsertOnly(values, opts.insertOnly), true)
        }

        try {
            if (!gr.canCreate()) {
                outcome.error = 'Not permitted to create records in ' + tableName + ' (check ACLs and Restricted Caller Access)'
                this.log.warn(outcome.error)
                return outcome
            }
        } catch (e) {
            outcome.error = 'Permission check failed for ' + tableName + ': ' + String(e)
            return outcome
        }

        gr.initialize()
        return this.applyValues(gr, tableName, values, false)
    },

    /** Sets values, skipping fields the target table does not have, then inserts or updates. */
    applyValues: function (gr, tableName, values, isUpdate) {
        var outcome = { ok: false, sys_id: null, skipped: [], error: null, updated: isUpdate }
        var fields = Object.keys(values)

        for (var i = 0; i < fields.length; i++) {
            var field = fields[i]
            try {
                if (!gr.isValidField(field)) {
                    outcome.skipped.push(field)
                    continue
                }
                gr.setValue(field, values[field])
            } catch (e) {
                outcome.skipped.push(field)
            }
        }

        if (outcome.skipped.length > 0) {
            this.log.warn('Skipped fields absent from target schema', { table: tableName, fields: outcome.skipped })
        }

        try {
            var sysId = isUpdate ? gr.update() : gr.insert()
            if (!sysId) {
                outcome.error = (isUpdate ? 'Update' : 'Insert') + ' into ' + tableName + ' was rejected (ACL or data policy)'
                this.log.warn(outcome.error)
                return outcome
            }
            outcome.ok = true
            outcome.sys_id = String(sysId)
            return outcome
        } catch (e) {
            outcome.error = (isUpdate ? 'Update' : 'Insert') + ' into ' + tableName + ' failed: ' + String(e)
            this.log.error(outcome.error)
            return outcome
        }
    },

    /**
     * Returns a GlideRecord positioned on a matching record, or null.
     *
     * Coalesce is ALL-OR-NOTHING. `coalesce: ['a','b']` asserts that the pair identifies the
     * record; if any of those fields is missing from the schema or has no value, matching on the
     * remainder would identify a different record and then update it. Inserting a duplicate is
     * recoverable; overwriting the wrong row is not - so a partial key means insert.
     */
    findExisting: function (gr, tableName, values, opts) {
        try {
            var lookup = opts.secure === false ? new GlideRecord(String(tableName)) : new GlideRecordSecure(String(tableName))
            if (!lookup.isValid()) {
                return null
            }

            for (var i = 0; i < opts.coalesce.length; i++) {
                var field = opts.coalesce[i]
                if (!lookup.isValidField(field)) {
                    this.log.warn('Coalesce field is absent from the target schema - inserting instead of updating', {
                        table: tableName,
                        field: field,
                    })
                    return null
                }
                if (values[field] === undefined || values[field] === null || values[field] === '') {
                    this.log.warn('Coalesce field has no value - inserting instead of updating', {
                        table: tableName,
                        field: field,
                    })
                    return null
                }
                lookup.addQuery(field, values[field])
            }

            lookup.setLimit(1)
            lookup.query()
            return lookup.next() ? lookup : null
        } catch (e) {
            this.log.warn('Coalesce lookup failed', { table: tableName, error: String(e) })
            return null
        }
    },

    /** Strips insert-only fields from a value set bound for an update. */
    withoutInsertOnly: function (values, insertOnly) {
        if (!insertOnly || insertOnly.length === 0) {
            return values
        }
        var copy = {}
        var fields = Object.keys(values)
        for (var i = 0; i < fields.length; i++) {
            if (insertOnly.indexOf(fields[i]) === -1) {
                copy[fields[i]] = values[fields[i]]
            }
        }
        return copy
    },

    /** Reads a single field from a record without throwing when the table or record is absent. */
    readField: function (tableName, sysId, field) {
        try {
            var gr = new GlideRecord(String(tableName))
            if (!gr.isValid() || !gr.isValidField(field) || !gr.get(String(sysId))) {
                return null
            }
            return gr.getValue(field)
        } catch (e) {
            return null
        }
    },

    type: 'SecOpsTargetWriter',
}

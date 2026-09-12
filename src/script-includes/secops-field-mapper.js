/**
 * SecOpsFieldMapper - turns a third-party JSON response into ServiceNow field values using the
 * declarative rules in x_335329_secops_field_map.
 *
 * This is what makes the framework universal: onboarding a new vendor is mapping rows, not code.
 */
var SecOpsFieldMapper = Class.create()

SecOpsFieldMapper.prototype = {
    initialize: function () {
        this.json = new SecOpsJson()
        this.log = new SecOpsLog('SecOpsFieldMapper')
    },

    /**
     * @param payload      parsed third-party response
     * @param maps         rows from SecOpsRegistry.getFieldMaps
     * @param defaultTable table used when a mapping row leaves target_table empty
     * @returns { byTable: { table: { field: value } }, errors: [string], applied: number }
     */
    apply: function (payload, maps, defaultTable) {
        var result = { byTable: {}, errors: [], applied: 0 }
        if (!maps || maps.length === 0) {
            return result
        }

        for (var i = 0; i < maps.length; i++) {
            var rule = maps[i]
            var table = rule.target_table || defaultTable
            var field = rule.target_field

            if (!table || !field) {
                result.errors.push('Mapping ' + (rule.source_path || '?') + ' has no target table or field')
                continue
            }

            var raw = this.json.get(payload, rule.source_path, null)
            var value = raw === null ? this.defaultFor(rule) : this.transform(raw, rule.transform)

            if (value === null || value === '') {
                if (rule.mandatory) {
                    result.errors.push('Mandatory mapping "' + rule.source_path + '" produced no value for ' + table + '.' + field)
                }
                continue
            }

            if (!result.byTable[table]) {
                result.byTable[table] = {}
            }
            result.byTable[table][field] = value
            result.applied++
        }

        return result
    },

    defaultFor: function (rule) {
        return rule.default_value === undefined || rule.default_value === null ? null : rule.default_value
    },

    transform: function (value, kind) {
        switch (kind) {
            case 'trim':
                return String(value).replace(/^\s+|\s+$/g, '')
            case 'lower':
                return String(value).toLowerCase()
            case 'upper':
                return String(value).toUpperCase()
            case 'number':
                return this.toNumber(value)
            case 'boolean':
                return this.toBoolean(value)
            case 'json':
                return this.json.stringify(value)
            case 'iso_date':
                return this.toGlideDateTime(value)
            case 'none':
            default:
                // Objects would otherwise stringify to [object Object] on the way into a field.
                return typeof value === 'object' ? this.json.stringify(value) : value
        }
    },

    toNumber: function (value) {
        var parsed = parseFloat(value)
        return isNaN(parsed) ? null : parsed
    },

    toBoolean: function (value) {
        if (typeof value === 'boolean') {
            return value
        }
        var text = String(value).toLowerCase()
        if (text === 'true' || text === '1' || text === 'yes') {
            return true
        }
        if (text === 'false' || text === '0' || text === 'no') {
            return false
        }
        return null
    },

    /** ISO 8601 to the 'yyyy-MM-dd HH:mm:ss' form ServiceNow date/time fields expect (UTC). */
    toGlideDateTime: function (value) {
        var text = String(value)
        var match = text.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})/)
        if (match) {
            return match[1] + ' ' + match[2]
        }
        if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
            return text + ' 00:00:00'
        }
        return null
    },

    type: 'SecOpsFieldMapper',
}

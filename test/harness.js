'use strict'

/**
 * Loads ServiceNow script-include files into an emulation of the platform's script-include
 * execution context (Class.create, Object.extendsObject, gs, GlideRecord, sn_ws...).
 *
 * ponytail: hand-rolled doubles rather than a mocking framework - the platform surface these files
 * touch is small and explicit, and a fake that lies is worse than no fake at all.
 *
 * Files are evaluated in THIS realm (via Function) rather than a vm context, so values they create
 * share our Array/Object prototypes and assert.deepStrictEqual behaves normally.
 */

const fs = require('node:fs')
const path = require('node:path')

const SCRIPT_INCLUDE_DIR = path.join(__dirname, '..', 'src', 'script-includes')

/**
 * Finds any row in any table by sys_id. Used to model reference resolution (dot-walked queries,
 * getDisplayValue on a reference). Crude, but sys_ids are unique across test fixtures.
 */
function findBySysId(db, sysId) {
    if (!sysId) return null
    const tables = Object.keys(db)
    for (let i = 0; i < tables.length; i++) {
        const rows = db[tables[i]]
        if (!Array.isArray(rows)) continue
        const hit = rows.find((row) => String(row.sys_id) === String(sysId))
        if (hit) return hit
    }
    return null
}

/** Minimal in-memory GlideRecord double. Tables are plain arrays of plain objects. */
function createGlideRecordClass(db, schema, audit) {
    return function GlideRecord(tableName) {
        const columns = schema[tableName] || null
        const rows = () => db[tableName] || []

        // Resolves 'connector.active' by following the reference sys_id in `connector`.
        const readField = (row, field) => {
            if (String(field).indexOf('.') === -1) return row[field]
            const parts = String(field).split('.')
            let cursor = row
            for (let i = 0; i < parts.length - 1; i++) {
                cursor = findBySysId(db, cursor ? cursor[parts[i]] : null)
                if (!cursor) return undefined
            }
            return cursor[parts[parts.length - 1]]
        }

        this._table = tableName
        this._queries = []
        this._orderBy = null
        this._limit = null
        this._results = []
        this._cursor = -1
        this._current = null

        this.isValid = function () {
            return Object.prototype.hasOwnProperty.call(db, tableName)
        }
        this.isValidField = function (field) {
            if (!columns) return true
            return columns.indexOf(field) !== -1
        }
        // Returns a condition handle so addOrCondition() can attach alternatives to THIS clause,
        // matching the platform: addQuery(a).addOrCondition(b) means (a OR b) AND everything else.
        this.addQuery = function (field, operatorOrValue, maybeValue) {
            const hasOperator = maybeValue !== undefined
            const clause = {
                field: field,
                operator: hasOperator ? operatorOrValue : '=',
                value: hasOperator ? maybeValue : operatorOrValue,
                or: [],
            }
            this._queries.push(clause)
            return {
                addOrCondition: function (orField, orOperatorOrValue, orMaybeValue) {
                    const orHasOperator = orMaybeValue !== undefined
                    clause.or.push({
                        field: orField,
                        operator: orHasOperator ? orOperatorOrValue : '=',
                        value: orHasOperator ? orMaybeValue : orOperatorOrValue,
                    })
                    return this
                },
            }
        }
        this.addActiveQuery = function () {
            return this.addQuery('active', 'true')
        }
        this.addEncodedQuery = function (q) {
            this._queries.push({ encoded: q })
            return this
        }
        this.orderBy = function (field) {
            this._orderBy = { field: field, direction: 'asc' }
        }
        this.orderByDesc = function (field) {
            this._orderBy = { field: field, direction: 'desc' }
        }
        this.setLimit = function (limit) {
            this._limit = limit
        }
        this.query = function () {
            const self = this
            let matched = rows().filter((row) =>
                self._queries.every((q) => {
                    if (q.encoded) return true
                    if (matchClause(row, q)) return true
                    return (q.or || []).some((alternative) => matchClause(row, alternative))
                })
            )

            function matchClause(row, q) {
                const actual = readField(row, q.field)
                switch (q.operator) {
                    case '=':
                        return String(actual) === String(q.value)
                    case '!=':
                        return String(actual) !== String(q.value)
                    case 'IN':
                        return String(q.value).split(',').indexOf(String(actual)) !== -1
                    case '<':
                        return Number(actual) < Number(q.value)
                    case '>':
                        return Number(actual) > Number(q.value)
                    case 'ISNOTEMPTY':
                        return actual !== undefined && actual !== null && actual !== ''
                    default:
                        return String(actual) === String(q.value)
                }
            }

            if (this._orderBy) {
                const field = this._orderBy.field
                const direction = this._orderBy.direction
                matched = matched.slice().sort((a, b) => {
                    if (a[field] === b[field]) return 0
                    const less = a[field] < b[field] ? -1 : 1
                    return direction === 'desc' ? -less : less
                })
            }
            if (this._limit !== null) {
                matched = matched.slice(0, this._limit)
            }
            this._results = matched
            this._cursor = -1
        }
        this.next = function () {
            this._cursor += 1
            if (this._cursor < this._results.length) {
                this._current = this._results[this._cursor]
                return true
            }
            this._current = null
            return false
        }
        this.hasNext = function () {
            return this._cursor + 1 < this._results.length
        }
        this.getRowCount = function () {
            return this._results.length
        }
        this.get = function (fieldOrSysId, maybeValue) {
            const field = maybeValue === undefined ? 'sys_id' : fieldOrSysId
            const value = maybeValue === undefined ? fieldOrSysId : maybeValue
            const hit = rows().find((row) => String(row[field]) === String(value))
            this._current = hit || null
            return Boolean(hit)
        }
        this.initialize = function () {
            this._current = {}
        }
        this.newRecord = function () {
            this.initialize()
        }
        this.getValue = function (field) {
            if (!this._current) return null
            // A journal field has no column value on the platform - getValue() returns the empty
            // journal input. Modelled so reading one with getValue() fails here too.
            if (((schema.__journal || {})[tableName] || []).indexOf(field) !== -1) {
                return null
            }
            const value = this._current[field]
            return value === undefined || value === null ? null : String(value)
        }
        this.setValue = function (field, value) {
            if (!this._current) this.initialize()
            this._current[field] = value
        }
        this.getUniqueValue = function () {
            return this._current ? this._current.sys_id || null : null
        }
        this.getTableName = function () {
            return tableName
        }
        // Models a reference field's display value: follow the sys_id and return the target's
        // name. This is what makes a sys_id-vs-name mix-up visible in a test.
        this.getDisplayValue = function (field) {
            const raw = this.getValue(field)
            if (!raw) return raw
            const referenced = findBySysId(db, raw)
            if (referenced && referenced !== this._current) {
                return referenced.name !== undefined ? String(referenced.name) : raw
            }
            return raw
        }

        // Journal fields live in sys_journal_field, so getValue() returns the empty input. Only
        // getElement(field).getJournalEntry(n) returns entries - modelled here so a test can tell
        // the difference.
        this.getElement = function (field) {
            const current = this._current
            const journal = (schema.__journal || {})[tableName] || []
            const isJournal = journal.indexOf(field) !== -1
            return {
                getJournalEntry: function () {
                    if (!current || !isJournal) return ''
                    return current['__journal_' + field] || ''
                },
                toString: function () {
                    return current && !isJournal ? String(current[field] || '') : ''
                },
            }
        }
        this.insert = function () {
            if (!this._current) return null
            const sysId = this._current.sys_id || 'sys_' + Math.random().toString(16).slice(2, 14)
            this._current.sys_id = sysId
            if (!db[tableName]) db[tableName] = []
            if (db[tableName].indexOf(this._current) === -1) {
                db[tableName].push(this._current)
            }
            audit.push({ op: 'insert', table: tableName, data: this._current })
            return sysId
        }
        this.update = function () {
            if (!this._current) return null
            audit.push({ op: 'update', table: tableName, data: this._current })
            return this._current.sys_id || null
        }
        this.deleteRecord = function () {
            audit.push({ op: 'delete', table: tableName, data: this._current })
            return true
        }
        this.canCreate = function () {
            return (schema.__denyCreate || []).indexOf(tableName) === -1
        }
        this.canWrite = function () {
            return (schema.__denyWrite || []).indexOf(tableName) === -1
        }
        this.canRead = function () {
            return (schema.__denyRead || []).indexOf(tableName) === -1
        }
        this.canDelete = function () {
            return true
        }
        this.setWorkflow = function () {}
        this.autoSysFields = function () {}
        this.setAbortAction = function () {}
    }
}

/**
 * Evaluates the named script-include files and returns both the defined classes and the recorded
 * side effects (logs, REST calls, record writes) so tests can assert on behaviour.
 */
function loadScriptIncludes(fileNames, options) {
    const opts = options || {}
    const db = opts.db || {}
    const schema = opts.schema || {}
    const properties = opts.properties || {}
    const logs = []
    const restCalls = []
    const audit = []

    const GlideRecordDouble = createGlideRecordClass(db, schema, audit)

    function GlideDateTimeDouble(value) {
        this._value = value || '2026-09-11 12:00:00'
        this.getValue = function () {
            return this._value
        }
        this.getDisplayValue = function () {
            return this._value
        }
        this.getNumericValue = function () {
            return Date.parse(String(this._value).replace(' ', 'T') + 'Z') || 0
        }
        this.addSeconds = function (seconds) {
            const next = new Date((this.getNumericValue() || 0) + seconds * 1000)
            this._value = next.toISOString().replace('T', ' ').substring(0, 19)
        }
        this.toString = function () {
            return this._value
        }
    }

    const gs = {
        info: (msg) => logs.push({ level: 'info', msg: String(msg) }),
        warn: (msg) => logs.push({ level: 'warn', msg: String(msg) }),
        error: (msg) => logs.push({ level: 'error', msg: String(msg) }),
        debug: (msg) => logs.push({ level: 'debug', msg: String(msg) }),
        getProperty: (name, fallback) => {
            if (Object.prototype.hasOwnProperty.call(properties, name)) {
                return properties[name]
            }
            return fallback === undefined ? null : fallback
        },
        // Writes into the same map getProperty reads, so a property set during a test is visible
        // to the code that reads it back - which is the whole point of the CVE watch watermark.
        setProperty: (name, value) => {
            properties[name] = String(value)
            audit.push({ op: 'setProperty', name: name, value: String(value) })
            return true
        },
        generateGUID: () => 'guid' + Math.random().toString(16).slice(2, 14),
        getUserID: () => 'test_user_sys_id',
        getUserName: () => 'test.user',
        nil: (value) => value === null || value === undefined || value === '',
        tableExists: (name) => Object.prototype.hasOwnProperty.call(db, name),
        getMessage: (msg) => msg,
        eventQueue: function () {
            audit.push({ op: 'event', args: Array.prototype.slice.call(arguments) })
        },
    }

    const sn_ws = {
        RESTMessageV2: function () {
            const state = { headers: {}, endpoint: '', method: '', body: '', timeout: 0 }
            this.setEndpoint = (v) => {
                state.endpoint = v
            }
            this.setHttpMethod = (v) => {
                state.method = v
            }
            this.setRequestHeader = (k, v) => {
                state.headers[k] = v
            }
            this.setRequestBody = (v) => {
                state.body = v
            }
            this.setHttpTimeout = (v) => {
                state.timeout = v
            }
            this.setAuthenticationProfile = (type, id) => {
                state.authProfile = { type: type, id: id }
            }
            this.setBasicAuth = (u, p) => {
                state.basicAuth = { user: u, password: p }
            }
            this.setMIDServer = (v) => {
                state.midServer = v
            }
            this.setEccParameter = () => {}
            this.execute = function () {
                restCalls.push(state)
                const scripted = opts.restResponder ? opts.restResponder(state, restCalls.length) : null
                const response = scripted || { status: 200, body: '{}' }
                if (response.throws) {
                    throw new Error(response.throws)
                }
                return {
                    getStatusCode: () => String(response.status),
                    getBody: () => response.body,
                    getErrorMessage: () => response.error || '',
                    getHeader: (name) => (response.headers || {})[name] || null,
                    haveError: () => Boolean(response.error),
                }
            }
        },
    }

    // ConnectionInfo exposes EXACTLY these four methods. Do not add convenience methods here:
    // an earlier version of this double invented getConnectionUrl(), and because production code
    // called it the whole suite passed over a bug that broke every alias-authenticated connector.
    // The double's job is to be as poor as the real API, not as convenient as we would like.
    const sn_cc = {
        ConnectionInfoProvider: function () {
            this.getConnectionInfo = function (aliasId) {
                const conn = (opts.connections || {})[aliasId]
                if (!conn) return null
                const dataMap = Object.assign({ connection_url: conn.url }, conn.attributes || {})
                return {
                    getAttribute: (name) => (name in dataMap ? dataMap[name] : null),
                    getCredentialAttribute: (name) => (conn.credentials || {})[name] || null,
                    getDataMap: () => dataMap,
                    getExtendedAttributes: () => conn.extended || {},
                }
            }
            this.getConnectionInfoByDomain = this.getConnectionInfo
        },
    }

    // GlideOAuthClient's documented surface. There is deliberately NO refreshToken() - it does not
    // exist on the platform (it is only a *parameter* of revokeToken).
    const sn_auth = {
        GlideOAuthClient: function () {
            this.getToken = () => (opts.oauth || {}).token || null
            this.requestToken = () => (opts.oauth || {}).requestToken || null
            this.requestTokenByRequest = () => (opts.oauth || {}).requestTokenByRequest || null
            this.revokeToken = () => null
        },
    }

    const globalNs = {
        GSLog: function (property, source) {
            this.logDebug = (m) => logs.push({ level: 'debug', source: source, msg: String(m) })
            this.logInfo = (m) => logs.push({ level: 'info', source: source, msg: String(m) })
            this.logWarning = (m) => logs.push({ level: 'warn', source: source, msg: String(m) })
            this.logErr = (m) => logs.push({ level: 'error', source: source, msg: String(m) })
            this.includesLevel = () => true
        },
        AbstractAjaxProcessor: function () {},
    }

    const ClassDouble = {
        create: function () {
            function Ctor() {
                if (typeof this.initialize === 'function') {
                    this.initialize.apply(this, arguments)
                }
            }
            return Ctor
        },
    }

    // The platform exposes Object.extendsObject globally; mirror it for the duration of the run.
    if (typeof Object.extendsObject !== 'function') {
        Object.extendsObject = function (parent, proto) {
            const parentProto = parent && parent.prototype ? parent.prototype : parent
            const merged = Object.create(parentProto || Object.prototype)
            Object.keys(proto).forEach((key) => {
                merged[key] = proto[key]
            })
            return merged
        }
    }

    const sources = []
    const classNames = []
    fileNames.forEach((fileName) => {
        const full = path.join(SCRIPT_INCLUDE_DIR, fileName)
        const code = fs.readFileSync(full, 'utf8')
        sources.push('//# ' + fileName + '\n' + code)
        const pattern = /var\s+([A-Za-z0-9_]+)\s*=\s*Class\.create\(\)/g
        let match = pattern.exec(code)
        while (match !== null) {
            if (classNames.indexOf(match[1]) === -1) {
                classNames.push(match[1])
            }
            match = pattern.exec(code)
        }
    })

    const returnLiteral = '{' + classNames.map((n) => JSON.stringify(n) + ':' + n).join(',') + '}'
    const body = '"use strict";\n' + sources.join('\n;\n') + '\n;return ' + returnLiteral + ';'

    // eslint-disable-next-line no-new-func
    const factory = new Function('Class', 'GlideRecord', 'GlideRecordSecure', 'GlideDateTime', 'gs', 'sn_ws', 'sn_cc', 'sn_auth', 'global', body)

    const classes = factory(ClassDouble, GlideRecordDouble, GlideRecordDouble, GlideDateTimeDouble, gs, sn_ws, sn_cc, sn_auth, globalNs)

    return Object.assign({}, classes, {
        _db: db,
        _logs: logs,
        _restCalls: restCalls,
        _audit: audit,
        _properties: properties,
        _gs: gs,
    })
}

module.exports = { loadScriptIncludes, SCRIPT_INCLUDE_DIR, createGlideRecordClass }

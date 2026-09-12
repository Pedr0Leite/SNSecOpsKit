/**
 * SecOpsWorkQueue - the unified "what needs my attention" view behind the console.
 *
 * Merges three sources into one normalised row shape:
 *   - Security Incidents      sn_si_incident
 *   - Security Incident Tasks sn_si_task
 *   - Vulnerability findings  x_335329_secops_vuln_stage
 *
 * Everything is read with GlideRecordSecure: this is user-facing data, and an analyst must see
 * exactly what their ACLs allow and nothing more. A source that is absent (SIR not installed) is
 * skipped rather than throwing, so the console degrades to whatever the instance actually has.
 */
var SecOpsWorkQueue = Class.create()

SecOpsWorkQueue.prototype = {
    initialize: function () {
        this.registry = new SecOpsRegistry()
        this.log = new SecOpsLog('SecOpsWorkQueue')
    },

    TABLE_INCIDENT: 'sn_si_incident',
    TABLE_TASK: 'sn_si_task',
    TABLE_GROUP_MEMBER: 'sys_user_grmember',

    /** Hard ceiling per source. The console is a triage surface, not an export tool. */
    MAX_PER_SOURCE: 200,

    SEVERITY_ORDER: ['critical', 'high', 'medium', 'low', 'info'],

    /**
     * @param options { scope: 'me'|'team'|'all', sources: ['sir','findings'], severities: [],
     *                  search: string, limit: number }
     * @returns { rows, summary, truncated, scope, groups }
     */
    list: function (options) {
        var opts = options || {}
        var scope = opts.scope === 'team' || opts.scope === 'all' ? opts.scope : 'me'
        var sources = opts.sources && opts.sources.length ? opts.sources : ['sir', 'findings']
        var limit = this.clampLimit(opts.limit)

        var userId = gs.getUserID()
        var groups = scope === 'team' ? this.myGroupIds() : []

        var rows = []
        if (sources.indexOf('sir') !== -1) {
            rows = rows.concat(this.readSirTable(this.TABLE_INCIDENT, 'incident', scope, userId, groups))
            rows = rows.concat(this.readSirTable(this.TABLE_TASK, 'task', scope, userId, groups))
        }
        if (sources.indexOf('findings') !== -1) {
            rows = rows.concat(this.readFindings(scope))
        }

        rows = this.applySeverityFilter(rows, opts.severities)
        rows = this.applySearch(rows, opts.search)
        rows = this.sortRows(rows)

        var summary = this.summarise(rows)
        var truncated = rows.length > limit

        return {
            rows: rows.slice(0, limit),
            summary: summary,
            truncated: truncated,
            total: rows.length,
            scope: scope,
            groups: groups.length,
        }
    },

    /**
     * The groups the current user belongs to.
     *
     * GlideUser.getMyGroups() is not callable from a scoped application, so membership is read
     * from sys_user_grmember directly.
     */
    myGroupIds: function () {
        var ids = []
        try {
            var gr = new GlideRecordSecure(this.TABLE_GROUP_MEMBER)
            if (!gr.isValid()) {
                return ids
            }
            gr.addQuery('user', gs.getUserID())
            gr.setLimit(200)
            gr.query()
            while (gr.next()) {
                var groupId = gr.getValue('group')
                if (groupId && ids.indexOf(groupId) === -1) {
                    ids.push(groupId)
                }
            }
        } catch (e) {
            this.log.warn('Unable to resolve group membership', { error: String(e) })
        }
        return ids
    },

    /** Reads one SIR table into normalised rows. Returns [] when the table is absent. */
    readSirTable: function (tableName, kind, scope, userId, groups) {
        var rows = []
        try {
            var gr = new GlideRecordSecure(tableName)
            if (!gr.isValid()) {
                return rows
            }

            gr.addQuery('active', true)
            this.applyScopeQuery(gr, scope, userId, groups)
            gr.orderByDesc('opened_at')
            gr.setLimit(this.MAX_PER_SOURCE)
            gr.query()

            while (gr.next()) {
                rows.push(this.sirRow(gr, kind, userId, groups))
            }
        } catch (e) {
            this.log.warn('Unable to read ' + tableName, { error: String(e) })
        }
        return rows
    },

    /**
     * 'me'   -> assigned to me
     * 'team' -> assigned to me OR to one of my groups (unassigned group work is the point)
     * 'all'  -> no ownership filter
     */
    applyScopeQuery: function (gr, scope, userId, groups) {
        if (scope === 'me') {
            gr.addQuery('assigned_to', userId)
            return
        }
        if (scope === 'team') {
            var condition = gr.addQuery('assigned_to', userId)
            if (groups.length > 0) {
                condition.addOrCondition('assignment_group', 'IN', groups.join(','))
            }
        }
    },

    sirRow: function (gr, kind, userId, groups) {
        var assignedTo = gr.getValue('assigned_to')
        var group = gr.getValue('assignment_group')
        var opened = gr.getValue('opened_at')

        return {
            sys_id: gr.getUniqueValue(),
            table: gr.getTableName(),
            kind: kind,
            number: gr.getValue('number'),
            title: gr.getValue('short_description') || '(no description)',
            severity: this.sirSeverity(gr),
            state: gr.getDisplayValue('state'),
            assigned_to: assignedTo ? gr.getDisplayValue('assigned_to') : null,
            assignment_group: group ? gr.getDisplayValue('assignment_group') : null,
            mine: Boolean(assignedTo) && assignedTo === userId,
            my_team: Boolean(group) && groups.indexOf(group) !== -1,
            opened: opened,
            dwell_hours: this.dwellHours(opened),
        }
    },

    /**
     * SIR severity is 1=High, 2=Medium, 3=Low - there is no critical tier on the field itself,
     * so a priority-1 record is elevated to critical. Anything unset is 'info' rather than a
     * guessed severity.
     */
    sirSeverity: function (gr) {
        if (gr.isValidField('priority') && String(gr.getValue('priority')) === '1') {
            return 'critical'
        }
        switch (String(gr.getValue('severity'))) {
            case '1':
                return 'high'
            case '2':
                return 'medium'
            case '3':
                return 'low'
            default:
                return 'info'
        }
    },

    /** Our own vulnerability findings. CI ownership is not modelled, so 'me'/'team' show none. */
    readFindings: function (scope) {
        var rows = []
        if (scope !== 'all') {
            return rows
        }
        try {
            var gr = new GlideRecordSecure(this.registry.TABLE_VULN_STAGE)
            if (!gr.isValid()) {
                return rows
            }
            gr.addQuery('state', '!=', 'promoted')
            gr.orderByDesc('last_seen')
            gr.setLimit(this.MAX_PER_SOURCE)
            gr.query()

            while (gr.next()) {
                var seen = gr.getValue('first_seen') || gr.getValue('last_seen')
                rows.push({
                    sys_id: gr.getUniqueValue(),
                    table: this.registry.TABLE_VULN_STAGE,
                    kind: 'finding',
                    number: gr.getValue('cve') || gr.getValue('external_id'),
                    title: gr.getValue('title') || gr.getValue('external_id'),
                    severity: this.findingSeverity(gr.getValue('severity')),
                    state: gr.getDisplayValue('state'),
                    assigned_to: null,
                    assignment_group: null,
                    mine: false,
                    my_team: false,
                    source: gr.getValue('source'),
                    ci: gr.getValue('ci_identifier'),
                    opened: seen,
                    dwell_hours: this.dwellHours(seen),
                })
            }
        } catch (e) {
            this.log.warn('Unable to read findings', { error: String(e) })
        }
        return rows
    },

    findingSeverity: function (value) {
        var text = String(value || '').toLowerCase()
        if (this.SEVERITY_ORDER.indexOf(text) !== -1) {
            return text
        }
        return text === 'informational' ? 'info' : 'info'
    },

    /** Whole hours since the record was opened. Null when there is no timestamp to measure from. */
    dwellHours: function (opened) {
        if (!opened) {
            return null
        }
        try {
            var then = new GlideDateTime(opened).getNumericValue()
            var now = new GlideDateTime().getNumericValue()
            if (!then || now <= then) {
                return 0
            }
            return Math.floor((now - then) / 3600000)
        } catch (e) {
            return null
        }
    },

    applySeverityFilter: function (rows, severities) {
        if (!severities || severities.length === 0) {
            return rows
        }
        var wanted = []
        for (var i = 0; i < severities.length; i++) {
            wanted.push(String(severities[i]).toLowerCase())
        }
        var filtered = []
        for (var r = 0; r < rows.length; r++) {
            if (wanted.indexOf(rows[r].severity) !== -1) {
                filtered.push(rows[r])
            }
        }
        return filtered
    },

    /** Case-insensitive contains across the fields an analyst would actually search. */
    applySearch: function (rows, search) {
        var term = String(search || '').replace(/^\s+|\s+$/g, '').toLowerCase()
        if (term === '') {
            return rows
        }
        var matched = []
        for (var i = 0; i < rows.length; i++) {
            var row = rows[i]
            var haystack = [row.number, row.title, row.assigned_to, row.assignment_group, row.ci, row.source]
                .join(' ')
                .toLowerCase()
            if (haystack.indexOf(term) !== -1) {
                matched.push(row)
            }
        }
        return matched
    },

    /** Most severe first, then longest dwelling - the order an analyst triages in. */
    sortRows: function (rows) {
        var order = this.SEVERITY_ORDER
        return rows.sort(function (a, b) {
            var bySeverity = order.indexOf(a.severity) - order.indexOf(b.severity)
            if (bySeverity !== 0) {
                return bySeverity
            }
            return (b.dwell_hours || 0) - (a.dwell_hours || 0)
        })
    },

    summarise: function (rows) {
        var summary = { total: rows.length, critical: 0, high: 0, medium: 0, low: 0, info: 0, mine: 0, unassigned: 0 }
        for (var i = 0; i < rows.length; i++) {
            var row = rows[i]
            if (summary[row.severity] !== undefined) {
                summary[row.severity]++
            }
            if (row.mine) {
                summary.mine++
            }
            if (!row.assigned_to && row.kind !== 'finding') {
                summary.unassigned++
            }
        }
        return summary
    },

    clampLimit: function (value) {
        var parsed = parseInt(value, 10)
        if (isNaN(parsed)) {
            return 100
        }
        return Math.max(1, Math.min(300, parsed))
    },

    type: 'SecOpsWorkQueue',
}

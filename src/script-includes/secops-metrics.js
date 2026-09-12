/**
 * SecOpsMetrics - organisation-wide aggregates for the security overview page.
 *
 * Every datum carries the table and encoded query that produced it, so the UI can drill into the
 * records behind a number.
 *
 * Scope note, and it matters: these counts come from GlideAggregate, which does NOT apply
 * record-level ACLs. That is deliberate. A security dashboard that quietly under-reports because
 * the viewer cannot see every record is actively dangerous - "3 criticals" when there are 12 is
 * worse than no number at all. The totals here are therefore true, and the control is the role gate
 * on the page and its API. No record content is returned: only counts, labels and queries.
 *
 * The drill-in that consumes these queries IS ACL-filtered (it runs through the Table API as the
 * signed-in user), so a restricted viewer will legitimately see fewer rows than the count claims.
 * The UI states that difference explicitly rather than letting the page look like it contradicts
 * itself.
 */
var SecOpsMetrics = Class.create()

SecOpsMetrics.prototype = {
    initialize: function () {
        this.registry = new SecOpsRegistry()
        this.log = new SecOpsLog('SecOpsMetrics')
    },

    TABLE_INCIDENT: 'sn_si_incident',

    /** Days of history for the trend charts. */
    TREND_DAYS: 14,

    /** Rows scanned when bucketing a trend. Enough for a busy SOC fortnight; flagged when hit. */
    TREND_SCAN_CAP: 5000,

    overview: function () {
        return {
            generated: new GlideDateTime().getValue(),
            incidents: this.incidentMetrics(),
            findings: this.findingMetrics(),
            integration: this.integrationMetrics(),
        }
    },

    // ------------------------------------------------------------- incidents
    incidentMetrics: function () {
        var table = this.TABLE_INCIDENT
        var result = {
            available: false,
            table: table,
            open: 0,
            open_query: 'active=true',
            by_severity: [],
            by_state: [],
            by_group: [],
            aging: [],
            trend: { labels: [], opened: [], truncated: false },
        }

        if (!new GlideRecord(table).isValid()) {
            return result
        }
        result.available = true
        result.open = this.count(table, 'active=true')

        // Severity mirrors the work queue's rule: priority 1 outranks the severity field.
        var severityQueries = [
            { key: 'critical', label: 'Critical', query: 'active=true^priority=1' },
            { key: 'high', label: 'High', query: 'active=true^priority!=1^severity=1' },
            { key: 'medium', label: 'Medium', query: 'active=true^priority!=1^severity=2' },
            { key: 'low', label: 'Low', query: 'active=true^priority!=1^severity=3' },
        ]
        var classified = 0
        for (var s = 0; s < severityQueries.length; s++) {
            var spec = severityQueries[s]
            var count = this.count(table, spec.query)
            classified += count
            result.by_severity.push(this.datum(spec.key, spec.label, count, table, spec.query))
        }
        result.by_severity.push(
            this.datum('info', 'Info', Math.max(0, result.open - classified), table, 'active=true^priority!=1^severityNOT IN1,2,3')
        )

        result.by_state = this.groupCount(table, 'active=true', 'state', 8, true)
        result.by_group = this.groupCount(table, 'active=true', 'assignment_group', 8, true)
        result.aging = this.agingBuckets(table)
        result.trend = this.dailyTrend(table, 'opened_at', null)

        return result
    },

    /** Open records bucketed by age. Four bounded counts - no scanning. */
    agingBuckets: function (table) {
        var now = new GlideDateTime()
        var day = this.daysAgo(now, 1)
        var threeDays = this.daysAgo(now, 3)
        var sevenDays = this.daysAgo(now, 7)

        var specs = [
            { key: 'under_24h', label: 'Under 24h', query: 'active=true^opened_at>=' + day },
            { key: 'd1_3', label: '1-3 days', query: 'active=true^opened_at<' + day + '^opened_at>=' + threeDays },
            { key: 'd3_7', label: '3-7 days', query: 'active=true^opened_at<' + threeDays + '^opened_at>=' + sevenDays },
            { key: 'over_7d', label: 'Over 7 days', query: 'active=true^opened_at<' + sevenDays },
        ]

        var buckets = []
        for (var i = 0; i < specs.length; i++) {
            buckets.push(this.datum(specs[i].key, specs[i].label, this.count(table, specs[i].query), table, specs[i].query))
        }
        return buckets
    },

    // -------------------------------------------------------------- findings
    findingMetrics: function () {
        var table = this.registry.TABLE_VULN_STAGE
        var result = {
            table: table,
            total: 0,
            by_severity: [],
            by_state: [],
            by_source: [],
            top_ci: [],
            unmatched_ci: 0,
            unmatched_ci_query: 'ciISEMPTY',
        }

        if (!new GlideRecord(table).isValid()) {
            return result
        }

        result.total = this.count(table, '')

        var severities = [
            { key: 'critical', label: 'Critical' },
            { key: 'high', label: 'High' },
            { key: 'medium', label: 'Medium' },
            { key: 'low', label: 'Low' },
            { key: 'informational', label: 'Info' },
            { key: 'unknown', label: 'Unknown' },
        ]
        for (var i = 0; i < severities.length; i++) {
            var query = 'severity=' + severities[i].key
            result.by_severity.push(
                this.datum(severities[i].key, severities[i].label, this.count(table, query), table, query)
            )
        }

        result.by_state = this.groupCount(table, '', 'state', 6, false)
        result.by_source = this.groupCount(table, '', 'source', 8, false)
        result.top_ci = this.groupCount(table, 'ci_identifierISNOTEMPTY', 'ci_identifier', 8, false)
        result.unmatched_ci = this.count(table, 'ciISEMPTY')

        return result
    },

    // ----------------------------------------------------------- integration
    /** The question no other dashboard can answer: is the tooling itself actually working? */
    integrationMetrics: function () {
        var connectorTable = this.registry.TABLE_CONNECTOR
        var txnTable = this.registry.TABLE_TRANSACTION

        var healthSpecs = [
            { key: 'healthy', label: 'Healthy', query: 'active=true^health_status=healthy' },
            { key: 'degraded', label: 'Degraded', query: 'active=true^health_status=degraded' },
            { key: 'down', label: 'Down', query: 'active=true^health_status=down' },
            { key: 'unknown', label: 'Unknown', query: 'active=true^health_statusIN,unknown' },
            { key: 'inactive', label: 'Inactive', query: 'active=false' },
        ]
        var connectors = []
        var connectorTotals = { total: 0, healthy: 0, degraded: 0, down: 0, unknown: 0, inactive: 0 }
        for (var h = 0; h < healthSpecs.length; h++) {
            var spec = healthSpecs[h]
            var value = this.count(connectorTable, spec.query)
            connectorTotals[spec.key] = value
            connectorTotals.total += value
            connectors.push(this.datum(spec.key, spec.label, value, connectorTable, spec.query))
        }

        var outcomeSpecs = [
            { key: 'success', label: 'Success', query: 'state=success' },
            { key: 'failed', label: 'Failed', query: 'state=failed' },
            { key: 'retry_pending', label: 'Retrying', query: 'state=retry_pending' },
        ]
        var outcomes = []
        var totals = { success: 0, failed: 0, retry_pending: 0 }
        for (var o = 0; o < outcomeSpecs.length; o++) {
            var outcome = outcomeSpecs[o]
            var outcomeCount = this.count(txnTable, outcome.query)
            totals[outcome.key] = outcomeCount
            outcomes.push(this.datum(outcome.key, outcome.label, outcomeCount, txnTable, outcome.query))
        }
        var settled = totals.success + totals.failed

        return {
            table: txnTable,
            connector_table: connectorTable,
            connectors: connectors,
            connector_totals: connectorTotals,
            outcomes: outcomes,
            transactions: {
                total: this.count(txnTable, ''),
                success: totals.success,
                failed: totals.failed,
                retry_pending: totals.retry_pending,
                success_rate: settled > 0 ? Math.round((totals.success / settled) * 100) : null,
                avg_duration_ms: this.average(txnTable, 'state=success', 'duration_ms'),
            },
            by_capability: this.groupCount(txnTable, '', 'capability', 8, false),
            trend: this.dailyTrend(txnTable, 'sys_created_on', 'state'),
        }
    },

    // ------------------------------------------------------------- utilities
    /**
     * Daily counts over TREND_DAYS in one bounded scan.
     *
     * When `splitField` is 'state', results are split into ok/failed so the throughput chart can
     * show both. Otherwise everything lands in `opened`.
     */
    dailyTrend: function (table, dateField, splitField) {
        var labels = []
        var opened = []
        var ok = []
        var failed = []
        var index = {}

        var now = new GlideDateTime()
        for (var d = this.TREND_DAYS - 1; d >= 0; d--) {
            var key = this.daysAgo(now, d).substring(0, 10)
            index[key] = labels.length
            labels.push(key.substring(5))
            opened.push(0)
            ok.push(0)
            failed.push(0)
        }

        var truncated = false
        try {
            var gr = new GlideRecord(table)
            if (!gr.isValid()) {
                return { labels: labels, opened: opened, ok: ok, failed: failed, truncated: false }
            }
            gr.addQuery(dateField, '>=', this.daysAgo(now, this.TREND_DAYS - 1))
            gr.setLimit(this.TREND_SCAN_CAP)
            gr.query()

            var scanned = 0
            while (gr.next()) {
                scanned++
                var day = String(gr.getValue(dateField) || '').substring(0, 10)
                if (index[day] === undefined) {
                    continue
                }
                opened[index[day]]++
                if (splitField) {
                    var state = gr.getValue(splitField)
                    if (state === 'success') {
                        ok[index[day]]++
                    } else if (state === 'failed') {
                        failed[index[day]]++
                    }
                }
            }
            truncated = scanned === this.TREND_SCAN_CAP
        } catch (e) {
            this.log.warn('Trend scan failed', { table: table, error: String(e) })
        }

        return { labels: labels, opened: opened, ok: ok, failed: failed, truncated: truncated }
    },

    datum: function (key, label, count, table, query) {
        return { key: key, label: label, count: count, table: table, query: query }
    },

    count: function (table, encodedQuery) {
        try {
            var agg = new GlideAggregate(table)
            if (encodedQuery) {
                agg.addEncodedQuery(encodedQuery)
            }
            agg.addAggregate('COUNT')
            agg.query()
            return agg.next() ? parseInt(agg.getAggregate('COUNT'), 10) || 0 : 0
        } catch (e) {
            this.log.warn('Count failed', { table: table, query: encodedQuery, error: String(e) })
            return 0
        }
    },

    /**
     * Top N groups by count. `resolve` returns display values for reference fields.
     *
     * A value containing '^' or ',' cannot be expressed safely in an encoded query, so that datum
     * is returned without one - the UI renders it as a non-clickable bar rather than building a
     * query that would silently match the wrong records.
     */
    groupCount: function (table, encodedQuery, field, limit, resolve) {
        var rows = []
        try {
            var agg = new GlideAggregate(table)
            if (encodedQuery) {
                agg.addEncodedQuery(encodedQuery)
            }
            agg.addAggregate('COUNT')
            agg.groupBy(field)
            agg.orderByAggregate('COUNT')
            agg.query()

            while (agg.next()) {
                var raw = agg.getValue(field)
                var label = resolve ? agg.getDisplayValue(field) || raw || '(none)' : raw || '(none)'
                var query = this.safeFieldQuery(encodedQuery, field, raw)
                rows.push({
                    key: raw,
                    label: label,
                    count: parseInt(agg.getAggregate('COUNT'), 10) || 0,
                    table: table,
                    query: query,
                })
            }
        } catch (e) {
            this.log.warn('Group count failed', { table: table, field: field, error: String(e) })
            return []
        }

        rows.sort(function (a, b) {
            return b.count - a.count
        })
        return rows.slice(0, limit || 8)
    },

    safeFieldQuery: function (basePrefix, field, value) {
        var text = value === null || value === undefined ? '' : String(value)
        if (text.indexOf('^') !== -1 || text.indexOf(',') !== -1) {
            return null
        }
        var clause = text === '' ? field + 'ISEMPTY' : field + '=' + text
        return basePrefix ? basePrefix + '^' + clause : clause
    },

    average: function (table, encodedQuery, field) {
        try {
            var agg = new GlideAggregate(table)
            if (encodedQuery) {
                agg.addEncodedQuery(encodedQuery)
            }
            agg.addAggregate('AVG', field)
            agg.query()
            if (!agg.next()) {
                return null
            }
            var value = parseFloat(agg.getAggregate('AVG', field))
            return isNaN(value) ? null : Math.round(value)
        } catch (e) {
            return null
        }
    },

    daysAgo: function (from, days) {
        var when = new GlideDateTime(from.getValue())
        when.addSeconds(-1 * days * 86400)
        return when.getValue()
    },

    type: 'SecOpsMetrics',
}

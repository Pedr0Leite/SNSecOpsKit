/**
 * GET /api/x_335329_secops/secops_console/work
 *
 * The unified work queue behind the dashboard: SIR incidents, SIR tasks and vulnerability
 * findings, normalised into one row shape with a severity summary.
 *
 * Query parameters:
 *   scope       me | team | all          (default me)
 *   sources     comma list: sir,findings (default both)
 *   severities  comma list of severities (default all)
 *   q           free-text search
 *   limit       1-300                    (default 100)
 */
;(function process(request, response) {
    var log = new SecOpsLog('ConsoleWorkApi')

    function firstParam(name) {
        var params = request.queryParams || {}
        var value = params[name]
        if (value === undefined || value === null) {
            return null
        }
        if (Object.prototype.toString.call(value) === '[object Array]') {
            return value.length > 0 ? String(value[0]) : null
        }
        return String(value)
    }

    function listParam(name) {
        var raw = firstParam(name)
        if (!raw) {
            return []
        }
        var parts = raw.split(',')
        var out = []
        for (var i = 0; i < parts.length; i++) {
            var trimmed = parts[i].replace(/^\s+|\s+$/g, '')
            if (trimmed !== '') {
                out.push(trimmed)
            }
        }
        return out
    }

    try {
        var result = new SecOpsWorkQueue().list({
            scope: firstParam('scope'),
            sources: listParam('sources'),
            severities: listParam('severities'),
            search: firstParam('q'),
            limit: firstParam('limit'),
        })

        response.setStatus(200)
        response.setBody({
            ok: true,
            rows: result.rows,
            summary: result.summary,
            total: result.total,
            truncated: result.truncated,
            scope: result.scope,
            // Surfaced so "my team" can say it found no groups rather than silently behaving
            // like "assigned to me" - the two are indistinguishable to a user otherwise.
            groups: result.groups,
            user: { name: gs.getUserName(), sys_id: gs.getUserID() },
        })
    } catch (e) {
        log.error('Work queue query failed', { error: String(e) })
        response.setStatus(500)
        response.setBody({ ok: false, error: 'Unable to load the work queue. Check the application logs.' })
    }
})(request, response)

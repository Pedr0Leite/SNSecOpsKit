/**
 * GET /api/x_335329_secops/secops_console/overview
 *
 * Organisation-wide security posture and integration health for the overview page.
 *
 * Returns counts only - no record content - and is gated to the SecOps viewer role. See
 * SecOpsMetrics for why aggregates here are role-gated rather than per-record ACL filtered.
 */
;(function process(request, response) {
    var log = new SecOpsLog('ConsoleOverviewApi')

    try {
        var metrics = new SecOpsMetrics().overview()
        response.setStatus(200)
        response.setBody({
            ok: true,
            metrics: metrics,
            // The client needs this to scope its layout preference. Writing a sys_user_preference
            // without an explicit user creates a GLOBAL preference - one person's dashboard layout
            // would silently become the default for everyone.
            user: { name: gs.getUserName(), sys_id: gs.getUserID() },
        })
    } catch (e) {
        log.error('Overview metrics failed', { error: String(e) })
        response.setStatus(500)
        response.setBody({ ok: false, error: 'Unable to build the overview. Check the application logs.' })
    }
})(request, response)

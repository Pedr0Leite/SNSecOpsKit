/**
 * Async business rule template - enrich an observable when it is attached to a security incident.
 *
 * Shipped INACTIVE on purpose. Automatic enrichment spends third-party API quota on every
 * observable an analyst touches; that has to be a deliberate decision, not a surprise after
 * install. Enable it here AND set x_335329_secops.enrichment.auto_enabled to true.
 *
 * Table:  sn_ti_m2m_task_observable
 * When:   after insert, async
 */
;(function executeRule(current, previous) {
    if (gs.getProperty('x_335329_secops.enrichment.auto_enabled', 'false') !== 'true') {
        return
    }

    var observableId = current.getValue('observable')
    var taskId = current.getValue('task')
    if (!observableId) {
        return
    }

    try {
        var result = new SecOpsThreatIntelHandler().enrichObservable(observableId, { rollup: true, secure: false })

        if (!result.ok) {
            gs.warn(
                '[SecOpsUniversal] Enrichment failed for observable ' + observableId + ' on task ' + taskId + ': ' + result.error
            )
            return
        }

        gs.info(
            '[SecOpsUniversal] Enriched observable ' +
                observableId +
                ' (' +
                result.value +
                ') - finding ' +
                result.finding +
                ' from ' +
                result.results.length +
                ' source(s)'
        )
    } catch (e) {
        // An enrichment failure must never roll back the analyst's action that triggered it.
        gs.error('[SecOpsUniversal] Unhandled enrichment error for observable ' + observableId + ': ' + e)
    }
})(current, previous)

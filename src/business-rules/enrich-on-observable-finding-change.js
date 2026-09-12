/**
 * Async business rule template - re-enrich an observable when its finding changes.
 *
 * Shipped INACTIVE on purpose (see enrich-on-observable-link.js).
 *
 * Table:  sn_ti_observable
 * When:   after update, async
 * Filter: Finding changes
 *
 * The guard below is what stops an infinite loop: the handler's own roll-up writes `finding`, so
 * without it this rule would re-trigger itself forever.
 */
;(function executeRule(current, previous) {
    if (gs.getProperty('x_335329_secops.enrichment.auto_enabled', 'false') !== 'true') {
        return
    }

    var observableId = current.getUniqueValue()
    var newFinding = current.getValue('finding')
    var oldFinding = previous ? previous.getValue('finding') : null

    if (newFinding === oldFinding) {
        return
    }

    // Only an analyst moving an observable back to Unknown should trigger a fresh lookup. Any
    // other transition is very likely this framework's own roll-up writing the verdict back.
    if (newFinding !== 'Unknown') {
        return
    }

    try {
        var result = new SecOpsThreatIntelHandler().enrichObservable(observableId, { rollup: true, secure: false })

        if (!result.ok) {
            gs.warn('[SecOpsUniversal] Re-enrichment failed for observable ' + observableId + ': ' + result.error)
            return
        }

        gs.info('[SecOpsUniversal] Re-enriched observable ' + observableId + ' - finding ' + result.finding)
    } catch (e) {
        gs.error('[SecOpsUniversal] Unhandled re-enrichment error for observable ' + observableId + ': ' + e)
    }
})(current, previous)

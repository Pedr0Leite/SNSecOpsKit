/**
 * Scheduled job - poll every active connector and record its health.
 *
 * Keeps the console meaningful without a user clicking "Test" on each connector, and surfaces a
 * credential that expired overnight before an analyst hits it mid-investigation.
 */
;(function runHealthSweep() {
    var log = new SecOpsLog('ConnectorHealthSweep')

    try {
        var summary = new SecOpsHealthChecker().checkAll()
        log.info('Connector health sweep finished', summary)
    } catch (e) {
        log.error('Connector health sweep failed', { error: String(e) })
    }
})()

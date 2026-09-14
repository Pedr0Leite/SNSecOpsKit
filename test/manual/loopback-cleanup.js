/**
 * Removes everything loopback-selftest.js creates.
 *
 * Only needed if you ran the self-test with CLEAN_UP = false.
 *
 * HOW TO RUN
 *   System Definition > Scripts - Background
 *   Scope: SecOps Universal Connector Framework
 *
 * Transactions are removed too, so run this only once you have finished reading them. It matches
 * on the self-test's own marker and source name, so it cannot touch real configuration.
 */
;(function cleanUpSelfTest() {
    var MARKER = 'SecOps self-test - safe to delete'
    var SOURCE = 'SecOpsSelfTest'

    var registry = new SecOpsRegistry()
    var removed = { endpoints: 0, connectors: 0, staged: 0, transactions: 0 }

    // Endpoints first: the connector cascade would take them anyway, but deleting them explicitly
    // keeps the count honest.
    var endpoints = new GlideRecord(registry.TABLE_ENDPOINT)
    endpoints.addQuery('description', MARKER)
    endpoints.query()
    while (endpoints.next()) {
        // Transactions reference the endpoint with cascadeRule 'none', so clear them first.
        var txn = new GlideRecord(registry.TABLE_TRANSACTION)
        txn.addQuery('endpoint', endpoints.getUniqueValue())
        txn.query()
        while (txn.next()) {
            if (txn.deleteRecord()) {
                removed.transactions++
            }
        }
        if (endpoints.deleteRecord()) {
            removed.endpoints++
        }
    }

    var connectors = new GlideRecord(registry.TABLE_CONNECTOR)
    connectors.addQuery('description', MARKER)
    connectors.query()
    while (connectors.next()) {
        var connectorTxn = new GlideRecord(registry.TABLE_TRANSACTION)
        connectorTxn.addQuery('connector', connectors.getUniqueValue())
        connectorTxn.query()
        while (connectorTxn.next()) {
            if (connectorTxn.deleteRecord()) {
                removed.transactions++
            }
        }
        if (connectors.deleteRecord()) {
            removed.connectors++
        }
    }

    var staged = new GlideRecord(registry.TABLE_VULN_STAGE)
    staged.addQuery('source', SOURCE)
    staged.query()
    while (staged.next()) {
        if (staged.deleteRecord()) {
            removed.staged++
        }
    }

    gs.info(
        'Self-test cleanup: removed ' + removed.connectors + ' connectors, ' + removed.endpoints +
            ' endpoints, ' + removed.staged + ' staged rows, ' + removed.transactions + ' transactions.'
    )
})()

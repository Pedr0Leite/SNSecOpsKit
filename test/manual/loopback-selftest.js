/**
 * SecOps Universal Connector Framework - harmless end-to-end self-test.
 *
 * HOW TO RUN
 *   System Definition > Scripts - Background
 *   Set the scope selector to "SecOps Universal Connector Framework" FIRST.
 *   Paste this whole file, then Run script.
 *
 * The infrastructure script includes are package_private, so in global scope this fails
 * immediately with "SecOpsRegistry is not defined". That is the scope selector, not a bug.
 *
 * WHAT IT TOUCHES
 *   - Creates two temporary connectors and four endpoints in this application's own tables.
 *   - Stages a handful of fake vulnerability findings.
 *   - Makes outbound calls to postman-echo.com and httpbin.org - public request reflectors that
 *     echo back whatever you send them. No credentials, no third-party account, no side effects.
 *   - Every invented hostname is prefixed "selftest-". Every invented IP is inside 192.0.2.0/24
 *     (RFC 5737 TEST-NET-1, reserved for documentation and routed nowhere).
 *
 * It reads no real security data and writes to no SecOps module table.
 *
 * With CLEAN_UP = true it deletes everything it created except the transaction log, which is the
 * evidence. Set it to false to inspect the records, then run loopback-cleanup.js afterwards.
 */
;(function secOpsSelfTest() {
    var CLEAN_UP = true

    var MARKER = 'SecOps self-test - safe to delete'
    var SOURCE = 'SecOpsSelfTest'
    var ECHO = 'https://postman-echo.com'
    var STATUS_500 = 'https://httpbin.org/status/500'
    var STATUS_429 = 'https://httpbin.org/status/429'

    var registry = new SecOpsRegistry()
    var results = []
    var created = { connectors: [], endpoints: [] }

    // ---------------------------------------------------------------- harness

    function check(name, passed, detail) {
        results.push({ name: name, passed: Boolean(passed), detail: detail || '' })
        gs.info((passed ? '  PASS  ' : '  FAIL  ') + name + (detail ? '  --  ' + detail : ''))
    }

    function skip(name, why) {
        results.push({ name: name, skipped: true, detail: why })
        gs.info('  SKIP  ' + name + '  --  ' + why)
    }

    function insert(table, values) {
        var gr = new GlideRecord(table)
        gr.initialize()
        var keys = Object.keys(values)
        for (var i = 0; i < keys.length; i++) {
            gr.setValue(keys[i], values[keys[i]])
        }
        return gr.insert()
    }

    function deleteWhere(table, field, value) {
        var removed = 0
        var gr = new GlideRecord(table)
        if (!gr.isValid()) {
            return 0
        }
        gr.addQuery(field, value)
        gr.query()
        while (gr.next()) {
            if (gr.deleteRecord()) {
                removed++
            }
        }
        return removed
    }

    function countStaged() {
        var gr = new GlideRecord(registry.TABLE_VULN_STAGE)
        gr.addQuery('source', SOURCE)
        gr.query()
        return gr.getRowCount()
    }

    // ------------------------------------------------------- test fixtures

    gs.info('=== SecOps Universal Connector - self-test ===')
    gs.info('Creating temporary configuration...')

    var echoConnector = insert(registry.TABLE_CONNECTOR, {
        name: 'Self-test echo connector',
        vendor: 'Postman Echo',
        category: 'other',
        active: true,
        base_url: ECHO,
        auth_type: 'none',
        http_timeout_ms: 20000,
        max_retries: 2,
        health_endpoint_path: '/status/200',
        description: MARKER,
    })
    created.connectors.push(echoConnector)

    var brokenConnector = insert(registry.TABLE_CONNECTOR, {
        name: 'Self-test degraded connector',
        vendor: 'httpbin',
        category: 'other',
        active: true,
        base_url: 'https://httpbin.org',
        auth_type: 'none',
        http_timeout_ms: 20000,
        max_retries: 0,
        // No health endpoint record: this also exercises the synthetic health probe fallback.
        health_endpoint_path: '/status/500',
        description: MARKER,
    })
    created.connectors.push(brokenConnector)

    created.endpoints.push(
        insert(registry.TABLE_ENDPOINT, {
            name: 'Self-test health probe',
            connector: echoConnector,
            capability: 'health',
            active: true,
            http_method: 'get',
            path: '/status/200',
            success_codes: '200',
            description: MARKER,
        })
    )

    created.endpoints.push(
        insert(registry.TABLE_ENDPOINT, {
            name: 'Self-test containment',
            connector: echoConnector,
            capability: 'contain',
            active: true,
            http_method: 'post',
            path: '/post',
            request_template:
                '{"action":"${action}","target_type":"${target_type}","target":"${target_value}","reason":"${reason}"}',
            response_root: 'json',
            success_codes: '200',
            description: MARKER,
        })
    )

    var backpressureEndpoint = insert(registry.TABLE_ENDPOINT, {
        name: 'Self-test back-pressure',
        connector: echoConnector,
        capability: 'custom',
        active: true,
        http_method: 'get',
        // Absolute URLs override the connector base URL entirely.
        path: STATUS_429,
        success_codes: '200',
        description: MARKER,
    })
    created.endpoints.push(backpressureEndpoint)

    gs.info('Running checks...')

    // ---------------------------------------------- 1 & 2: health checking

    var healthy = new SecOpsHealthChecker().check(echoConnector)
    check(
        '1. Health check against a reachable endpoint reports healthy',
        healthy.health === 'healthy',
        'health=' + healthy.health + ' status=' + healthy.status + ' msg=' + healthy.message
    )

    var networkUp = healthy.status !== 0

    if (networkUp) {
        var degraded = new SecOpsHealthChecker().check(brokenConnector)
        check(
            '2. HTTP 500 classifies as degraded, not down (it answered)',
            degraded.health === 'degraded',
            'health=' + degraded.health + ' status=' + degraded.status
        )
    } else {
        skip('2. HTTP 500 classifies as degraded', 'no outbound network from this instance')
    }

    // ------------------------------------------------------- 3-5: containment

    var containment = new SecOpsContainmentHandler()

    if (networkUp) {
        var contained = containment.contain(
            {
                target_type: 'host',
                target_value: 'selftest-host-01',
                action: 'isolate',
                reason: 'Automated self-test - no real host was contacted',
            },
            { connector: echoConnector }
        )
        check(
            '3. Containment call completes and logs a transaction',
            contained.ok && Boolean(contained.transaction),
            'ok=' + contained.ok + ' status=' + contained.status + ' txn=' + contained.transaction +
                (contained.error ? ' error=' + contained.error : '')
        )

        // The echo service hands the rendered body back, so this proves template substitution
        // actually produced the values we asked for.
        var echoed = contained.payload || {}
        check(
            '3b. Template placeholders resolved in the outbound body',
            echoed.target === 'selftest-host-01' && echoed.action === 'isolate',
            'echoed=' + new SecOpsJson().stringify(echoed)
        )
    } else {
        skip('3. Containment call completes', 'no outbound network from this instance')
        skip('3b. Template placeholders resolved', 'no outbound network from this instance')
    }

    var noTarget = containment.contain({ target_type: 'host', action: 'isolate' }, { connector: echoConnector })
    check(
        '4. Containment with no target is refused before any HTTP happens',
        !noTarget.ok && noTarget.status === 0 && String(noTarget.error).indexOf('target value') !== -1,
        'error=' + noTarget.error
    )

    var badType = containment.contain(
        { target_type: 'spaceship', target_value: 'selftest-host-02', action: 'isolate' },
        { connector: echoConnector }
    )
    check(
        '5. Containment with an unknown target type is rejected',
        !badType.ok && String(badType.error).indexOf('Unsupported target type') !== -1,
        'error=' + badType.error
    )

    // -------------------------------------------------------- 6-9: ingestion

    var ingestion = new SecOpsVulnIngestionHandler()

    var batch = [
        {
            id: 'SELFTEST-1',
            cve: 'CVE-2026-99001',
            title: 'Self-test finding - fictional TLS weakness',
            severity: 'high',
            cvss_score: 7.4,
            host: 'selftest-host-01',
        },
        {
            qid: 'SELFTEST-2',
            vulnerability_id: 'CVE-2026-99002',
            synopsis: 'Self-test finding - convention-mapped scanner shape',
            risk: '3',
            base_score: 6.1,
            ip: '192.0.2.10',
        },
        {
            id: 'SELFTEST-3',
            cve: 'CVE-2026-99003',
            title: 'Self-test finding - low severity',
            severity: 'informational',
            host: 'selftest-host-02',
        },
    ]

    var first = ingestion.ingest(batch, { source: SOURCE })
    check('6. Three records stage successfully', first.ok && first.staged === 3, 'staged=' + first.staged + ' skipped=' + first.skipped)

    var afterFirst = countStaged()

    // Convention mapping: risk "3" must become "high", and the qid must become the external id.
    var conventionRow = new GlideRecord(registry.TABLE_VULN_STAGE)
    conventionRow.addQuery('source', SOURCE)
    conventionRow.addQuery('external_id', 'SELFTEST-2')
    conventionRow.setLimit(1)
    conventionRow.query()
    if (conventionRow.next()) {
        check(
            '6b. Convention mapping normalises a scanner-shaped record',
            conventionRow.getValue('severity') === 'high' && conventionRow.getValue('cve') === 'CVE-2026-99002',
            'severity=' + conventionRow.getValue('severity') + ' cve=' + conventionRow.getValue('cve')
        )
    } else {
        check('6b. Convention mapping normalises a scanner-shaped record', false, 'staged row not found')
    }

    var firstSeen = conventionRow.getValue('first_seen')

    var second = ingestion.ingest(batch, { source: SOURCE })
    var afterSecond = countStaged()

    var reread = new GlideRecord(registry.TABLE_VULN_STAGE)
    reread.addQuery('source', SOURCE)
    reread.addQuery('external_id', 'SELFTEST-2')
    reread.setLimit(1)
    reread.query()
    var firstSeenPreserved = reread.next() && reread.getValue('first_seen') === firstSeen

    check(
        '7. Re-ingesting the same batch de-duplicates and preserves first_seen',
        second.staged === 3 && afterSecond === afterFirst && firstSeenPreserved,
        'rows before=' + afterFirst + ' after=' + afterSecond + ' first_seen preserved=' + firstSeenPreserved
    )

    var LEAK = 'selftest-credential-must-never-persist'
    ingestion.ingest(
        [
            {
                id: 'SELFTEST-4',
                cve: 'CVE-2026-99004',
                title: 'Self-test finding carrying a credential',
                severity: 'low',
                host: 'selftest-host-01',
                api_key: LEAK,
                config: { password: LEAK, token: LEAK },
            },
        ],
        { source: SOURCE }
    )

    var redacted = new GlideRecord(registry.TABLE_VULN_STAGE)
    redacted.addQuery('source', SOURCE)
    redacted.addQuery('external_id', 'SELFTEST-4')
    redacted.setLimit(1)
    redacted.query()
    if (redacted.next()) {
        var raw = String(redacted.getValue('raw_payload') || '')
        check(
            '8. Credential-shaped values are redacted before they are stored',
            raw.indexOf(LEAK) === -1 && raw.indexOf('***REDACTED***') !== -1,
            raw.indexOf(LEAK) === -1 ? 'no leak found in raw_payload' : 'LEAKED - the raw payload contains the secret'
        )
    } else {
        check('8. Credential-shaped values are redacted', false, 'staged row not found')
    }

    var anonymous = ingestion.ingest([{ title: 'Self-test record with no identifier', severity: 'low' }], { source: SOURCE })
    check(
        '9. A record with no usable identifier is skipped, not staged anonymously',
        anonymous.staged === 0 && anonymous.skipped === 1,
        'staged=' + anonymous.staged + ' skipped=' + anonymous.skipped + ' errors=' + anonymous.errors.join('; ')
    )

    // ----------------------------------------------- 10: indicator extraction

    var text = [
        'Reported phish from finance-alerts[at]selftest-invoices.test',
        'Link: hxxps://login-verify.selftest-phish.test/session?id=99',
        'Callback IP 192.0.2.44',
        'Attachment SHA256 e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        'MD5 d41d8cd98f00b204e9800998ecf8427e',
    ].join('\n')

    var indicators = new SecOpsIndicatorExtractor().extract(text)
    var types = {}
    for (var i = 0; i < indicators.length; i++) {
        types[indicators[i].type] = indicators[i].value
    }

    check(
        '10. Defanged indicators are re-fanged and typed correctly',
        types['Email address'] === 'finance-alerts@selftest-invoices.test' &&
            String(types['URL'] || '').indexOf('https://login-verify.selftest-phish.test') === 0 &&
            types['IP address (V4)'] === '192.0.2.44' &&
            Boolean(types['SHA256 hash']) &&
            Boolean(types['MD5 hash']),
        'found ' + indicators.length + ' indicators: ' + Object.keys(types).join(', ')
    )

    // -------------------------------------------- 11: template injection safety

    var template = new SecOpsTemplate()
    var json = new SecOpsJson()
    var hostile = 'evil","admin":true,"x":"'

    var escaped = template.render('{"indicator":"${ioc}"}', { ioc: hostile }, { jsonEscape: true })
    var parsedEscaped = json.parse(escaped)
    var unescaped = json.parse(template.render('{"indicator":"${ioc}"}', { ioc: hostile }))

    check(
        '11. A hostile value cannot inject extra keys into a JSON body',
        parsedEscaped !== null && Object.keys(parsedEscaped).length === 1 && parsedEscaped.indicator === hostile,
        'escaped body parsed to ' + (parsedEscaped ? Object.keys(parsedEscaped).length : 0) + ' key(s); ' +
            'unescaped would have produced ' + (unescaped ? Object.keys(unescaped).length : 'invalid JSON')
    )

    check(
        '11b. An unresolved placeholder never ships literally',
        template.render('{"a":"${missing.path}"}', {}, { jsonEscape: true }).indexOf('${') === -1,
        'rendered=' + template.render('{"a":"${missing.path}"}', {}, { jsonEscape: true })
    )

    // ------------------------------------------------- 12: back-pressure parking

    if (networkUp) {
        var endpointGr = registry.getEndpoint(backpressureEndpoint)
        var result429 = new SecOpsRestClient().execute(registry.endpointToObject(endpointGr), {}, {})

        var txn = new GlideRecord(registry.TABLE_TRANSACTION)
        var parked = false
        var txnDetail = 'no transaction written'
        if (result429.transaction && txn.get(result429.transaction)) {
            parked = txn.getValue('state') === 'retry_pending' && Boolean(txn.getValue('next_retry'))
            txnDetail =
                'state=' + txn.getValue('state') +
                ' http_status=' + txn.getValue('http_status') +
                ' retry_count=' + txn.getValue('retry_count') +
                ' next_retry=' + txn.getValue('next_retry')
        }

        check(
            '12. HTTP 429 is retried, then parked as retry_pending with a next_retry',
            parked && String(txn.getValue('retry_count')) === '2',
            txnDetail
        )
    } else {
        skip('12. HTTP 429 is parked as retry_pending', 'no outbound network from this instance')
    }

    // ------------------------------------------------------------- clean up

    if (CLEAN_UP) {
        gs.info('Cleaning up...')
        var removedStage = deleteWhere(registry.TABLE_VULN_STAGE, 'source', SOURCE)
        var removedEndpoints = 0
        var removedConnectors = 0
        for (var e = 0; e < created.endpoints.length; e++) {
            removedEndpoints += deleteWhere(registry.TABLE_ENDPOINT, 'sys_id', created.endpoints[e])
        }
        for (var c = 0; c < created.connectors.length; c++) {
            removedConnectors += deleteWhere(registry.TABLE_CONNECTOR, 'sys_id', created.connectors[c])
        }
        gs.info(
            'Removed ' + removedStage + ' staged rows, ' + removedEndpoints + ' endpoints, ' +
                removedConnectors + ' connectors. Transactions are kept as evidence.'
        )
    } else {
        gs.info('CLEAN_UP is false - configuration left in place. Run loopback-cleanup.js when done.')
    }

    // --------------------------------------------------------------- report

    var passed = 0
    var failed = 0
    var skipped = 0
    var failures = []
    for (var r = 0; r < results.length; r++) {
        if (results[r].skipped) {
            skipped++
        } else if (results[r].passed) {
            passed++
        } else {
            failed++
            failures.push(results[r].name + ' -- ' + results[r].detail)
        }
    }

    gs.info('=== Result: ' + passed + ' passed, ' + failed + ' failed, ' + skipped + ' skipped ===')

    if (failed > 0) {
        gs.info('Failures:')
        for (var f = 0; f < failures.length; f++) {
            gs.info('  * ' + failures[f])
        }
    }

    if (!networkUp) {
        gs.info(
            'Note: every outbound check was skipped because the first call returned status 0 - this ' +
                'instance has no direct internet egress. Configure a MID Server on the connector, or ' +
                'treat checks 4, 5, 6-11 as the full result.'
        )
    }
})()

/**
 * SecOpsVulnIngestionHandler - third-party vulnerability telemetry ingestion.
 *
 * Inbound data ALWAYS lands in x_335329_secops_vuln_stage first. Promotion into Vulnerability
 * Response is a separate, opt-in step, for three reasons:
 *
 *   1. VR is a separate subscription - the app must install and run without it.
 *   2. Store review expects inbound integrations to stage data rather than write straight into a
 *      product's operational tables.
 *   3. Staging makes a bad feed reversible: you can inspect, fix mappings and re-promote.
 *
 * Promotion targets are properties, not constants, because the VR schema differs across releases.
 * Defaults: sn_vul_third_party_entry (the vulnerability) and sn_vul_vulnerable_item (the
 * occurrence on a CI). Note that sn_vul_vulnerability is NOT the vulnerability table - it holds
 * Remediation Tasks - so it is deliberately not a default here.
 */
var SecOpsVulnIngestionHandler = Class.create()

SecOpsVulnIngestionHandler.prototype = Object.extendsObject(SecOpsUniversalPayloadHandler, {
    initialize: function () {
        SecOpsUniversalPayloadHandler.prototype.initialize.call(this, 'SecOpsVulnIngestionHandler')
    },

    CAPABILITY: 'ingest',
    DEFAULT_TARGET_TABLE: 'x_335329_secops_vuln_stage',

    DEFAULT_ENTRY_TABLE: 'sn_vul_third_party_entry',
    DEFAULT_ITEM_TABLE: 'sn_vul_vulnerable_item',

    /**
     * Stages a batch of third-party vulnerability records.
     *
     * @param payload raw JSON (array, or object containing an array), string or parsed
     * @param options { source, endpoint, recordsPath, transaction, promote }
     * @returns { ok, staged, skipped, errors: [], records: [], promoted }
     */
    ingest: function (payload, options) {
        var opts = options || {}
        var outcome = { ok: false, staged: 0, skipped: 0, errors: [], records: [], promoted: null }

        var parsed = this.parsePayload(payload)
        if (parsed === null) {
            outcome.errors.push('Payload could not be parsed as JSON')
            return outcome
        }

        var records = this.toRecordArray(parsed, opts.recordsPath)
        if (records.length === 0) {
            outcome.ok = true
            this.log.info('Ingestion payload contained no records')
            return outcome
        }

        var limit = this.registry.getInt(this.registry.PROP_INGEST_MAX, 500)
        if (records.length > limit) {
            outcome.errors.push('Payload contained ' + records.length + ' records; only the first ' + limit + ' were staged')
            records = records.slice(0, limit)
        }

        var source = opts.source || 'unknown'
        var maps = opts.endpoint ? this.registry.getFieldMaps(opts.endpoint.sys_id) : []

        // Two queries for the whole batch instead of up to two per record. cmdb_ci is the largest
        // table on most instances; 500 records used to mean up to 1000 scans of it.
        var normalized = []
        for (var n = 0; n < records.length; n++) {
            normalized.push(maps.length > 0 ? this.mapWithRules(records[n], maps) : this.mapByConvention(records[n]))
        }
        var ciMap = this.resolveCiBatch(normalized)

        for (var i = 0; i < records.length; i++) {
            var staged = this.stageOne(records[i], source, normalized[i], ciMap, opts)
            if (staged.ok) {
                outcome.staged++
                outcome.records.push(staged.sys_id)
            } else {
                outcome.skipped++
                outcome.errors.push(staged.error)
            }
        }

        outcome.ok = outcome.staged > 0 || records.length === 0

        if (opts.promote && outcome.staged > 0) {
            outcome.promoted = this.promote({ source: source })
        }

        return outcome
    },

    /** Calls a configured 'ingest' endpoint and stages whatever it returns. */
    pull: function (options) {
        var opts = options || {}
        var endpoint = opts.endpoint || this.registry.findEndpointForCapability(this.CAPABILITY, opts.connector)
        if (!endpoint) {
            return { ok: false, staged: 0, skipped: 0, errors: ['No active ingestion endpoint is configured'], records: [] }
        }

        var response = this.run(opts.context || {}, {
            endpoint: endpoint,
            secure: opts.secure,
            write: false,
        })

        if (!response.ok) {
            return { ok: false, staged: 0, skipped: 0, errors: [response.error], records: [], transaction: response.transaction }
        }

        var connectorName = this.writer.readField(this.registry.TABLE_CONNECTOR, endpoint.connector, 'name')
        var result = this.ingest(response.payload, {
            source: opts.source || connectorName || endpoint.name,
            endpoint: endpoint,
            recordsPath: opts.recordsPath,
            promote: opts.promote,
            // Both of these were previously dropped here: `secure` never reached the staging write,
            // and without `transaction` a staged row could not be traced to the call that made it.
            secure: opts.secure,
            transaction: response.transaction,
        })
        result.transaction = response.transaction
        return result
    },

    /** Writes one staged row. `values` is pre-mapped; `ciMap` is the batch-resolved CI lookup. */
    stageOne: function (record, source, values, ciMap, options) {
        var opts = options || {}

        values.source = source
        if (!values.external_id) {
            values.external_id = this.fallbackExternalId(record, values)
        }
        if (!values.external_id) {
            return { ok: false, error: 'Record has no usable external identifier and was skipped' }
        }

        var now = new GlideDateTime().getValue()
        values.raw_payload = this.json.forLog(record, 32000, this.registry.getString(this.registry.PROP_REDACT_KEYS, ''))
        values.state = 'new'
        values.last_seen = now
        // Set on create only, so a re-ingested finding keeps the date it was first seen.
        values.first_seen = now
        if (opts.transaction) {
            values.transaction = opts.transaction
        }

        var matchedCi = ciMap && values.ci_identifier ? ciMap[String(values.ci_identifier).toLowerCase()] : null
        if (matchedCi) {
            values.ci = matchedCi
        }

        var written = this.writer.write(this.registry.TABLE_VULN_STAGE, values, {
            // Default matches the base handler: secure unless explicitly disabled.
            secure: opts.secure !== false,
            coalesce: ['source', 'external_id'],
            insertOnly: ['first_seen'],
        })

        if (!written.ok) {
            return { ok: false, error: written.error }
        }
        return { ok: true, sys_id: written.sys_id }
    },

    mapWithRules: function (record, maps) {
        var mapped = this.mapper.apply(record, maps, this.registry.TABLE_VULN_STAGE)
        return mapped.byTable[this.registry.TABLE_VULN_STAGE] || {}
    },

    /** Best-effort mapping for feeds with no explicit rules yet. */
    mapByConvention: function (record) {
        return {
            external_id: this.firstOf(record, ['external_id', 'id', 'vuln_id', 'finding_id', 'qid']),
            cve: this.firstOf(record, ['cve', 'cve_id', 'cveId', 'vulnerability_id']),
            title: this.firstOf(record, ['title', 'name', 'summary', 'synopsis']),
            severity: this.normalizeSeverity(this.firstOf(record, ['severity', 'risk', 'criticality'])),
            cvss_score: this.toScore(this.firstOf(record, ['cvss_score', 'cvss', 'score', 'base_score'])),
            ci_identifier: this.firstOf(record, ['ci', 'host', 'hostname', 'asset', 'asset_name', 'ip', 'ip_address', 'fqdn']),
        }
    },

    firstOf: function (record, keys) {
        for (var i = 0; i < keys.length; i++) {
            var value = this.json.get(record, keys[i], null)
            if (value !== null && value !== '') {
                return typeof value === 'object' ? this.json.stringify(value) : String(value)
            }
        }
        return null
    },

    fallbackExternalId: function (record, values) {
        if (values.cve && values.ci_identifier) {
            return values.cve + '@' + values.ci_identifier
        }
        return values.cve || null
    },

    normalizeSeverity: function (value) {
        if (value === null || value === undefined || value === '') {
            return 'unknown'
        }
        var text = String(value).toLowerCase()
        if (text === 'critical' || text === '4' || text === '5') {
            return 'critical'
        }
        if (text === 'high' || text === '3') {
            return 'high'
        }
        if (text === 'medium' || text === 'moderate' || text === '2') {
            return 'medium'
        }
        if (text === 'low' || text === '1') {
            return 'low'
        }
        if (text === 'info' || text === 'informational' || text === '0') {
            return 'informational'
        }
        return 'unknown'
    },

    toScore: function (value) {
        if (value === null || value === undefined || value === '') {
            return null
        }
        var parsed = parseFloat(value)
        return isNaN(parsed) ? null : parsed
    },

    /**
     * Resolves every distinct ci_identifier in a batch to a CI in two queries.
     *
     * Returns a map of lower-cased identifier -> CI sys_id. An identifier that matches more than
     * one CI is deliberately left out: guessing which host a finding belongs to would attach
     * vulnerabilities to the wrong asset, which is worse than leaving the CI empty.
     */
    resolveCiBatch: function (valueSets) {
        var map = {}
        var identifiers = []
        var seen = {}

        for (var i = 0; i < valueSets.length; i++) {
            var raw = valueSets[i] ? valueSets[i].ci_identifier : null
            if (!raw) {
                continue
            }
            var key = String(raw)
            if (!seen[key.toLowerCase()]) {
                seen[key.toLowerCase()] = true
                identifiers.push(key)
            }
        }

        if (identifiers.length === 0) {
            return map
        }

        this.collectCiMatches(map, 'name', identifiers)

        // Only look up by IP for identifiers that did not resolve by name.
        var unresolved = []
        for (var u = 0; u < identifiers.length; u++) {
            if (!map[identifiers[u].toLowerCase()]) {
                unresolved.push(identifiers[u])
            }
        }
        if (unresolved.length > 0) {
            this.collectCiMatches(map, 'ip_address', unresolved)
        }

        return map
    },

    /** One IN query on `field`; ambiguous identifiers are recorded then removed. */
    collectCiMatches: function (map, field, identifiers) {
        try {
            var gr = new GlideRecord('cmdb_ci')
            if (!gr.isValid() || !gr.isValidField(field)) {
                return
            }
            gr.addQuery(field, 'IN', identifiers.join(','))
            gr.query()

            var ambiguous = {}
            while (gr.next()) {
                var key = String(gr.getValue(field) || '').toLowerCase()
                if (key === '') {
                    continue
                }
                if (map[key] !== undefined) {
                    ambiguous[key] = true
                    continue
                }
                map[key] = gr.getUniqueValue()
            }

            var duplicates = Object.keys(ambiguous)
            for (var i = 0; i < duplicates.length; i++) {
                delete map[duplicates[i]]
            }
            if (duplicates.length > 0) {
                this.log.warn('CI identifiers matched more than one CI and were left unresolved', {
                    field: field,
                    identifiers: duplicates,
                })
            }
        } catch (e) {
            this.log.warn('CI batch match failed', { field: field, error: String(e) })
        }
    },

    /**
     * Promotes staged rows into Vulnerability Response.
     *
     * Disabled by default. Every write is schema-checked, so an absent or renamed VR field is
     * reported rather than thrown.
     */
    promote: function (options) {
        var opts = options || {}
        var outcome = { ok: false, promoted: 0, failed: 0, errors: [], skipped: false }

        if (!this.registry.getBool(this.registry.PROP_VR_PROMOTION, false)) {
            outcome.skipped = true
            outcome.ok = true
            outcome.errors.push('Promotion is disabled (' + this.registry.PROP_VR_PROMOTION + ' is false)')
            return outcome
        }

        var entryTable = this.registry.getString(this.registry.PROP_VR_ENTRY_TABLE, this.DEFAULT_ENTRY_TABLE) || this.DEFAULT_ENTRY_TABLE
        var itemTable = this.registry.getString(this.registry.PROP_VR_ITEM_TABLE, this.DEFAULT_ITEM_TABLE) || this.DEFAULT_ITEM_TABLE

        if (!this.writer.tableExists(entryTable) || !this.writer.tableExists(itemTable)) {
            outcome.skipped = true
            outcome.ok = true
            outcome.errors.push('Vulnerability Response is not installed (' + entryTable + ' / ' + itemTable + ' not found)')
            this.log.warn(outcome.errors[0])
            return outcome
        }

        var gr = new GlideRecord(this.registry.TABLE_VULN_STAGE)
        if (!gr.isValid()) {
            outcome.errors.push('Staging table is unavailable')
            return outcome
        }
        gr.addQuery('state', 'new')
        if (opts.source) {
            gr.addQuery('source', String(opts.source))
        }
        gr.setLimit(this.registry.getInt(this.registry.PROP_INGEST_MAX, 500))
        gr.query()

        while (gr.next()) {
            var promoted = this.promoteOne(gr, entryTable, itemTable)
            if (promoted.ok) {
                outcome.promoted++
            } else {
                outcome.failed++
                outcome.errors.push(promoted.error)
            }
        }

        outcome.ok = outcome.failed === 0
        return outcome
    },

    /** `stageGr` is the live cursor from promote() - written directly, never re-queried. */
    promoteOne: function (stageGr, entryTable, itemTable) {
        var stageId = stageGr.getUniqueValue()

        var entry = this.writer.write(
            entryTable,
            {
                id: stageGr.getValue('cve') || stageGr.getValue('external_id'),
                source: stageGr.getValue('source'),
                summary: stageGr.getValue('title'),
            },
            { secure: false, coalesce: ['id', 'source'] }
        )

        if (!entry.ok) {
            this.markStage(stageGr, 'error', entry.error)
            return { ok: false, error: 'Entry write failed for ' + stageId + ': ' + entry.error }
        }

        var item = this.writer.write(
            itemTable,
            {
                vulnerability: entry.sys_id,
                cmdb_ci: stageGr.getValue('ci'),
                source: stageGr.getValue('source'),
            },
            { secure: false, coalesce: ['vulnerability', 'cmdb_ci'] }
        )

        if (!item.ok) {
            this.markStage(stageGr, 'error', item.error)
            return { ok: false, error: 'Vulnerable item write failed for ' + stageId + ': ' + item.error }
        }

        this.markStage(stageGr, 'promoted', 'Promoted to ' + entryTable + ' / ' + itemTable)
        return { ok: true }
    },

    /**
     * Updates the staging row through the cursor promote() already holds.
     *
     * This used to open a second GlideRecord and get() the very row the outer cursor was sitting
     * on - a third query per row for no reason.
     */
    markStage: function (stageGr, state, message) {
        try {
            stageGr.setValue('state', state)
            stageGr.setValue('promotion_message', this.json.truncate(message, 1000))
            stageGr.update()
        } catch (e) {
            this.log.warn('Unable to update staging state', { stage: stageGr.getUniqueValue(), error: String(e) })
        }
    },

    toRecordArray: function (parsed, recordsPath) {
        var source = parsed
        if (recordsPath) {
            source = this.json.get(parsed, recordsPath, null)
        }
        if (source === null || source === undefined) {
            return []
        }
        if (this.json.isArray(source)) {
            return source
        }
        // A few common envelope shapes, tried in order.
        var candidates = ['records', 'results', 'items', 'data', 'vulnerabilities', 'findings']
        for (var i = 0; i < candidates.length; i++) {
            var nested = this.json.get(source, candidates[i], null)
            if (this.json.isArray(nested)) {
                return nested
            }
        }
        return typeof source === 'object' ? [source] : []
    },

    type: 'SecOpsVulnIngestionHandler',
})

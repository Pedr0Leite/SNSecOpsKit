/**
 * SecOpsThreatIntelHandler - enriches a Threat Intelligence observable from a third-party source.
 *
 * Writes a Threat Lookup Result [sn_ti_lookup_result] per source, which is the platform's own
 * enrichment contract, and optionally rolls the verdict up onto the observable's Finding.
 *
 * Finding values are the verbatim sn_ti_observable choices: Malicious, Suspicious, Clean, Unknown.
 */
var SecOpsThreatIntelHandler = Class.create()

SecOpsThreatIntelHandler.prototype = Object.extendsObject(SecOpsUniversalPayloadHandler, {
    initialize: function () {
        SecOpsUniversalPayloadHandler.prototype.initialize.call(this, 'SecOpsThreatIntelHandler')
    },

    CAPABILITY: 'enrich',
    DEFAULT_TARGET_TABLE: 'sn_ti_lookup_result',

    TABLE_OBSERVABLE: 'sn_ti_observable',
    TABLE_LOOKUP_RESULT: 'sn_ti_lookup_result',

    FINDINGS: ['Malicious', 'Suspicious', 'Clean', 'Unknown'],
    FINDING_RANK: { Malicious: 3, Suspicious: 2, Clean: 1, Unknown: 0 },

    /**
     * Enriches one observable across every configured 'enrich' endpoint.
     *
     * @param observableId sys_id on sn_ti_observable
     * @param options      { connector, rollup (default true), secure }
     * @returns { ok, observable, value, results: [], finding, error }
     */
    enrichObservable: function (observableId, options) {
        var opts = options || {}
        var outcome = { ok: false, observable: observableId, value: null, type: null, results: [], finding: null, error: null }

        var observable = this.readObservable(observableId)
        if (!observable) {
            outcome.error = 'Observable ' + observableId + ' could not be read (missing, or Threat Intelligence is not installed)'
            this.log.warn(outcome.error)
            return outcome
        }
        outcome.value = observable.value
        outcome.type = observable.type_name

        var endpoints = opts.connector
            ? [this.registry.findEndpointForCapability(this.CAPABILITY, opts.connector)]
            : this.registry.listEndpointsForCapability(this.CAPABILITY)

        var usable = []
        for (var e = 0; e < endpoints.length; e++) {
            if (endpoints[e]) {
                usable.push(endpoints[e])
            }
        }

        if (usable.length === 0) {
            outcome.error = 'No active threat intelligence endpoint is configured'
            this.log.warn(outcome.error)
            return outcome
        }

        var context = {
            observable: observable,
            ioc: observable.value,
            value: observable.value,
            type: observable.type_name,
        }

        for (var i = 0; i < usable.length; i++) {
            var endpoint = usable[i]
            var response = this.run(context, {
                endpoint: endpoint,
                source_table: this.TABLE_OBSERVABLE,
                source_record: observableId,
                secure: opts.secure,
                // The handler writes the lookup result itself so the observable reference and the
                // source engine are always populated, even when no field maps exist.
                write: false,
            })

            var finding = this.findingFrom(response.payload, endpoint)
            var recorded = this.recordLookupResult(observableId, endpoint, response, finding, opts)

            outcome.results.push({
                endpoint: endpoint.sys_id,
                endpoint_name: endpoint.name,
                ok: response.ok,
                status: response.status,
                finding: finding,
                lookup_result: recorded.sys_id,
                transaction: response.transaction,
                error: response.error || recorded.error,
            })

            if (response.ok) {
                outcome.ok = true
            }
        }

        outcome.finding = this.worstFinding(outcome.results)

        if (outcome.ok && opts.rollup !== false && outcome.finding) {
            this.rollUpFinding(observableId, outcome.finding, opts)
        }

        return outcome
    },

    /** Reads value + type name from an observable. Returns null when TI is absent. */
    readObservable: function (observableId) {
        if (!observableId) {
            return null
        }
        try {
            var gr = new GlideRecord(this.TABLE_OBSERVABLE)
            if (!gr.isValid() || !gr.get(String(observableId))) {
                return null
            }
            return {
                sys_id: gr.getUniqueValue(),
                value: gr.getValue('value'),
                type: gr.getValue('type'),
                type_name: this.writer.readField('sn_ti_observable_type', gr.getValue('type'), 'name'),
                finding: gr.getValue('finding'),
            }
        } catch (e) {
            this.log.error('Unable to read observable', { observable: observableId, error: String(e) })
            return null
        }
    },

    /**
     * Derives a platform Finding from the third-party response.
     *
     * Order of preference: an explicit mapping onto the `finding` field, then a verdict-shaped
     * string anywhere in the response, then a numeric score. Anything unrecognised stays Unknown
     * rather than guessing - a wrong "Clean" is far more dangerous than an honest "Unknown".
     */
    findingFrom: function (payload, endpoint) {
        if (payload === null || payload === undefined) {
            return 'Unknown'
        }

        var maps = this.registry.getFieldMaps(endpoint.sys_id)
        for (var i = 0; i < maps.length; i++) {
            if (maps[i].target_field === 'finding') {
                var mapped = this.json.get(payload, maps[i].source_path, null)
                var normalized = this.normalizeFinding(mapped)
                if (normalized) {
                    return normalized
                }
            }
        }

        var candidates = ['finding', 'verdict', 'disposition', 'classification', 'result', 'status']
        for (var c = 0; c < candidates.length; c++) {
            var direct = this.normalizeFinding(this.json.get(payload, candidates[c], null))
            if (direct) {
                return direct
            }
        }

        return this.findingFromScore(payload)
    },

    normalizeFinding: function (value) {
        if (value === null || value === undefined) {
            return null
        }
        var text = String(value).toLowerCase()

        for (var i = 0; i < this.FINDINGS.length; i++) {
            if (text === this.FINDINGS[i].toLowerCase()) {
                return this.FINDINGS[i]
            }
        }
        if (text === 'malware' || text === 'phishing' || text === 'bad' || text === 'harmful') {
            return 'Malicious'
        }
        if (text === 'suspect' || text === 'suspicious' || text === 'potentially unwanted') {
            return 'Suspicious'
        }
        if (text === 'benign' || text === 'harmless' || text === 'good' || text === 'safe') {
            return 'Clean'
        }
        return null
    },

    /** Common reputation-score shapes, scaled 0-100. */
    findingFromScore: function (payload) {
        var paths = ['score', 'risk_score', 'threat_score', 'data.score', 'data.attributes.reputation']
        for (var i = 0; i < paths.length; i++) {
            var raw = this.json.get(payload, paths[i], null)
            if (raw === null) {
                continue
            }
            var score = parseFloat(raw)
            if (isNaN(score)) {
                continue
            }
            if (score >= 70) {
                return 'Malicious'
            }
            if (score >= 40) {
                return 'Suspicious'
            }
            return 'Clean'
        }
        return 'Unknown'
    },

    /**
     * Writes the Threat Lookup Result row for one source.
     *
     * The framework supplies a sane default value set, then lets the endpoint's own field mappings
     * override it. Without that merge, any mapping row other than `finding` would be silently
     * ignored on an enrich endpoint - an administrator would map a field and see nothing happen.
     */
    recordLookupResult: function (observableId, endpoint, response, finding, options) {
        var opts = options || {}
        var connectorName = this.writer.readField(this.registry.TABLE_CONNECTOR, endpoint.connector, 'name') || endpoint.name

        var values = {
            observable: observableId,
            source_engine: connectorName,
            finding: finding,
            result: response.ok ? finding : 'Lookup failed',
            details: this.json.forLog(
                response.ok ? response.payload : { error: response.error, status: response.status },
                4000,
                this.registry.getString(this.registry.PROP_REDACT_KEYS, '')
            ),
            first_found: new GlideDateTime().getValue(),
        }

        if (response.ok) {
            var maps = this.registry.getFieldMaps(endpoint.sys_id)
            if (maps.length > 0) {
                var mapped = this.mapper.apply(response.payload, maps, this.TABLE_LOOKUP_RESULT)
                var overrides = mapped.byTable[this.TABLE_LOOKUP_RESULT]
                if (overrides) {
                    var fields = Object.keys(overrides)
                    for (var i = 0; i < fields.length; i++) {
                        // `finding` is already normalised to a platform choice by findingFrom();
                        // a raw vendor string must not replace it.
                        if (fields[i] !== 'finding') {
                            values[fields[i]] = overrides[fields[i]]
                        }
                    }
                }
                if (mapped.errors.length > 0) {
                    this.log.warn('Field mapping problems on enrich endpoint', {
                        endpoint: endpoint.name,
                        errors: mapped.errors,
                    })
                }
            }
        }

        return this.writer.write(this.TABLE_LOOKUP_RESULT, values, {
            secure: opts.secure !== false,
            coalesce: ['observable', 'source_engine'],
        })
    },

    /** The most severe finding across all sources wins. */
    worstFinding: function (results) {
        var worst = null
        var worstRank = -1
        for (var i = 0; i < results.length; i++) {
            var finding = results[i].finding
            if (!finding) {
                continue
            }
            var rank = this.FINDING_RANK[finding]
            if (rank === undefined) {
                continue
            }
            if (rank > worstRank) {
                worstRank = rank
                worst = finding
            }
        }
        return worst
    },

    /**
     * Copies the verdict onto the observable.
     *
     * Two things this will not do:
     *   - overwrite a manual analyst decision (has_manual_finding_override), and
     *   - lower an existing verdict.
     *
     * The second matters as much as the first. 'Unknown' is what an unrecognised response body
     * yields, so without a rank check a source that changed its JSON shape would quietly erase a
     * previous 'Malicious'. Erasing a known-bad verdict is the worst failure this code could have.
     */
    rollUpFinding: function (observableId, finding, options) {
        var opts = options || {}
        try {
            var gr = opts.secure === false ? new GlideRecord(this.TABLE_OBSERVABLE) : new GlideRecordSecure(this.TABLE_OBSERVABLE)
            if (!gr.isValid() || !gr.get(String(observableId))) {
                return false
            }
            if (gr.isValidField('has_manual_finding_override') && gr.getValue('has_manual_finding_override') === 'true') {
                this.log.info('Skipping finding roll-up: analyst override in place', { observable: observableId })
                return false
            }
            if (!gr.isValidField('finding')) {
                return false
            }
            if (!this.isUpgrade(gr.getValue('finding'), finding)) {
                this.log.info('Skipping finding roll-up: would not raise the existing verdict', {
                    observable: observableId,
                    current: gr.getValue('finding'),
                    proposed: finding,
                })
                return false
            }
            gr.setValue('finding', finding)
            return Boolean(gr.update())
        } catch (e) {
            this.log.warn('Finding roll-up failed', { observable: observableId, error: String(e) })
            return false
        }
    },

    /** True only when `proposed` is strictly more severe than `current`. */
    isUpgrade: function (current, proposed) {
        var proposedRank = this.FINDING_RANK[proposed]
        if (proposedRank === undefined) {
            return false
        }
        var currentRank = this.FINDING_RANK[current]
        if (currentRank === undefined) {
            // No usable existing verdict (empty or a value we do not recognise) - safe to set.
            return true
        }
        return proposedRank > currentRank
    },

    type: 'SecOpsThreatIntelHandler',
})

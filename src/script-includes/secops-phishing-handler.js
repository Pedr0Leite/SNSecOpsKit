/**
 * SecOpsPhishingHandler - phishing response automation.
 *
 * Harvests indicators from a Security Incident, sends each to a third-party sandbox, and returns a
 * disposition. Extracted indicators can optionally be created as Threat Intelligence observables
 * and attached to the incident, which is what turns a reported phish into re-usable intel.
 */
var SecOpsPhishingHandler = Class.create()

SecOpsPhishingHandler.prototype = Object.extendsObject(SecOpsUniversalPayloadHandler, {
    initialize: function () {
        SecOpsUniversalPayloadHandler.prototype.initialize.call(this, 'SecOpsPhishingHandler')
        this.extractor = new SecOpsIndicatorExtractor()
        this.intel = new SecOpsThreatIntelHandler()
    },

    CAPABILITY: 'detonate',

    TABLE_INCIDENT: 'sn_si_incident',
    TABLE_OBSERVABLE: 'sn_ti_observable',
    TABLE_OBSERVABLE_TYPE: 'sn_ti_observable_type',
    TABLE_TASK_OBSERVABLE: 'sn_ti_m2m_task_observable',

    // Fields scanned for indicators, in order. Absent fields are skipped.
    SOURCE_FIELDS: ['short_description', 'description', 'comments', 'work_notes'],

    // Of those, the ones that are journal fields and must be read with getJournalEntry().
    JOURNAL_FIELDS: ['comments', 'work_notes'],

    /**
     * Analyses a security incident end to end.
     *
     * @param incidentId sys_id on sn_si_incident
     * @param options    { connector, createObservables (default true), maxIndicators, secure }
     * @returns { ok, incident, indicators: [], disposition, error }
     */
    analyzeIncident: function (incidentId, options) {
        var opts = options || {}
        var outcome = { ok: false, incident: incidentId, indicators: [], disposition: 'Unknown', error: null }

        var text = this.collectText(incidentId)
        if (text === null) {
            outcome.error =
                'Security incident ' + incidentId + ' could not be read (missing, or Security Incident Response is not installed)'
            this.log.warn(outcome.error)
            return outcome
        }

        var indicators = this.extractor.extract(text)
        if (indicators.length === 0) {
            outcome.ok = true
            outcome.error = null
            this.log.info('No indicators found in incident', { incident: incidentId })
            return outcome
        }

        // Each surviving indicator costs one synchronous outbound call, so this cap is its own
        // property with a small default - not the bulk-ingestion cap, which is sized for a feed.
        var limit = opts.maxIndicators || this.registry.getInt(this.registry.PROP_DETONATE_MAX, 15)
        if (indicators.length > limit) {
            this.log.warn('Indicator count exceeds the detonation limit; truncating', {
                incident: incidentId,
                found: indicators.length,
                limit: limit,
            })
            outcome.truncated = indicators.length - limit
            indicators = indicators.slice(0, limit)
        }

        var succeeded = 0
        var firstError = null
        for (var i = 0; i < indicators.length; i++) {
            var processed = this.processIndicator(incidentId, indicators[i], opts)
            outcome.indicators.push(processed)
            if (processed.ok) {
                succeeded++
            } else if (!firstError) {
                firstError = processed.error
            }
        }

        outcome.disposition = this.worstDisposition(outcome.indicators)

        // "Analysed, nothing malicious" and "the sandbox is unreachable" must not look alike: a
        // caller branching on ok would otherwise treat an outage as a clean bill of health.
        outcome.ok = succeeded > 0
        if (!outcome.ok) {
            outcome.error = firstError || 'No indicator could be analysed'
        }
        return outcome
    },

    /** Detonates one indicator and, when asked, records it as an observable on the incident. */
    processIndicator: function (incidentId, indicator, options) {
        var opts = options || {}
        var record = {
            type: indicator.type,
            value: indicator.value,
            disposition: 'Unknown',
            observable: null,
            transaction: null,
            ok: false,
            error: null,
        }

        var response = this.run(
            { ioc: indicator.value, value: indicator.value, type: indicator.type, incident: incidentId },
            {
                connector: opts.connector,
                source_table: this.TABLE_INCIDENT,
                source_record: incidentId,
                secure: opts.secure,
                write: false,
            }
        )

        record.ok = response.ok
        record.transaction = response.transaction
        record.error = response.error
        record.disposition = response.ok ? this.intel.findingFrom(response.payload, { sys_id: response.endpoint }) : 'Unknown'

        if (opts.createObservables !== false) {
            var observableId = this.upsertObservable(indicator, record.disposition, opts)
            record.observable = observableId
            if (observableId) {
                this.linkObservableToIncident(incidentId, observableId, opts)
            }
        }

        return record
    },

    /**
     * Concatenates the incident fields worth scanning for indicators.
     *
     * `comments` and `work_notes` are journal fields: their content lives in sys_journal_field, so
     * getValue() returns the (empty) journal input, not the entries. They need getJournalEntry(-1).
     * Reading them with getValue() would silently drop the most common place a reported phish
     * actually lands.
     */
    collectText: function (incidentId) {
        if (!incidentId) {
            return null
        }
        try {
            var gr = new GlideRecord(this.TABLE_INCIDENT)
            if (!gr.isValid() || !gr.get(String(incidentId))) {
                return null
            }
            var parts = []
            for (var i = 0; i < this.SOURCE_FIELDS.length; i++) {
                var field = this.SOURCE_FIELDS[i]
                if (!gr.isValidField(field)) {
                    continue
                }
                var value = this.JOURNAL_FIELDS.indexOf(field) === -1 ? gr.getValue(field) : this.readJournal(gr, field)
                if (value) {
                    parts.push(value)
                }
            }
            return parts.join('\n')
        } catch (e) {
            this.log.error('Unable to read security incident', { incident: incidentId, error: String(e) })
            return null
        }
    },

    /** Reads every entry of a journal field. Returns '' when unavailable. */
    readJournal: function (gr, field) {
        try {
            var element = gr.getElement(field)
            if (!element || typeof element.getJournalEntry !== 'function') {
                return ''
            }
            var entries = element.getJournalEntry(-1)
            return entries ? String(entries) : ''
        } catch (e) {
            this.log.warn('Unable to read journal field', { field: field, error: String(e) })
            return ''
        }
    },

    /**
     * Creates the observable if it does not exist, and returns its sys_id.
     *
     * The verdict is written on INSERT only. On an existing observable the finding is left to
     * SecOpsThreatIntelHandler.rollUpFinding, which refuses to overwrite a manual analyst decision
     * and refuses to lower an existing verdict. Writing `finding` here unconditionally would do
     * both: a failed detonation returns 'Unknown', and that would erase a known 'Malicious'.
     */
    upsertObservable: function (indicator, disposition, options) {
        var opts = options || {}
        var typeId = this.observableTypeId(indicator.type)
        if (!typeId) {
            this.log.warn('No observable type matches the extracted indicator type', { type: indicator.type })
            return null
        }

        var written = this.writer.write(
            this.TABLE_OBSERVABLE,
            { value: indicator.value, type: typeId, finding: disposition },
            {
                secure: opts.secure !== false,
                coalesce: ['value', 'type'],
                insertOnly: ['finding'],
            }
        )

        if (!written.ok) {
            this.log.warn('Unable to record observable', { value: indicator.value, error: written.error })
            return null
        }

        // Existing observable: route the verdict through the guarded roll-up instead.
        if (written.updated && disposition) {
            this.intel.rollUpFinding(written.sys_id, disposition, { secure: opts.secure })
        }

        return written.sys_id
    },

    /** Resolves an sn_ti_observable_type name to its sys_id. */
    observableTypeId: function (typeName) {
        if (!typeName) {
            return null
        }
        try {
            var gr = new GlideRecord(this.TABLE_OBSERVABLE_TYPE)
            if (!gr.isValid()) {
                return null
            }
            gr.addQuery('name', String(typeName))
            gr.setLimit(1)
            gr.query()
            return gr.next() ? gr.getUniqueValue() : null
        } catch (e) {
            return null
        }
    },

    /** Attaches the observable to the incident, without creating a duplicate link. */
    linkObservableToIncident: function (incidentId, observableId, options) {
        var opts = options || {}
        var written = this.writer.write(
            this.TABLE_TASK_OBSERVABLE,
            { task: incidentId, observable: observableId },
            { secure: opts.secure !== false, coalesce: ['task', 'observable'] }
        )
        if (!written.ok) {
            this.log.warn('Unable to link observable to incident', {
                incident: incidentId,
                observable: observableId,
                error: written.error,
            })
        }
        return written.ok
    },

    worstDisposition: function (indicators) {
        var ranks = this.intel.FINDING_RANK
        var worst = 'Unknown'
        var worstRank = -1
        for (var i = 0; i < indicators.length; i++) {
            var rank = ranks[indicators[i].disposition]
            if (rank !== undefined && rank > worstRank) {
                worstRank = rank
                worst = indicators[i].disposition
            }
        }
        return worst
    },

    type: 'SecOpsPhishingHandler',
})

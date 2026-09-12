/**
 * SecOpsContainmentHandler - endpoint isolation and network blocking.
 *
 * Containment is destructive and visible to the business: isolating the wrong host takes a user
 * offline. So every call is logged with the requesting user and the justification, and a target
 * value is mandatory - a containment request that cannot name its target is refused rather than
 * sent with an empty parameter.
 */
var SecOpsContainmentHandler = Class.create()

SecOpsContainmentHandler.prototype = Object.extendsObject(SecOpsUniversalPayloadHandler, {
    initialize: function () {
        SecOpsUniversalPayloadHandler.prototype.initialize.call(this, 'SecOpsContainmentHandler')
    },

    CAPABILITY: 'contain',

    TARGET_TYPES: ['host', 'ip', 'user', 'url', 'hash', 'account'],
    ACTIONS: ['isolate', 'release', 'block', 'unblock'],

    /**
     * Requests a containment action from the configured EDR / firewall connector.
     *
     * @param request { target_type, target_value, action, reason, incident }
     * @param options { connector, secure }
     * @returns { ok, action, target, status, payload, transaction, error }
     */
    contain: function (request, options) {
        var opts = options || {}
        var req = request || {}
        var outcome = {
            ok: false,
            action: req.action || 'isolate',
            target: req.target_value || null,
            target_type: req.target_type || null,
            status: 0,
            payload: null,
            transaction: null,
            writes: null,
            error: null,
        }

        var validation = this.validate(req)
        if (validation) {
            outcome.error = validation
            this.log.warn('Containment request rejected', { error: validation, request: req })
            return outcome
        }

        var context = {
            target_type: req.target_type,
            target_value: req.target_value,
            target: req.target_value,
            action: outcome.action,
            reason: req.reason || '',
            incident: req.incident || '',
            requested_by: gs.getUserName(),
        }

        this.log.info('Containment requested', {
            action: outcome.action,
            target_type: req.target_type,
            target: req.target_value,
            incident: req.incident || null,
            requested_by: gs.getUserName(),
        })

        var response = this.run(context, {
            connector: opts.connector,
            source_table: req.incident ? 'sn_si_incident' : null,
            source_record: req.incident || null,
            secure: opts.secure,
        })

        outcome.ok = response.ok
        outcome.status = response.status
        outcome.payload = response.payload
        outcome.transaction = response.transaction
        outcome.error = response.error
        // Surfaced so a caller can see WHICH records were written or refused. Never claim success
        // on the strength of the HTTP status alone - the base handler already downgrades `ok` when
        // a mapped write was rejected.
        outcome.writes = response.writes || null

        if (outcome.ok) {
            this.log.info('Containment succeeded', { action: outcome.action, target: req.target_value })
        } else {
            this.log.error('Containment failed', {
                action: outcome.action,
                target: req.target_value,
                status: outcome.status,
                error: outcome.error,
            })
        }

        return outcome
    },

    /** Returns an error string, or null when the request is well formed. */
    validate: function (request) {
        if (!request.target_value) {
            return 'A containment request must name a target value'
        }
        if (!request.target_type) {
            return 'A containment request must name a target type (' + this.TARGET_TYPES.join(', ') + ')'
        }
        if (this.TARGET_TYPES.indexOf(String(request.target_type)) === -1) {
            return 'Unsupported target type "' + request.target_type + '"'
        }
        if (request.action && this.ACTIONS.indexOf(String(request.action)) === -1) {
            return 'Unsupported containment action "' + request.action + '"'
        }
        return null
    },

    type: 'SecOpsContainmentHandler',
})

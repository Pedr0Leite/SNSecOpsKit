/**
 * SecOpsLog - level-aware logging that never leaks credentials.
 *
 * Delegates to GSLog so administrators can tune verbosity through the standard
 * x_335329_secops.log.level property. GSLog lives in the global scope, so the lookup is guarded:
 * if cross-scope access to it is denied the logger silently falls back to gs.* rather than taking
 * the whole integration down.
 */
var SecOpsLog = Class.create()

SecOpsLog.prototype = {
    initialize: function (source) {
        this.source = source || 'SecOpsUniversal'
        this.json = new SecOpsJson()
        this.delegate = null

        try {
            if (typeof global !== 'undefined' && global && global.GSLog) {
                this.delegate = new global.GSLog('x_335329_secops.log.level', this.source)
            }
        } catch (e) {
            this.delegate = null
        }
    },

    debug: function (message, context) {
        var text = this.format(message, context)
        if (this.delegate) {
            this.delegate.logDebug(text)
            return
        }
        gs.debug(text)
    },

    info: function (message, context) {
        var text = this.format(message, context)
        if (this.delegate) {
            this.delegate.logInfo(text)
            return
        }
        gs.info(text)
    },

    warn: function (message, context) {
        var text = this.format(message, context)
        if (this.delegate) {
            this.delegate.logWarning(text)
            return
        }
        gs.warn(text)
    },

    error: function (message, context) {
        var text = this.format(message, context)
        if (this.delegate) {
            this.delegate.logErr(text)
            return
        }
        gs.error(text)
    },

    /** Every context object is redacted and truncated before it reaches a log sink. */
    format: function (message, context) {
        var base = '[' + this.source + '] ' + (message === null || message === undefined ? '' : String(message))
        if (context === null || context === undefined) {
            return base
        }
        var extraKeys = gs.getProperty('x_335329_secops.redact.extra_keys', '')
        return base + ' | ' + this.json.forLog(context, 2000, extraKeys)
    },

    type: 'SecOpsLog',
}

/**
 * SecOpsJson - safe JSON parsing, path extraction and secret redaction.
 *
 * Deliberately eval-free: third-party payloads are untrusted input, and a scripted path lookup is
 * the classic injection vector in integration frameworks.
 */
var SecOpsJson = Class.create()

SecOpsJson.prototype = {
    initialize: function () {},

    /** Returns a parsed object, or null when the input is absent or malformed. Never throws. */
    parse: function (raw) {
        if (raw === null || raw === undefined || raw === '') {
            return null
        }
        if (typeof raw === 'object') {
            return raw
        }
        try {
            return JSON.parse(String(raw))
        } catch (e) {
            return null
        }
    },

    /** Returns a JSON string, or '' when the value cannot be serialized. Never throws. */
    stringify: function (value) {
        if (value === null || value === undefined) {
            return ''
        }
        try {
            return JSON.stringify(value)
        } catch (e) {
            return ''
        }
    },

    /**
     * Reads a dotted/bracketed path out of a parsed payload.
     * Supports 'a.b.c', 'a.0.b' and 'a[0].b'. Returns `fallback` (default null) when absent.
     */
    get: function (source, path, fallback) {
        var missing = fallback === undefined ? null : fallback
        if (source === null || source === undefined || !path) {
            return missing
        }

        var segments = this.segments(path)
        var cursor = source

        for (var i = 0; i < segments.length; i++) {
            if (cursor === null || cursor === undefined) {
                return missing
            }
            var key = segments[i]

            if (this.isArray(cursor)) {
                var index = parseInt(key, 10)
                if (isNaN(index) || index < 0 || index >= cursor.length) {
                    return missing
                }
                cursor = cursor[index]
            } else if (typeof cursor === 'object') {
                if (!Object.prototype.hasOwnProperty.call(cursor, key)) {
                    return missing
                }
                cursor = cursor[key]
            } else {
                return missing
            }
        }

        return cursor === undefined ? missing : cursor
    },

    /** Splits 'a[0].b' into ['a','0','b']. */
    segments: function (path) {
        var normalized = String(path).replace(/\[(\d+)\]/g, '.$1')
        var raw = normalized.split('.')
        var out = []
        for (var i = 0; i < raw.length; i++) {
            if (raw[i] !== '') {
                out.push(raw[i])
            }
        }
        return out
    },

    isArray: function (value) {
        return Object.prototype.toString.call(value) === '[object Array]'
    },

    /**
     * Recursively masks values whose key looks like a credential. Applied to every request and
     * response body before it reaches the transaction log or the system log.
     */
    redact: function (value, extraKeys) {
        return this.redactValue(value, this.redactKeys(extraKeys), 0)
    },

    redactKeys: function (extraKeys) {
        var keys = [
            'password',
            'passwd',
            'secret',
            'client_secret',
            'token',
            'access_token',
            'refresh_token',
            'id_token',
            'api_key',
            'apikey',
            'authorization',
            'auth',
            'credential',
            'credentials',
            'private_key',
            'cookie',
            'set-cookie',
            'session',
            'signature',
            'x-api-key',
        ]
        if (typeof extraKeys === 'string' && extraKeys !== '') {
            var extra = extraKeys.split(',')
            for (var i = 0; i < extra.length; i++) {
                var trimmed = extra[i].replace(/^\s+|\s+$/g, '').toLowerCase()
                if (trimmed !== '') {
                    keys.push(trimmed)
                }
            }
        }
        return keys
    },

    redactValue: function (value, keys, depth) {
        if (value === null || value === undefined) {
            return value
        }

        // Fail CLOSED at the recursion limit. Returning the remaining subtree here would write any
        // credential nested deeper than this straight into the transaction log, which viewers can
        // read - the exact thing this function exists to prevent.
        if (depth > 12) {
            return typeof value === 'object' ? '***DEPTH_LIMIT***' : value
        }

        if (this.isArray(value)) {
            var list = []
            for (var i = 0; i < value.length; i++) {
                list.push(this.redactValue(value[i], keys, depth + 1))
            }
            return list
        }

        if (typeof value === 'object') {
            var copy = {}
            for (var key in value) {
                if (!Object.prototype.hasOwnProperty.call(value, key)) {
                    continue
                }
                copy[key] = this.isSecretKey(key, keys) ? '***REDACTED***' : this.redactValue(value[key], keys, depth + 1)
            }
            return copy
        }

        return value
    },

    isSecretKey: function (key, keys) {
        var lowered = String(key).toLowerCase()
        for (var i = 0; i < keys.length; i++) {
            if (lowered.indexOf(keys[i]) !== -1) {
                return true
            }
        }
        return false
    },

    /** Redacts, serializes and truncates in one step - what every log field should store. */
    forLog: function (value, maxLength, extraKeys) {
        var limit = maxLength || 8000
        var text = this.stringify(this.redact(value, extraKeys))
        return this.truncate(text, limit)
    },

    truncate: function (text, maxLength) {
        var limit = maxLength || 8000
        var value = text === null || text === undefined ? '' : String(text)
        if (value.length <= limit) {
            return value
        }
        var marker = '...[truncated]'
        // Too small to fit the marker - a hard cut is the only thing that respects the limit.
        if (limit <= marker.length) {
            return value.substring(0, limit)
        }
        return value.substring(0, limit - marker.length) + marker
    },

    type: 'SecOpsJson',
}

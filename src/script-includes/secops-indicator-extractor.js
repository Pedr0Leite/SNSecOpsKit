/**
 * SecOpsIndicatorExtractor - pulls observables (IOCs) out of free text.
 *
 * Used by the phishing flow to harvest URLs, hashes, IPs, domains and sender addresses from a
 * security incident's description and headers before sending them to a sandbox.
 *
 * Defanged notation commonly used in phishing reports (hxxp://, 1.1.1[.]1) is normalized, because
 * analysts routinely paste defanged indicators into tickets.
 */
var SecOpsIndicatorExtractor = Class.create()

SecOpsIndicatorExtractor.prototype = {
    initialize: function () {},

    /**
     * Returns a de-duplicated array of { type, value } for every indicator found.
     *
     * The type strings are the exact `name` values on sn_ti_observable_type, so they can be used
     * to look up the reference directly. Do not "tidy" the casing - 'IP address (V4)' and
     * 'MD5 hash' are verbatim platform values.
     */
    extract: function (text) {
        var found = []
        if (!text) {
            return found
        }

        var normalized = this.normalize(String(text))
        var seen = {}

        this.collect(found, seen, 'SHA256 hash', normalized.match(/\b[a-fA-F0-9]{64}\b/g))
        this.collect(found, seen, 'SHA1 hash', normalized.match(/\b[a-fA-F0-9]{40}\b/g))
        this.collect(found, seen, 'MD5 hash', normalized.match(/\b[a-fA-F0-9]{32}\b/g))
        this.collect(found, seen, 'URL', normalized.match(/\bhttps?:\/\/[^\s"'<>)\]]+/gi))
        this.collect(found, seen, 'Email address', normalized.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g))
        this.collect(found, seen, 'IP address (V4)', this.ipv4(normalized))
        this.collect(found, seen, 'Domain name', this.domains(normalized, seen))

        return found
    },

    /** Re-fangs defanged indicators so the regexes see real values. */
    normalize: function (text) {
        return text
            .replace(/h(?:xx|XX)(p|P)(s|S)?:\/\//g, 'http$2://')
            .replace(/\[\.\]/g, '.')
            .replace(/\(\.\)/g, '.')
            .replace(/\[:\]/g, ':')
            .replace(/\[at\]/gi, '@')
    },

    /** Only well-formed dotted quads - a bare regex would match version strings like 1.2.3.4. */
    ipv4: function (text) {
        var candidates = text.match(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g)
        if (!candidates) {
            return []
        }
        var valid = []
        for (var i = 0; i < candidates.length; i++) {
            if (this.isIpv4(candidates[i])) {
                valid.push(candidates[i])
            }
        }
        return valid
    },

    isIpv4: function (value) {
        var parts = String(value).split('.')
        if (parts.length !== 4) {
            return false
        }
        for (var i = 0; i < parts.length; i++) {
            var part = parts[i]
            if (!/^\d{1,3}$/.test(part)) {
                return false
            }
            var octet = parseInt(part, 10)
            if (isNaN(octet) || octet < 0 || octet > 255) {
                return false
            }
            // Reject zero-padded octets such as 01.1.1.1 - not a valid presentation form.
            if (part.length > 1 && part.charAt(0) === '0') {
                return false
            }
        }
        return true
    },

    /**
     * Bare domains only. Anything already captured as a URL, email or IP is skipped, so the same
     * string is not reported twice under two different types.
     */
    domains: function (text, seen) {
        var stripped = text
            .replace(/\bhttps?:\/\/[^\s"'<>)\]]+/gi, ' ')
            .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, ' ')

        var candidates = stripped.match(/\b(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}\b/g)
        if (!candidates) {
            return []
        }

        var valid = []
        for (var i = 0; i < candidates.length; i++) {
            var candidate = candidates[i]
            if (this.isIpv4(candidate)) {
                continue
            }
            if (seen && seen[this.key('IP address (V4)', candidate)]) {
                continue
            }
            if (candidate.length > 253) {
                continue
            }
            valid.push(candidate)
        }
        return valid
    },

    collect: function (found, seen, type, matches) {
        if (!matches) {
            return
        }
        for (var i = 0; i < matches.length; i++) {
            var value = String(matches[i]).replace(/[.,;:]+$/, '')
            if (value === '') {
                continue
            }
            var dedupeKey = this.key(type, value)
            if (seen[dedupeKey]) {
                continue
            }
            // A hash already claimed as SHA256/SHA1 must not be re-reported as a shorter hash.
            if (this.claimedByLongerHash(seen, type, value)) {
                continue
            }
            seen[dedupeKey] = true
            found.push({ type: type, value: value })
        }
    },

    claimedByLongerHash: function (seen, type, value) {
        if (type !== 'MD5 hash' && type !== 'SHA1 hash') {
            return false
        }
        return seen[this.key('SHA256 hash', value)] === true || seen[this.key('SHA1 hash', value)] === true
    },

    key: function (type, value) {
        return type + '::' + String(value).toLowerCase()
    },

    type: 'SecOpsIndicatorExtractor',
}

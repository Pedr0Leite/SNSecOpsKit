/**
 * SecOpsTemplate - renders ${path} placeholders against a context object.
 *
 * This is what lets an administrator define a third-party request body as data. It is a literal
 * string substitution with no scripting: a malicious or malformed template can produce a wrong
 * request, but it can never execute code.
 */
var SecOpsTemplate = Class.create()

SecOpsTemplate.prototype = {
    initialize: function () {
        this.json = new SecOpsJson()
    },

    /**
     * Replaces every ${some.path} in `template` with the matching value from `context`.
     * Unresolved placeholders become '' so a half-populated body never ships a literal '${...}'.
     *
     * @param options { jsonEscape: true } escapes each substituted value for a JSON string
     *                position. Use it for any template that is itself JSON - an indicator value
     *                containing a quote or backslash would otherwise break the body or inject
     *                extra keys into the outbound request.
     */
    render: function (template, context, options) {
        if (template === null || template === undefined || template === '') {
            return ''
        }
        var opts = options || {}
        var self = this
        return String(template).replace(/\$\{([^}]+)\}/g, function (match, path) {
            var key = String(path).replace(/^\s+|\s+$/g, '')
            var value = self.json.get(context, key, null)
            var text = self.asText(value)
            return opts.jsonEscape ? self.escapeForJson(text) : text
        })
    },

    /**
     * Escapes a value for use inside a JSON string literal: quotes, backslashes and control
     * characters. Uses the engine's own serializer so the escaping matches the parser.
     */
    escapeForJson: function (text) {
        var serialized = this.json.stringify(String(text))
        if (serialized.length < 2) {
            return ''
        }
        // Drop the surrounding quotes JSON.stringify adds - the template already supplies them.
        return serialized.substring(1, serialized.length - 1)
    },

    /** True when a template is intended to be JSON, so its values need escaping. */
    looksLikeJson: function (template) {
        if (!template) {
            return false
        }
        var trimmed = String(template).replace(/^\s+/, '')
        return trimmed.charAt(0) === '{' || trimmed.charAt(0) === '['
    },

    /** Renders a template and parses the result as JSON. Returns null when the result is invalid. */
    renderJson: function (template, context) {
        var rendered = this.render(template, context, { jsonEscape: true })
        if (rendered === '') {
            return null
        }
        return this.json.parse(rendered)
    },

    /** Lists the placeholder paths a template depends on - used to validate an endpoint config. */
    placeholders: function (template) {
        var found = []
        if (!template) {
            return found
        }
        var pattern = /\$\{([^}]+)\}/g
        var match = pattern.exec(String(template))
        while (match !== null) {
            var key = String(match[1]).replace(/^\s+|\s+$/g, '')
            if (key !== '' && found.indexOf(key) === -1) {
                found.push(key)
            }
            match = pattern.exec(String(template))
        }
        return found
    },

    asText: function (value) {
        if (value === null || value === undefined) {
            return ''
        }
        if (typeof value === 'object') {
            return this.json.stringify(value)
        }
        return String(value)
    },

    type: 'SecOpsTemplate',
}

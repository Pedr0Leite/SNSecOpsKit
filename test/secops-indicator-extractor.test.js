'use strict'

const test = require('node:test')
const assert = require('node:assert')
const { loadScriptIncludes } = require('./harness')

const sandbox = loadScriptIncludes(['secops-indicator-extractor.js'])
const extractor = new sandbox.SecOpsIndicatorExtractor()

function valuesOfType(found, type) {
    return found.filter((f) => f.type === type).map((f) => f.value)
}

test('emits the exact sn_ti_observable_type names, not prettified ones', () => {
    // These strings are verified against sn_ti_observable_type on a real instance. If they drift,
    // every observable this framework creates lands with the wrong type reference.
    const found = extractor.extract('8.8.8.8 evil.example.org user@example.org')
    const types = found.map((f) => f.type)
    assert.ok(types.indexOf('IP address (V4)') !== -1)
    assert.ok(types.indexOf('Domain name') !== -1)
    assert.ok(types.indexOf('Email address') !== -1)
    assert.ok(types.indexOf('IP Address') === -1, 'must not use title-cased platform-foreign names')
})

test('extracts urls, hashes, ips, domains and emails from a phishing body', () => {
    const body = [
        'Please review http://evil.example.com/payload.exe',
        'Attachment SHA256 9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
        'Sent from 203.0.113.42 by attacker@bad-domain.net',
        'Also contacted cdn.malware-host.org',
    ].join('\n')

    const found = extractor.extract(body)

    assert.deepStrictEqual(valuesOfType(found, 'URL'), ['http://evil.example.com/payload.exe'])
    assert.deepStrictEqual(valuesOfType(found, 'SHA256 hash'), [
        '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
    ])
    assert.deepStrictEqual(valuesOfType(found, 'IP address (V4)'), ['203.0.113.42'])
    assert.deepStrictEqual(valuesOfType(found, 'Email address'), ['attacker@bad-domain.net'])
    assert.ok(valuesOfType(found, 'Domain name').indexOf('cdn.malware-host.org') !== -1)
})

test('re-fangs defanged indicators', () => {
    const found = extractor.extract('hxxps://evil[.]com/a and 8[.]8[.]8[.]8')
    assert.deepStrictEqual(valuesOfType(found, 'URL'), ['https://evil.com/a'])
    assert.deepStrictEqual(valuesOfType(found, 'IP address (V4)'), ['8.8.8.8'])
})

test('rejects invalid dotted quads that look like ip addresses', () => {
    const found = extractor.extract('version 1.2.3.4 build 999.999.999.999 and 01.1.1.1')
    const ips = valuesOfType(found, 'IP address (V4)')
    assert.ok(ips.indexOf('999.999.999.999') === -1, 'octets above 255 are not ip addresses')
    assert.ok(ips.indexOf('01.1.1.1') === -1, 'zero-padded octets are not a valid presentation form')
    assert.ok(ips.indexOf('1.2.3.4') !== -1, 'a valid dotted quad is still extracted')
})

test('does not double-report a host that was already captured inside a url or email', () => {
    const found = extractor.extract('http://evil.example.com/x mailto user@evil.example.com')
    const domains = valuesOfType(found, 'Domain name')
    assert.ok(domains.indexOf('evil.example.com') === -1, 'url/email hosts must not re-appear as bare domains')
})

test('does not report an ip address as a domain name', () => {
    const found = extractor.extract('contacted 203.0.113.42 directly')
    assert.deepStrictEqual(valuesOfType(found, 'Domain name'), [])
})

test('distinguishes md5, sha1 and sha256 by length', () => {
    const md5 = 'd41d8cd98f00b204e9800998ecf8427e'
    const sha1 = 'da39a3ee5e6b4b0d3255bfef95601890afd80709'
    const found = extractor.extract(md5 + ' ' + sha1)
    assert.deepStrictEqual(valuesOfType(found, 'MD5 hash'), [md5])
    assert.deepStrictEqual(valuesOfType(found, 'SHA1 hash'), [sha1])
})

test('de-duplicates repeated indicators', () => {
    const found = extractor.extract('8.8.8.8 and again 8.8.8.8')
    assert.deepStrictEqual(valuesOfType(found, 'IP address (V4)'), ['8.8.8.8'])
})

test('strips trailing punctuation from captured values', () => {
    const found = extractor.extract('see http://evil.example.com/a, then stop.')
    assert.deepStrictEqual(valuesOfType(found, 'URL'), ['http://evil.example.com/a'])
})

test('returns an empty array for empty input', () => {
    assert.deepStrictEqual(extractor.extract(''), [])
    assert.deepStrictEqual(extractor.extract(null), [])
    assert.deepStrictEqual(extractor.extract(undefined), [])
})

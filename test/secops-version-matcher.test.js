'use strict'

const test = require('node:test')
const assert = require('node:assert')
const { loadScriptIncludes } = require('./harness')

/**
 * The version matcher decides whether this instance is exposed to a CVE. It is the one piece of
 * this feature that can be confidently wrong, so it carries the most tests.
 *
 * The two fixtures below are REAL data, copied from the published records on 2026-09-16:
 *   CVE-2026-18885  CVSS 10   lists "Australia Patch 3 Hot Fix 2"
 *   CVE-2026-6875   CVSS 9.5  lists "Australia Patch 2" and nothing later on that line
 *
 * Against a real instance build tag of glide-australia-02-11-2026__patch3-05-25-2026 the correct
 * answers are "affected" and "not affected" respectively. If either flips, the matcher is broken in
 * a way that would mislead somebody about a critical vulnerability.
 */

const BUILD = 'glide-australia-02-11-2026__patch3-05-25-2026'

const CVE_2026_18885 = [
    'Xanadu Patch 11 Hot Fix 7a',
    'Yokohama Patch 12 Hot Fix 3b',
    'Yokohama Patch 13 Hot Fix 4',
    'Zurich Patch 7b Hot Fix 3',
    'Zurich Patch 8 Hot Fix 5',
    'Zurich Patch 9 Hot Fix 6',
    'Zurich Patch 10 Hot Fix 2m (m-branch)',
    'Zurich Patch 10 Hot Fix 3 (standard)',
    'Zurich Patch 11',
    'Zurich Patch 12',
    'Australia Patch 2 Hot Fix 3',
    'Australia Patch 3 Hot Fix 2',
    'Australia Patch 3m',
    'Australia Patch 4',
    'Australia Patch 5',
]

const CVE_2026_6875 = [
    'Australia Patch 2',
    'Yokohama Patch 12 Hot Fix 1b',
    'Yokohama Patch 13',
    'Zurich Patch 7b',
    'Zurich Patch 9',
    'Brazil EA',
    'Brazil GA',
]

const sandbox = loadScriptIncludes(['secops-json.js', 'secops-log.js', 'secops-version-matcher.js'])

function matcher() {
    return new sandbox.SecOpsVersionMatcher()
}

// --------------------------------------------------------------- parsing

test('a real build tag parses into family, patch and no hot fix', () => {
    const parsed = matcher().parseBuildTag(BUILD)
    assert.strictEqual(parsed.family, 'australia')
    assert.strictEqual(parsed.patch, 3)
    assert.strictEqual(parsed.hotfix, null)
    assert.strictEqual(parsed.mBranch, false)
})

test('a build tag with a hot fix parses its number', () => {
    const parsed = matcher().parseBuildTag('glide-zurich-06-25-2025__patch10-hotfix3-08-14-2025')
    assert.strictEqual(parsed.family, 'zurich')
    assert.strictEqual(parsed.patch, 10)
    assert.strictEqual(parsed.hotfix, 3)
})

test('an unparseable build tag returns null rather than a half-populated object', () => {
    const m = matcher()
    assert.strictEqual(m.parseBuildTag(''), null)
    assert.strictEqual(m.parseBuildTag('not-a-build-tag'), null)
    assert.strictEqual(m.parseBuildTag(null), null)
})

test('CNA version strings parse, including suffixes and branch markers', () => {
    const m = matcher()

    const standard = m.parseVersionString('Zurich Patch 10 Hot Fix 3 (standard)')
    assert.strictEqual(standard.family, 'zurich')
    assert.strictEqual(standard.patch, 10)
    assert.strictEqual(standard.hotfix, 3)
    assert.strictEqual(standard.mBranch, false)

    const mBranch = m.parseVersionString('Zurich Patch 10 Hot Fix 2m (m-branch)')
    assert.strictEqual(mBranch.mBranch, true, 'an m-branch build is a parallel line, not a later one')

    const lettered = m.parseVersionString('Zurich Patch 7b Hot Fix 3')
    assert.strictEqual(lettered.patch, 7)
    assert.strictEqual(lettered.patchSuffix, 'b')

    const twoWord = m.parseVersionString('Washington DC Patch 5')
    assert.strictEqual(twoWord.family, 'washingtondc', 'a two-word family name must normalise')

    const noPatch = m.parseVersionString('Brazil EA')
    assert.strictEqual(noPatch.family, 'brazil')
    assert.strictEqual(noPatch.patch, null, 'no patch number is null, never zero')
})

// ------------------------------------------------- the real CVE fixtures

test('REAL: CVE-2026-18885 correctly reports this instance as affected', () => {
    const result = matcher().assess(BUILD, CVE_2026_18885)
    assert.strictEqual(result.relevance, 'affected')
    assert.strictEqual(result.matched, 'Australia Patch 3 Hot Fix 2')
    assert.ok(result.reason.includes('Australia Patch 3'), 'the reason must name the build it judged')
})

test('REAL: CVE-2026-6875 correctly reports this instance as not affected', () => {
    const result = matcher().assess(BUILD, CVE_2026_6875)
    assert.strictEqual(result.relevance, 'not_affected')
    assert.strictEqual(result.matched, 'Australia Patch 2')
    assert.ok(result.reason.includes('above every fix line'))
})

// ------------------------------------------------------ within a family

test('a hot fix at or above the threshold is not affected', () => {
    const m = matcher()
    assert.strictEqual(
        m.assess('glide-australia-02-11-2026__patch3-hotfix2-05-25-2026', CVE_2026_18885).relevance,
        'not_affected'
    )
    assert.strictEqual(
        m.assess('glide-australia-02-11-2026__patch3-hotfix9-05-25-2026', CVE_2026_18885).relevance,
        'not_affected'
    )
})

test('a hot fix below the threshold is affected', () => {
    const result = matcher().assess('glide-australia-02-11-2026__patch3-hotfix1-05-25-2026', CVE_2026_18885)
    assert.strictEqual(result.relevance, 'affected')
})

test('a patch line older than every published fix line is affected, and says upgrading is the remedy', () => {
    const result = matcher().assess('glide-australia-01-01-2026__patch1-01-01-2026', CVE_2026_18885)
    assert.strictEqual(result.relevance, 'affected')
    assert.ok(result.reason.includes('upgrad'), 'no hot fix covers an unsupported patch line')
})

test('a threshold naming a patch with no hot fix means that patch carries the fix', () => {
    // CVE-2026-18885 lists a bare "Zurich Patch 11"
    const result = matcher().assess('glide-zurich-06-25-2025__patch11-08-14-2025', CVE_2026_18885)
    assert.strictEqual(result.relevance, 'not_affected')
    assert.strictEqual(result.matched, 'Zurich Patch 11')
})

test('a lettered patch sorts after the plain one', () => {
    const m = matcher()
    assert.strictEqual(m.comparePart(7, '', 7, 'b'), -1)
    assert.strictEqual(m.comparePart(7, 'b', 7, ''), 1)
    assert.strictEqual(m.comparePart(7, 'b', 7, 'b'), 0)
    assert.strictEqual(m.comparePart(8, '', 7, 'b'), 1)
})

// ---------------------------------------------------------- the m-branch

test('an m-branch threshold is not applied to a standard instance', () => {
    // Only "Zurich Patch 10 Hot Fix 2m (m-branch)" and "Hot Fix 3 (standard)" exist for patch 10.
    // A standard instance must be judged against the standard one.
    const result = matcher().assess('glide-zurich-06-25-2025__patch10-08-14-2025', CVE_2026_18885)
    assert.strictEqual(result.relevance, 'affected')
    assert.strictEqual(result.matched, 'Zurich Patch 10 Hot Fix 3 (standard)')
})

// ------------------------------------------------------ across families

test('a release newer than every family the CVE names is not affected', () => {
    const result = matcher().assess(BUILD, ['Zurich Patch 9 Hot Fix 6', 'Yokohama Patch 13 Hot Fix 4'])
    assert.strictEqual(result.relevance, 'not_affected')
    assert.ok(result.reason.includes('released after'))
})

test('a release older than every family the CVE names is affected', () => {
    const result = matcher().assess('glide-utah-01-01-2023__patch1-01-01-2023', ['Zurich Patch 9', 'Australia Patch 2'])
    assert.strictEqual(result.relevance, 'affected')
})

test('a release sitting between the named families, unlisted, is unknown', () => {
    const result = matcher().assess('glide-xanadu-01-01-2024__patch5-01-01-2024', ['Vancouver Patch 3', 'Zurich Patch 9'])
    assert.strictEqual(result.relevance, 'unknown')
})

// --------------------------------------------------- refusing to guess

test('an unknown release family is unknown, never a guess', () => {
    const result = matcher().assess('glide-caledonia-01-01-2027__patch1-01-01-2027', CVE_2026_18885)
    assert.strictEqual(result.relevance, 'unknown')
    assert.ok(result.reason.includes('FAMILIES'), 'the reason must tell a maintainer how to fix it')
})

test('an empty affected-version list is unknown, not "not affected"', () => {
    const m = matcher()
    assert.strictEqual(m.assess(BUILD, []).relevance, 'unknown')
    assert.strictEqual(m.assess(BUILD, null).relevance, 'unknown')
})

test('version strings that parse to nothing usable are unknown', () => {
    const result = matcher().assess(BUILD, ['see the vendor advisory', 'all supported releases'])
    assert.strictEqual(result.relevance, 'unknown')
})

test('an unreadable build tag is unknown for every CVE', () => {
    const result = matcher().assess('', CVE_2026_18885)
    assert.strictEqual(result.relevance, 'unknown')
    assert.ok(result.reason.includes('build tag'))
})

test('every verdict carries a human-readable reason', () => {
    const m = matcher()
    const cases = [
        [BUILD, CVE_2026_18885],
        [BUILD, CVE_2026_6875],
        ['', CVE_2026_18885],
        [BUILD, []],
        ['glide-caledonia-01-01-2027__patch1-01-01-2027', CVE_2026_18885],
    ]
    cases.forEach(([build, thresholds]) => {
        const result = m.assess(build, thresholds)
        assert.ok(['affected', 'not_affected', 'unknown'].includes(result.relevance))
        assert.ok(typeof result.reason === 'string' && result.reason.length > 20, 'a bare verdict is not defensible')
    })
})

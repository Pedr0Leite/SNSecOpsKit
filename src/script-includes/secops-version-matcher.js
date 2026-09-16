/**
 * SecOpsVersionMatcher - decides whether this instance's build is below a CVE's fix threshold.
 *
 * Pure logic, no I/O, so it is unit-testable. Every judgement it makes comes back with a reason
 * string, because "affected" and "not affected" are both claims a human may have to defend.
 *
 * THE DATA IT WORKS ON
 *
 * ServiceNow is its own CNA, and publishes affected versions on the CVE record as custom strings:
 *
 *     { "version": "0", "lessThan": "Zurich Patch 10 Hot Fix 3 (standard)", "versionType": "custom" }
 *     { "version": "0", "lessThan": "Australia Patch 3 Hot Fix 2",         "versionType": "custom" }
 *
 * One entry per supported patch LINE, and `lessThan` means exactly that: anything below the
 * threshold on that line is affected. NVD carries no CPE data for these CVEs at all, so this
 * string parsing is the only automated matching available.
 *
 * WHY IT RETURNS 'unknown' SO READILY
 *
 * These strings are written by humans and the format drifts - branch suffixes, "(standard)",
 * "(m-branch)", "Brazil EA" with no patch number at all. A matcher that guessed would eventually
 * tell somebody they were safe when they were not. So anything it cannot read confidently comes
 * back 'unknown', and the caller is expected to treat unknown as "needs a human", not as "fine".
 *
 * The vendor's own security advisory (the KB article linked from the CVE) is always authoritative.
 * This is triage, not proof.
 */
var SecOpsVersionMatcher = Class.create()

SecOpsVersionMatcher.prototype = {
    initialize: function () {
        this.log = new SecOpsLog('SecOpsVersionMatcher')
    },

    /**
     * Release families oldest to newest.
     *
     * Needed because the naming is NOT sortable: it ran alphabetically to Zurich and then restarted
     * with country names, so 'australia' is newer than 'zurich' while sorting before it. A family
     * absent from this list yields 'unknown' rather than a guess - extend the list when ServiceNow
     * ships a new release.
     */
    FAMILIES: [
        'orlando',
        'paris',
        'quebec',
        'rome',
        'sandiego',
        'tokyo',
        'utah',
        'vancouver',
        'washingtondc',
        'xanadu',
        'yokohama',
        'zurich',
        'australia',
        'brazil',
    ],

    AFFECTED: 'affected',
    NOT_AFFECTED: 'not_affected',
    UNKNOWN: 'unknown',

    /**
     * Parses an instance build tag.
     *
     * Examples seen in the wild:
     *   glide-australia-02-11-2026__patch3-05-25-2026
     *   glide-zurich-06-25-2025__patch1-08-14-2025
     *
     * @returns { family, familyLabel, patch, patchSuffix, hotfix, hotfixSuffix, mBranch, raw } or null
     */
    parseBuildTag: function (tag) {
        if (!tag) {
            return null
        }
        var text = String(tag)

        var family = null
        var familyMatch = /^glide-([a-z0-9]+)-\d{2}-\d{2}-\d{4}/i.exec(text)
        if (familyMatch) {
            family = this.normalizeFamily(familyMatch[1])
        }
        if (!family) {
            return null
        }

        var parsed = this.parsePatchParts(text)
        return {
            family: family,
            familyLabel: familyMatch[1],
            patch: parsed.patch,
            patchSuffix: parsed.patchSuffix,
            hotfix: parsed.hotfix,
            hotfixSuffix: parsed.hotfixSuffix,
            mBranch: parsed.mBranch,
            raw: text,
        }
    },

    /**
     * Parses a CNA version string such as "Zurich Patch 10 Hot Fix 3 (standard)".
     *
     * A string with no recognisable patch number (for example "Brazil EA") parses with patch null,
     * which assess() treats as unusable rather than as patch zero.
     */
    parseVersionString: function (value) {
        if (!value) {
            return null
        }
        var text = String(value).replace(/^\s+|\s+$/g, '')

        // The family is everything before the first structural keyword.
        var head = text.split(/\s+(?:patch|hot\s*fix|ea\b|ga\b|early|general)/i)[0]
        var family = this.normalizeFamily(head)
        if (!family) {
            return null
        }

        var parsed = this.parsePatchParts(text)
        return {
            family: family,
            familyLabel: head.replace(/^\s+|\s+$/g, ''),
            patch: parsed.patch,
            patchSuffix: parsed.patchSuffix,
            hotfix: parsed.hotfix,
            hotfixSuffix: parsed.hotfixSuffix,
            mBranch: parsed.mBranch,
            raw: text,
        }
    },

    /** Shared patch/hot-fix extraction. Works on both build tags and prose version strings. */
    parsePatchParts: function (text) {
        var out = { patch: null, patchSuffix: '', hotfix: null, hotfixSuffix: '', mBranch: false }

        // The letter suffix must be GLUED to its digits: "Patch 7b" has one, "Patch 3 Hot Fix 2"
        // does not. Allowing whitespace between them made "Patch 3 Hot" parse as suffix "hot",
        // which silently broke every exact patch-line match.
        var patch = /patch\s*-?\s*(\d+)([a-z]*)/i.exec(text)
        if (patch) {
            out.patch = parseInt(patch[1], 10)
            out.patchSuffix = String(patch[2] || '').toLowerCase()
        }

        var hotfix = /hot\s*-?\s*fix\s*-?\s*(\d+)([a-z]*)/i.exec(text)
        if (hotfix) {
            out.hotfix = parseInt(hotfix[1], 10)
            out.hotfixSuffix = String(hotfix[2] || '').toLowerCase()
        }

        // The m-branch is a parallel line, not a later build. Comparing across it is meaningless.
        out.mBranch =
            /\(m-?branch\)/i.test(text) || out.patchSuffix === 'm' || out.hotfixSuffix === 'm' || /-m\b/i.test(text)

        return out
    },

    normalizeFamily: function (value) {
        if (!value) {
            return null
        }
        var cleaned = String(value)
            .toLowerCase()
            .replace(/[^a-z]/g, '')
        return cleaned === '' ? null : cleaned
    },

    familyRank: function (family) {
        return this.FAMILIES.indexOf(family)
    },

    /**
     * Orders two (number, suffix) pairs. An empty suffix sorts before a lettered one, so
     * Patch 7 < Patch 7b, and Hot Fix 3 < Hot Fix 3a.
     */
    comparePart: function (aNum, aSuffix, bNum, bSuffix) {
        var left = aNum === null || aNum === undefined ? -1 : aNum
        var right = bNum === null || bNum === undefined ? -1 : bNum
        if (left !== right) {
            return left < right ? -1 : 1
        }
        var ls = String(aSuffix || '')
        var rs = String(bSuffix || '')
        if (ls === rs) {
            return 0
        }
        return ls < rs ? -1 : 1
    },

    /**
     * Assesses one instance build against every version threshold on a CVE.
     *
     * @param build      output of parseBuildTag, or a build tag string
     * @param thresholds array of CNA version strings (the `lessThan` values)
     * @returns { relevance, reason, matched }  relevance is affected | not_affected | unknown
     */
    assess: function (build, thresholds) {
        var mine = typeof build === 'string' ? this.parseBuildTag(build) : build

        if (!mine) {
            return this.verdict(this.UNKNOWN, 'The instance build tag could not be parsed.')
        }
        if (!thresholds || thresholds.length === 0) {
            return this.verdict(this.UNKNOWN, 'The CVE record lists no affected versions.')
        }

        var parsed = []
        for (var i = 0; i < thresholds.length; i++) {
            var entry = this.parseVersionString(thresholds[i])
            if (entry) {
                parsed.push(entry)
            }
        }
        if (parsed.length === 0) {
            return this.verdict(this.UNKNOWN, 'None of the listed versions could be parsed.')
        }

        if (this.familyRank(mine.family) === -1) {
            return this.verdict(
                this.UNKNOWN,
                'Release family "' + mine.familyLabel + '" is not in the known family list - it may be newer than this application. Add it to SecOpsVersionMatcher.FAMILIES.'
            )
        }

        // Only thresholds on the same release line are comparable. An m-branch threshold is a
        // parallel line: usable only for an m-branch instance, and vice versa.
        var sameFamily = []
        for (var f = 0; f < parsed.length; f++) {
            if (parsed[f].family === mine.family && parsed[f].mBranch === mine.mBranch) {
                sameFamily.push(parsed[f])
            }
        }

        if (sameFamily.length > 0) {
            return this.assessWithinFamily(mine, sameFamily)
        }

        return this.assessAcrossFamilies(mine, parsed)
    },

    /** The common case: the CVE names fix thresholds on this instance's own release line. */
    assessWithinFamily: function (mine, entries) {
        var usable = []
        var minEntry = null
        var maxEntry = null

        for (var i = 0; i < entries.length; i++) {
            if (entries[i].patch === null) {
                continue
            }
            usable.push(entries[i])
            if (!minEntry || this.comparePart(entries[i].patch, entries[i].patchSuffix, minEntry.patch, minEntry.patchSuffix) < 0) {
                minEntry = entries[i]
            }
            if (!maxEntry || this.comparePart(entries[i].patch, entries[i].patchSuffix, maxEntry.patch, maxEntry.patchSuffix) > 0) {
                maxEntry = entries[i]
            }
        }

        if (usable.length === 0) {
            return this.verdict(
                this.UNKNOWN,
                'Thresholds exist for ' + mine.familyLabel + ' but none names a patch number (for example "' + entries[0].raw + '").'
            )
        }

        if (mine.patch === null) {
            return this.verdict(this.UNKNOWN, 'The instance build tag names no patch number, so it cannot be compared.')
        }

        // An exact patch-line match is the authoritative comparison.
        for (var e = 0; e < usable.length; e++) {
            var entry = usable[e]
            if (this.comparePart(mine.patch, mine.patchSuffix, entry.patch, entry.patchSuffix) !== 0) {
                continue
            }

            // "Zurich Patch 11" with no hot fix means the patch itself carries the fix.
            if (entry.hotfix === null) {
                return this.verdict(
                    this.NOT_AFFECTED,
                    'Patch ' + this.patchLabel(mine) + ' is the fix release named by "' + entry.raw + '".',
                    entry.raw
                )
            }

            var myHotfix = mine.hotfix === null ? 0 : mine.hotfix
            var comparison = this.comparePart(myHotfix, mine.hotfixSuffix, entry.hotfix, entry.hotfixSuffix)

            if (comparison < 0) {
                return this.verdict(
                    this.AFFECTED,
                    'This instance is on ' + this.buildLabel(mine) + ', below the fix threshold "' + entry.raw + '".',
                    entry.raw
                )
            }
            return this.verdict(
                this.NOT_AFFECTED,
                'This instance is on ' + this.buildLabel(mine) + ', at or above the fix threshold "' + entry.raw + '".',
                entry.raw
            )
        }

        // No threshold for this exact patch line.
        if (this.comparePart(mine.patch, mine.patchSuffix, minEntry.patch, minEntry.patchSuffix) < 0) {
            return this.verdict(
                this.AFFECTED,
                'Patch ' + this.patchLabel(mine) + ' is below every fix line published for ' + mine.familyLabel +
                    ' (earliest is "' + minEntry.raw + '"), so no hot fix covers it - upgrading is the remedy.',
                minEntry.raw
            )
        }

        if (this.comparePart(mine.patch, mine.patchSuffix, maxEntry.patch, maxEntry.patchSuffix) > 0) {
            return this.verdict(
                this.NOT_AFFECTED,
                'Patch ' + this.patchLabel(mine) + ' is above every fix line published for ' + mine.familyLabel +
                    ' (latest is "' + maxEntry.raw + '").',
                maxEntry.raw
            )
        }

        return this.verdict(
            this.UNKNOWN,
            'Patch ' + this.patchLabel(mine) + ' falls between the published fix lines for ' + mine.familyLabel +
                ' but matches none of them exactly. Check the vendor advisory.'
        )
    },

    /** The CVE names other releases entirely. Position by family, and say so. */
    assessAcrossFamilies: function (mine, parsed) {
        var myRank = this.familyRank(mine.family)
        var newest = -1
        var oldest = Number.MAX_VALUE
        var newestLabel = ''
        var oldestLabel = ''
        var unknownFamily = null

        for (var i = 0; i < parsed.length; i++) {
            var rank = this.familyRank(parsed[i].family)
            if (rank === -1) {
                unknownFamily = parsed[i].familyLabel
                continue
            }
            if (rank > newest) {
                newest = rank
                newestLabel = parsed[i].familyLabel
            }
            if (rank < oldest) {
                oldest = rank
                oldestLabel = parsed[i].familyLabel
            }
        }

        if (newest === -1) {
            return this.verdict(
                this.UNKNOWN,
                'The CVE names release families this application does not recognise' +
                    (unknownFamily ? ' (for example "' + unknownFamily + '")' : '') + '.'
            )
        }

        if (myRank > newest) {
            return this.verdict(
                this.NOT_AFFECTED,
                'This instance runs ' + mine.familyLabel + ', released after every family the CVE names (newest is ' +
                    newestLabel + '), so the fix predates this build.'
            )
        }

        if (myRank < oldest) {
            return this.verdict(
                this.AFFECTED,
                'This instance runs ' + mine.familyLabel + ', older than every family the CVE names (earliest is ' +
                    oldestLabel + '), and no fix line is published for it.'
            )
        }

        return this.verdict(
            this.UNKNOWN,
            'This instance runs ' + mine.familyLabel + ', which sits between the families the CVE names (' +
                oldestLabel + ' to ' + newestLabel + ') but is not itself listed.'
        )
    },

    patchLabel: function (parsed) {
        return String(parsed.patch === null ? '?' : parsed.patch) + (parsed.patchSuffix || '')
    },

    buildLabel: function (parsed) {
        var label = parsed.familyLabel + ' Patch ' + this.patchLabel(parsed)
        if (parsed.hotfix !== null) {
            label += ' Hot Fix ' + parsed.hotfix + (parsed.hotfixSuffix || '')
        }
        if (parsed.mBranch) {
            label += ' (m-branch)'
        }
        return label
    },

    verdict: function (relevance, reason, matched) {
        return { relevance: relevance, reason: reason, matched: matched || null }
    },

    type: 'SecOpsVersionMatcher',
}

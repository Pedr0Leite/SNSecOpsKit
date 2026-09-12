import '@servicenow/sdk/global'
import { ScriptInclude } from '@servicenow/sdk/core'

/**
 * Infrastructure layer. These are internal to the application (package_private) - integrators
 * extend the framework through configuration records and the handler classes, not by calling these
 * directly from another scope.
 */

export const SecOpsJson = ScriptInclude({
    $id: Now.ID['si-secops-json'],
    name: 'SecOpsJson',
    description: 'Safe JSON parsing, path extraction and credential redaction. No eval.',
    script: Now.include('../../script-includes/secops-json.js'),
    accessibleFrom: 'package_private',
})

export const SecOpsLog = ScriptInclude({
    $id: Now.ID['si-secops-log'],
    name: 'SecOpsLog',
    description: 'Level-aware logging via GSLog with automatic redaction and a gs.* fallback.',
    script: Now.include('../../script-includes/secops-log.js'),
    accessibleFrom: 'package_private',
})

export const SecOpsTemplate = ScriptInclude({
    $id: Now.ID['si-secops-template'],
    name: 'SecOpsTemplate',
    description: 'Renders ${path} placeholders in endpoint paths, headers and bodies. Substitution only.',
    script: Now.include('../../script-includes/secops-template.js'),
    accessibleFrom: 'package_private',
})

export const SecOpsRegistry = ScriptInclude({
    $id: Now.ID['si-secops-registry'],
    name: 'SecOpsRegistry',
    description: 'Configuration layer: connector, endpoint, mapping and property lookups.',
    script: Now.include('../../script-includes/secops-registry.js'),
    accessibleFrom: 'package_private',
})

export const SecOpsTransactionLogger = ScriptInclude({
    $id: Now.ID['si-secops-transaction-logger'],
    name: 'SecOpsTransactionLogger',
    description: 'Opens and closes the redacted audit record for every connector call.',
    script: Now.include('../../script-includes/secops-transaction-logger.js'),
    accessibleFrom: 'package_private',
})

export const SecOpsRestClient = ScriptInclude({
    $id: Now.ID['si-secops-rest-client'],
    name: 'SecOpsRestClient',
    description: 'Outbound HTTP engine: credential resolution, retries and transaction logging.',
    script: Now.include('../../script-includes/secops-rest-client.js'),
    accessibleFrom: 'package_private',
})

export const SecOpsFieldMapper = ScriptInclude({
    $id: Now.ID['si-secops-field-mapper'],
    name: 'SecOpsFieldMapper',
    description: 'Applies declarative field mapping rules to a third-party payload.',
    script: Now.include('../../script-includes/secops-field-mapper.js'),
    accessibleFrom: 'package_private',
})

export const SecOpsTargetWriter = ScriptInclude({
    $id: Now.ID['si-secops-target-writer'],
    name: 'SecOpsTargetWriter',
    description: 'Schema-checked, permission-checked writes into SecOps-owned tables.',
    script: Now.include('../../script-includes/secops-target-writer.js'),
    accessibleFrom: 'package_private',
})

export const SecOpsIndicatorExtractor = ScriptInclude({
    $id: Now.ID['si-secops-indicator-extractor'],
    name: 'SecOpsIndicatorExtractor',
    description: 'Extracts URLs, hashes, IPs, domains and addresses (including defanged) from text.',
    script: Now.include('../../script-includes/secops-indicator-extractor.js'),
    accessibleFrom: 'package_private',
})

export const SecOpsWorkQueue = ScriptInclude({
    $id: Now.ID['si-secops-work-queue'],
    name: 'SecOpsWorkQueue',
    description:
        'Unified analyst work queue: SIR incidents, SIR tasks and vulnerability findings, normalised and ACL-enforced.',
    script: Now.include('../../script-includes/secops-work-queue.js'),
    accessibleFrom: 'package_private',
})

export const SecOpsMetrics = ScriptInclude({
    $id: Now.ID['si-secops-metrics'],
    name: 'SecOpsMetrics',
    description: 'Organisation-wide aggregate metrics for the security overview page. Counts only.',
    script: Now.include('../../script-includes/secops-metrics.js'),
    accessibleFrom: 'package_private',
})

export const SecOpsHealthChecker = ScriptInclude({
    $id: Now.ID['si-secops-health-checker'],
    name: 'SecOpsHealthChecker',
    description: 'Tests connector reachability and records the verdict on the connector record.',
    script: Now.include('../../script-includes/secops-health-checker.js'),
    accessibleFrom: 'package_private',
})

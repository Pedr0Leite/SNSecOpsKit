import '@servicenow/sdk/global'
import { ScriptInclude } from '@servicenow/sdk/core'

/**
 * Handler layer - the public API of the framework.
 *
 * These are accessibleFrom 'public' because Flow Designer actions, other scoped applications and
 * integration code are expected to call them by name. Everything below extends
 * SecOpsUniversalPayloadHandler.
 */

export const SecOpsUniversalPayloadHandler = ScriptInclude({
    $id: Now.ID['si-secops-universal-payload-handler'],
    name: 'SecOpsUniversalPayloadHandler',
    description:
        'Abstract handler: resolve endpoint, call, unwrap, map, write. Extend this to add a new capability.',
    script: Now.include('../../script-includes/secops-universal-payload-handler.js'),
    accessibleFrom: 'public',
})

export const SecOpsThreatIntelHandler = ScriptInclude({
    $id: Now.ID['si-secops-threat-intel-handler'],
    name: 'SecOpsThreatIntelHandler',
    description: 'Enriches a Threat Intelligence observable and writes Threat Lookup Results.',
    script: Now.include('../../script-includes/secops-threat-intel-handler.js'),
    accessibleFrom: 'public',
})

export const SecOpsPhishingHandler = ScriptInclude({
    $id: Now.ID['si-secops-phishing-handler'],
    name: 'SecOpsPhishingHandler',
    description: 'Extracts indicators from a security incident, detonates them and returns a disposition.',
    script: Now.include('../../script-includes/secops-phishing-handler.js'),
    accessibleFrom: 'public',
})

export const SecOpsVulnIngestionHandler = ScriptInclude({
    $id: Now.ID['si-secops-vuln-ingestion-handler'],
    name: 'SecOpsVulnIngestionHandler',
    description: 'Stages third-party vulnerability telemetry and optionally promotes it into VR.',
    script: Now.include('../../script-includes/secops-vuln-ingestion-handler.js'),
    accessibleFrom: 'public',
})

export const SecOpsContainmentHandler = ScriptInclude({
    $id: Now.ID['si-secops-containment-handler'],
    name: 'SecOpsContainmentHandler',
    description: 'Requests endpoint isolation or network blocking from an EDR / firewall connector.',
    script: Now.include('../../script-includes/secops-containment-handler.js'),
    accessibleFrom: 'public',
})

export const SecOpsConsoleAjax = ScriptInclude({
    $id: Now.ID['si-secops-console-ajax'],
    name: 'SecOpsConsoleAjax',
    description: 'GlideAjax surface for the connector console. Re-checks roles on every call.',
    script: Now.include('../../script-includes/secops-console-ajax.js'),
    clientCallable: true,
    accessibleFrom: 'public',
})

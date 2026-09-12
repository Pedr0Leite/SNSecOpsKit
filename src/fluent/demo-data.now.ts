import '@servicenow/sdk/global'
import { Record } from '@servicenow/sdk/core'

/**
 * Sample configuration - installed as DEMO data only.
 *
 * It demonstrates the full onboarding shape (connector -> endpoint -> field mappings) for a
 * generic threat intelligence lookup, so an administrator can see a working example before wiring
 * a real vendor.
 *
 * It is deliberately INACTIVE and points at example.com. It holds no credentials and names no real
 * vendor: activating it without pointing it at a real service and alias will simply fail its
 * health check, which is the safe outcome.
 */

export const demoConnector = Record({
    $id: Now.ID['demo-connector-threat-intel'],
    $meta: { installMethod: 'demo' },
    table: 'x_335329_secops_connector',
    data: {
        name: 'Example Threat Intelligence (sample)',
        vendor: 'Example Security',
        category: 'threat_intel',
        active: false,
        base_url: 'https://api.example.com',
        auth_type: 'alias',
        http_timeout_ms: 30000,
        max_retries: 2,
        health_endpoint_path: '/v1/status',
        health_status: 'unknown',
        description:
            'Sample connector showing how a threat intelligence source is onboarded. Inactive and unauthenticated - point it at a real service and a Connection & Credential Alias, then activate.',
    },
})

export const demoEnrichEndpoint = Record({
    $id: Now.ID['demo-endpoint-enrich'],
    $meta: { installMethod: 'demo' },
    table: 'x_335329_secops_endpoints',
    data: {
        name: 'Look up indicator',
        connector: demoConnector,
        capability: 'enrich',
        active: false,
        http_method: 'post',
        path: '/v1/indicators/lookup',
        request_template: '{"indicator":"${ioc}","type":"${type}"}',
        response_root: 'data',
        success_codes: '200,201',
        order: 100,
        description:
            'Sends the observable value to the third party and expects a verdict. ${ioc} and ${type} are supplied by SecOpsThreatIntelHandler.',
    },
})

export const demoHealthEndpoint = Record({
    $id: Now.ID['demo-endpoint-health'],
    $meta: { installMethod: 'demo' },
    table: 'x_335329_secops_endpoints',
    data: {
        name: 'Service status',
        connector: demoConnector,
        capability: 'health',
        active: false,
        http_method: 'get',
        path: '/v1/status',
        success_codes: '200',
        order: 100,
        description: 'Cheap reachability probe used by the health sweep and the console Test button.',
    },
})

export const demoMapFinding = Record({
    $id: Now.ID['demo-map-finding'],
    $meta: { installMethod: 'demo' },
    table: 'x_335329_secops_field_map',
    data: {
        endpoint: demoEnrichEndpoint,
        source_path: 'attributes.verdict',
        target_table: 'sn_ti_lookup_result',
        target_field: 'finding',
        transform: 'none',
        mandatory: false,
        order: 100,
    },
})

/**
 * A non-`finding` mapping on an enrich endpoint. This is honoured: SecOpsThreatIntelHandler builds
 * a default Threat Lookup Result value set and then lets explicit mappings override it (everything
 * except `finding`, which is normalised to a platform choice before the write).
 */
export const demoMapDetails = Record({
    $id: Now.ID['demo-map-details'],
    $meta: { installMethod: 'demo' },
    table: 'x_335329_secops_field_map',
    data: {
        endpoint: demoEnrichEndpoint,
        source_path: 'attributes.score',
        target_table: 'sn_ti_lookup_result',
        target_field: 'result',
        transform: 'none',
        mandatory: false,
        order: 200,
    },
})

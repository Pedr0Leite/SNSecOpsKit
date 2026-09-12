import '@servicenow/sdk/global'
import { RestApi } from '@servicenow/sdk/core'

/**
 * Inbound API for third-party security tools.
 *
 * Both routes require authentication and are additionally gated by the rest_endpoint ACL in
 * security/acls.now.ts, which requires the application admin role.
 */
export const ingestionApi = RestApi({
    $id: Now.ID['api-secops-connector'],
    name: 'SecOps Universal Connector Ingestion',
    serviceId: 'secops_connector',
    shortDescription: 'Inbound telemetry and connector health for the SecOps Universal Connector Framework.',
    active: true,
    consumes: 'application/json',
    produces: 'application/json',
    routes: [
        {
            $id: Now.ID['api-route-ingest-vulnerability'],
            name: 'Ingest vulnerability telemetry',
            path: '/vulnerability',
            method: 'POST',
            active: true,
            shortDescription: 'Stages third-party vulnerability findings for review and optional promotion into VR.',
            authentication: true,
            authorization: true,
            consumes: 'application/json',
            produces: 'application/json',
            script: Now.include('../../rest/ingest-vulnerability.js'),
            parameters: [
                {
                    $id: Now.ID['api-param-source'],
                    name: 'source',
                    required: true,
                    exampleValue: 'AcmeScanner',
                    shortDescription: 'Feed name. Combined with each record id to de-duplicate staged rows.',
                },
                {
                    $id: Now.ID['api-param-records-path'],
                    name: 'records_path',
                    required: false,
                    exampleValue: 'data.findings',
                    shortDescription: 'Dotted path to the array of records inside the payload.',
                },
                {
                    $id: Now.ID['api-param-promote'],
                    name: 'promote',
                    required: false,
                    exampleValue: 'false',
                    shortDescription: 'Set to true to attempt Vulnerability Response promotion straight after staging.',
                },
            ],
        },
        {
            $id: Now.ID['api-route-connector-health'],
            name: 'Connector health',
            path: '/health',
            method: 'GET',
            active: true,
            shortDescription: 'Reports stored connector health without generating outbound traffic.',
            authentication: true,
            authorization: true,
            produces: 'application/json',
            script: Now.include('../../rest/connector-health.js'),
        },
    ],
})

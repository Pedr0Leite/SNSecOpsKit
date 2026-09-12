import '@servicenow/sdk/global'
import { RestApi } from '@servicenow/sdk/core'

/**
 * Read-only API behind the analyst console.
 *
 * Deliberately a SEPARATE API from the ingestion one. Ingestion is machine-to-machine and requires
 * the application admin role; this is what a Tier 1 analyst's browser calls, and requiring admin
 * for it would mean handing every analyst write access to the connector configuration.
 *
 * Both routes are read-only and ACL-gated to the viewer role, and every underlying read uses
 * GlideRecordSecure - so the API can never widen what a user is allowed to see.
 */
export const consoleApi = RestApi({
    $id: Now.ID['api-secops-console'],
    name: 'SecOps Console',
    serviceId: 'secops_console',
    shortDescription: 'Read-only work queue and connector health for the SecOps analyst console.',
    active: true,
    produces: 'application/json',
    routes: [
        {
            $id: Now.ID['api-route-console-work'],
            name: 'Work queue',
            path: '/work',
            method: 'GET',
            active: true,
            authentication: true,
            authorization: true,
            produces: 'application/json',
            shortDescription: 'Security incidents, SIR tasks and vulnerability findings for the current user or team.',
            script: Now.include('../../rest/console-work.js'),
            parameters: [
                {
                    $id: Now.ID['api-param-console-scope'],
                    name: 'scope',
                    required: false,
                    exampleValue: 'me',
                    shortDescription: 'me | team | all. Defaults to me.',
                },
                {
                    $id: Now.ID['api-param-console-sources'],
                    name: 'sources',
                    required: false,
                    exampleValue: 'sir,findings',
                    shortDescription: 'Comma list of sources to include. Defaults to both.',
                },
                {
                    $id: Now.ID['api-param-console-severities'],
                    name: 'severities',
                    required: false,
                    exampleValue: 'critical,high',
                    shortDescription: 'Comma list of severities to include. Defaults to all.',
                },
                {
                    $id: Now.ID['api-param-console-q'],
                    name: 'q',
                    required: false,
                    exampleValue: 'ransomware',
                    shortDescription: 'Free-text search across number, title, assignee, group and CI.',
                },
                {
                    $id: Now.ID['api-param-console-limit'],
                    name: 'limit',
                    required: false,
                    exampleValue: '100',
                    shortDescription: 'Rows to return, 1-300. Defaults to 100.',
                },
            ],
        },
        {
            $id: Now.ID['api-route-console-overview'],
            name: 'Security overview',
            path: '/overview',
            method: 'GET',
            active: true,
            authentication: true,
            authorization: true,
            produces: 'application/json',
            shortDescription:
                'Organisation-wide posture and integration health. Counts only - no record content is returned.',
            script: Now.include('../../rest/console-overview.js'),
        },
        {
            $id: Now.ID['api-route-console-connectors'],
            name: 'Connector health',
            path: '/connectors',
            method: 'GET',
            active: true,
            authentication: true,
            authorization: true,
            produces: 'application/json',
            shortDescription: 'Stored connector health. Makes no outbound calls, so it is safe to poll.',
            script: Now.include('../../rest/console-connectors.js'),
        },
    ],
})

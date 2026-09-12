import '@servicenow/sdk/global'
import { SPWidget } from '@servicenow/sdk/core'
import { secopsAdminRole, secopsOperatorRole, secopsViewerRole } from '../security/roles.now'

/**
 * Connector console widget.
 *
 * Drop it on any Service Portal page to give managers and analysts connection status, an on-demand
 * reachability test and a redacted activity log - without granting them access to the
 * configuration tables themselves.
 */
export const secopsConsoleWidget = SPWidget({
    $id: Now.ID['widget-secops-console'],
    name: 'SecOps Connector Console',
    id: 'secops-connector-console',
    description:
        'Connection status, on-demand reachability testing and a redacted transaction log for the SecOps Universal Connector Framework.',
    category: 'custom',
    roles: [secopsViewerRole, secopsOperatorRole, secopsAdminRole],
    hasPreview: true,
    htmlTemplate: Now.include('../../widget/secops-console.html'),
    clientScript: Now.include('../../widget/secops-console.client.js'),
    serverScript: Now.include('../../widget/secops-console.server.js'),
    customCss: Now.include('../../widget/secops-console.scss'),
    optionSchema: [
        {
            name: 'log_limit',
            label: 'Activity rows',
            type: 'integer',
            section: 'Presentation',
            defaultValue: '25',
            hint: 'How many recent transactions to show (1-100).',
        },
    ],
})

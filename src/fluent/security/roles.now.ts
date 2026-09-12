import '@servicenow/sdk/global'
import { Role } from '@servicenow/sdk/core'

/** Read-only console access - security managers and anyone who just needs visibility. */
export const secopsViewerRole = Role({
    name: 'x_335329_secops.viewer',
    description: 'View SecOps Universal Connector configuration, connection health and transaction logs.',
})

/** Tier 1/2 analysts - can run connectors and test reachability, but cannot change configuration. */
export const secopsOperatorRole = Role({
    name: 'x_335329_secops.operator',
    description: 'Execute SecOps connector operations (enrich, detonate, contain) and test connectivity.',
    containsRoles: [secopsViewerRole],
})

/** Low-code administrators - full configuration of connectors, endpoints and mappings. */
export const secopsAdminRole = Role({
    name: 'x_335329_secops.admin',
    description: 'Full administration of the SecOps Universal Connector Framework.',
    containsRoles: [secopsOperatorRole],
})

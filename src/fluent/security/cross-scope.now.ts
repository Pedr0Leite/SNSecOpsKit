import '@servicenow/sdk/global'
import { CrossScopePrivilege } from '@servicenow/sdk/core'

/**
 * Cross-scope privileges.
 *
 * Two things to know before changing these:
 *
 * 1. A privilege is a ceiling request, not a grant. The TARGET table's own access settings win -
 *    if sn_si_incident disallows delete cross-scope (it does), no privilege here can enable it.
 *    That is why there are no delete privileges below.
 *
 * 2. Security Incident Response runs with Restricted Caller Access. Even with these records, an
 *    administrator may have to approve this application under
 *    System Applications > Application Restricted Caller Access. SecOpsTargetWriter degrades
 *    gracefully when that approval is missing rather than throwing.
 *
 * Vulnerability Response privileges are intentionally NOT declared here - see
 * docs/03-vulnerability-response.md. The sn_vul scope does not exist on instances without the VR
 * subscription, and ingestion stages into this application's own table instead.
 */

// --- Security Incident Response: read incidents to harvest indicators -------
export const siIncidentRead = CrossScopePrivilege({
    $id: Now.ID['xsp-sn-si-incident-read'],
    status: 'allowed',
    operation: 'read',
    targetName: 'sn_si_incident',
    targetScope: 'sn_si',
    targetType: 'sys_db_object',
})

// --- Threat Intelligence: observables, their types and enrichment results ---
export const tiObservableRead = CrossScopePrivilege({
    $id: Now.ID['xsp-sn-ti-observable-read'],
    status: 'allowed',
    operation: 'read',
    targetName: 'sn_ti_observable',
    targetScope: 'sn_ti',
    targetType: 'sys_db_object',
})

export const tiObservableCreate = CrossScopePrivilege({
    $id: Now.ID['xsp-sn-ti-observable-create'],
    status: 'allowed',
    operation: 'create',
    targetName: 'sn_ti_observable',
    targetScope: 'sn_ti',
    targetType: 'sys_db_object',
})

export const tiObservableWrite = CrossScopePrivilege({
    $id: Now.ID['xsp-sn-ti-observable-write'],
    status: 'allowed',
    operation: 'write',
    targetName: 'sn_ti_observable',
    targetScope: 'sn_ti',
    targetType: 'sys_db_object',
})

export const tiObservableTypeRead = CrossScopePrivilege({
    $id: Now.ID['xsp-sn-ti-observable-type-read'],
    status: 'allowed',
    operation: 'read',
    targetName: 'sn_ti_observable_type',
    targetScope: 'sn_ti',
    targetType: 'sys_db_object',
})

export const tiLookupResultRead = CrossScopePrivilege({
    $id: Now.ID['xsp-sn-ti-lookup-result-read'],
    status: 'allowed',
    operation: 'read',
    targetName: 'sn_ti_lookup_result',
    targetScope: 'sn_ti',
    targetType: 'sys_db_object',
})

export const tiLookupResultCreate = CrossScopePrivilege({
    $id: Now.ID['xsp-sn-ti-lookup-result-create'],
    status: 'allowed',
    operation: 'create',
    targetName: 'sn_ti_lookup_result',
    targetScope: 'sn_ti',
    targetType: 'sys_db_object',
})

export const tiLookupResultWrite = CrossScopePrivilege({
    $id: Now.ID['xsp-sn-ti-lookup-result-write'],
    status: 'allowed',
    operation: 'write',
    targetName: 'sn_ti_lookup_result',
    targetScope: 'sn_ti',
    targetType: 'sys_db_object',
})

// --- Threat Intelligence: attach observables to a security incident ---------
export const tiTaskObservableRead = CrossScopePrivilege({
    $id: Now.ID['xsp-sn-ti-m2m-task-observable-read'],
    status: 'allowed',
    operation: 'read',
    targetName: 'sn_ti_m2m_task_observable',
    targetScope: 'sn_ti',
    targetType: 'sys_db_object',
})

export const tiTaskObservableCreate = CrossScopePrivilege({
    $id: Now.ID['xsp-sn-ti-m2m-task-observable-create'],
    status: 'allowed',
    operation: 'create',
    targetName: 'sn_ti_m2m_task_observable',
    targetScope: 'sn_ti',
    targetType: 'sys_db_object',
})

// --- Security Incident Response: the analyst console's task queue -----------
export const siTaskRead = CrossScopePrivilege({
    $id: Now.ID['xsp-sn-si-task-read'],
    status: 'allowed',
    operation: 'read',
    targetName: 'sn_si_task',
    targetScope: 'sn_si',
    targetType: 'sys_db_object',
})

// --- Platform: group membership for the console's "my team" scope -----------
// GlideUser.getMyGroups() is not callable from a scoped application, so membership is read
// directly from sys_user_grmember.
export const groupMemberRead = CrossScopePrivilege({
    $id: Now.ID['xsp-global-grmember-read'],
    status: 'allowed',
    operation: 'read',
    targetName: 'sys_user_grmember',
    targetScope: 'global',
    targetType: 'sys_db_object',
})

export const userGroupRead = CrossScopePrivilege({
    $id: Now.ID['xsp-global-user-group-read'],
    status: 'allowed',
    operation: 'read',
    targetName: 'sys_user_group',
    targetScope: 'global',
    targetType: 'sys_db_object',
})

export const userRead = CrossScopePrivilege({
    $id: Now.ID['xsp-global-user-read'],
    status: 'allowed',
    operation: 'read',
    targetName: 'sys_user',
    targetScope: 'global',
    targetType: 'sys_db_object',
})

// --- Platform: CI matching for vulnerability telemetry ----------------------
export const cmdbCiRead = CrossScopePrivilege({
    $id: Now.ID['xsp-global-cmdb-ci-read'],
    status: 'allowed',
    operation: 'read',
    targetName: 'cmdb_ci',
    targetScope: 'global',
    targetType: 'sys_db_object',
})

// --- Platform script includes ----------------------------------------------
export const gsLogExecute = CrossScopePrivilege({
    $id: Now.ID['xsp-global-gslog-execute'],
    status: 'allowed',
    operation: 'execute',
    targetName: 'GSLog',
    targetScope: 'global',
    targetType: 'sys_script_include',
})

export const abstractAjaxExecute = CrossScopePrivilege({
    $id: Now.ID['xsp-global-abstract-ajax-execute'],
    status: 'allowed',
    operation: 'execute',
    targetName: 'AbstractAjaxProcessor',
    targetScope: 'global',
    targetType: 'sys_script_include',
})

// --- Security Incident Response: raise incidents for CVEs -------------------
/**
 * The CVE watch job creates Security Incidents. Read was already granted above for indicator
 * harvesting; this adds create. There is deliberately no update or delete privilege - the job
 * opens an incident and then leaves it alone, which is the analyst's record from that point on.
 */
export const siIncidentCreate = CrossScopePrivilege({
    $id: Now.ID["xsp-sn-si-incident-create"],
    status: "allowed",
    operation: "create",
    targetName: "sn_si_incident",
    targetScope: "sn_si",
    targetType: "sys_db_object",
})

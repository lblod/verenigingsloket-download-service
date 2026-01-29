import { sparqlEscapeString, sparqlEscapeDateTime, sparqlEscapeUri, uuid } from 'mu';
import { querySudo, updateSudo } from '@lblod/mu-auth-sudo';
import { ENABLE_REQUEST_REASON_CHECK, DATA_ACCESS_LOG_GRAPH } from '../env-config.js';
import PREFIX from '../queries/prefix.js';

export const EDITOR_ROLE = 'verenigingen-beheerder';
export const VIEWER_ROLE = 'verenigingen-lezer';

/**
 * Check if user has required role from mu-auth-allowed-groups header.
 * For sensitive data access, both editor and viewer roles are accepted.
 * @param {Request} req - Express request object
 * @returns {{ authorized: boolean, detail: string }}
 */
export function checkRole(req) {
  const groupsHeader = req.headers['mu-auth-allowed-groups'];

  if (!groupsHeader) {
    return {
      authorized: false,
      detail: 'Missing mu-auth-allowed-groups header',
    };
  }

  try {
    const groups = JSON.parse(groupsHeader);

    if (!Array.isArray(groups)) {
      return {
        authorized: false,
        detail: 'mu-auth-allowed-groups header is not an array',
      };
    }

    const hasEditorRole = groups.some((g) => g.name === EDITOR_ROLE);
    const hasViewerRole = groups.some((g) => g.name === VIEWER_ROLE);

    if (hasEditorRole) {
      return { authorized: true, detail: 'User has editor role' };
    }

    if (hasViewerRole) {
      return { authorized: true, detail: 'User has viewer role' };
    }

    return {
      authorized: false,
      detail: `Missing required role: ${EDITOR_ROLE} or ${VIEWER_ROLE}`,
    };
  } catch (error) {
    return {
      authorized: false,
      detail: `Failed to parse mu-auth-allowed-groups header: ${error.message}`,
    };
  }
}

/**
 * Build SPARQL query to validate ReasonCode by UUID.
 */
function getRequestReasonQuery(reasonUuid) {
  return `
    ${PREFIX}
    SELECT ?reason WHERE {
      ?reason a ext:ReasonCode ;
        mu:uuid ${sparqlEscapeString(reasonUuid)} .
    }
  `;
}

/**
 * Validate X-Request-Reason header.
 * @param {Request} req - Express request object
 * @returns {Promise<{ valid: boolean, reasonUuid: string|null, reasonUri: string|null, detail: string }>}
 */
export async function validateRequestReason(req) {
  if (!ENABLE_REQUEST_REASON_CHECK) {
    return {
      valid: true,
      reasonUuid: null,
      reasonUri: null,
      detail: 'Request reason check disabled',
    };
  }

  const requestReason = req.header('X-Request-Reason');

  if (!requestReason) {
    return {
      valid: false,
      reasonUuid: null,
      reasonUri: null,
      detail: 'Missing required header: X-Request-Reason',
    };
  }

  try {
    const result = await querySudo(getRequestReasonQuery(requestReason));
    const reasonUri = result?.results?.bindings?.[0]?.reason?.value;

    if (!reasonUri) {
      return {
        valid: false,
        reasonUuid: requestReason,
        reasonUri: null,
        detail: 'Invalid X-Request-Reason value',
      };
    }

    return {
      valid: true,
      reasonUuid: requestReason,
      reasonUri,
      detail: 'Request reason validated',
    };
  } catch (error) {
    return {
      valid: false,
      reasonUuid: requestReason,
      reasonUri: null,
      detail: `Failed to validate request reason: ${error.message}`,
    };
  }
}

/**
 * Build SPARQL INSERT query for data access log.
 */
function buildLogDataAccessQuery({
  logUuid,
  resourceUri,
  reasonUri,
  person,
  adminUnit,
  success,
  error,
  timestamp,
}) {
  const logUri = `http://data.lblod.info/id/data-access-logs/${logUuid}`;

  const triples = [
    `a ext:SensitiveInformationRead`,
    `mu:uuid ${sparqlEscapeString(logUuid)}`,
    `ext:date ${sparqlEscapeDateTime(timestamp)}`,
    `ext:success ${success}`,
  ];

  if (resourceUri) {
    triples.push(`ext:resource ${sparqlEscapeUri(resourceUri)}`);
  }
  if (reasonUri) {
    triples.push(`ext:reason ${sparqlEscapeUri(reasonUri)}`);
  }
  if (person) {
    triples.push(`ext:person ${sparqlEscapeUri(person)}`);
  }
  if (adminUnit) {
    triples.push(`ext:adminUnit ${sparqlEscapeUri(adminUnit)}`);
  }
  if (error) {
    triples.push(`ext:errorMessage ${sparqlEscapeString(error)}`);
  }

  return `
    ${PREFIX}
    INSERT DATA {
      GRAPH ${sparqlEscapeUri(DATA_ACCESS_LOG_GRAPH)} {
        ${sparqlEscapeUri(logUri)} ${triples.join(' ;\n          ')} .
      }
    }
  `;
}

/**
 * Log data access attempt to triplestore.
 * @param {Object} params - Log parameters
 * @param {string} params.resourceUri - URI of accessed resource (job URI)
 * @param {string} params.reasonUri - URI of the ReasonCode
 * @param {string} params.person - URI of the person making the request
 * @param {string} params.adminUnit - URI of the admin unit
 * @param {boolean} params.success - Whether the request was successful
 * @param {string} params.error - Error message if failed
 */
export async function logDataAccess({
  resourceUri,
  reasonUri,
  person,
  adminUnit,
  success,
  error,
}) {
  try {
    const logUuid = uuid();
    const timestamp = new Date();

    const queryString = buildLogDataAccessQuery({
      logUuid,
      resourceUri,
      reasonUri,
      person,
      adminUnit,
      success,
      error,
      timestamp,
    });

    await updateSudo(queryString);
    console.log(`Data access logged: ${logUuid}, success: ${success}`);
  } catch (err) {
    console.error('Failed to log data access:', err.message);
  }
}

import { sparqlEscapeString, sparqlEscapeDateTime, sparqlEscapeUri, uuid } from 'mu'
import { SERVICE_NAME, FILES_GRAPH, SHARE_FOLDER, SESSION_GRAPH, ORGANISATION_GRAPH, ASSOCIATIONS_GRAPH, USE_API_FOR_REPRESENTATIVES, CLIENT_ID, CLEANUP_MAX_AGE_DAYS } from './env-config.js';
import { PREFIX, associations, locations, representatives } from './queries/index.js'
import { querySudo, updateSudo } from '@lblod/mu-auth-sudo';
import { fetchAssociationsFromAPI } from './lib/api-client.js';
import { mapApiResponseToRepresentatives } from './lib/response-mapper.js';

/**
 * convert results of select query to an array of objects.
 * courtesy: Niels Vandekeybus & Felix
 * @method parseResult
 * @return {Array}
 */
export function parseResult(result) {
  if (!(result.results && result.results.bindings.length)) return []

  const bindingKeys = result.head.vars
  return result.results.bindings.map(row => {
    const obj = {}
    bindingKeys.forEach(key => {
      if (
        row[key] &&
        row[key].datatype == 'http://www.w3.org/2001/XMLSchema#integer' &&
        row[key].value
      ) {
        obj[key] = parseInt(row[key].value)
      } else if (
        row[key] &&
        row[key].datatype == 'http://www.w3.org/2001/XMLSchema#dateTime' &&
        row[key].value
      ) {
        obj[key] = new Date(row[key].value)
      } else obj[key] = row[key] ? row[key].value : undefined
    })
    return obj
  })
}

export async function getAccountIdAndGroup(sessionId) {
  const queryStr = `
    ${PREFIX}
    SELECT ?accountUuid ?adminUnit ?person WHERE {
      GRAPH ${sparqlEscapeUri(SESSION_GRAPH)} {
        ${sparqlEscapeUri(sessionId)}
          session:account ?account ;
          ext:sessionGroup ?adminUnit .
      }
      ?account mu:uuid ?accountUuid .
      OPTIONAL { ?person foaf:account ?account . }
    }
  `;
  const res = await querySudo(queryStr);
  const binding = res?.results?.bindings?.[0];
  return {
    accountUuid: binding?.accountUuid?.value || null,
    adminUnit: binding?.adminUnit?.value || null,
    person: binding?.person?.value || null,
  };
}

export async function getAllAllowedAssociationSensitiveDataIds(adminUnit) {
  const queryStr = `
    ${PREFIX}
    SELECT DISTINCT ?association ?uuid WHERE {
      GRAPH ${sparqlEscapeUri(ASSOCIATIONS_GRAPH)} {
        ?association a <https://data.vlaanderen.be/ns/FeitelijkeVerenigingen#Vereniging> ;
          mu:uuid ?uuid ;
          org:hasPrimarySite/organisatie:bestaatUit ?address .
        ?address locn:postCode ?postalCode .
      }
      GRAPH ${sparqlEscapeUri(ORGANISATION_GRAPH)} {
        ?postInfo a adres:Postinfo ;
          geo:sfWithin ?werkingsgebied ;
          adres:postcode ?postalCode .
        ${sparqlEscapeUri(adminUnit)} besluit:werkingsgebied ?werkingsgebied .
      }
    }
  `;
  const res = await querySudo(queryStr);
  return parseResult(res);
}

export async function getAllAssociations(graph) {
  const queryStr = `
    ${PREFIX}

    SELECT DISTINCT ?association ?uuid
      WHERE {
        GRAPH <${graph}> {
          ?association a <https://data.vlaanderen.be/ns/FeitelijkeVerenigingen#Vereniging> ;
             mu:uuid ?uuid .
        }
    }
  `;

  const res = await querySudo(queryStr);
  return parseResult(res);
}

export const queryAssociations = async (associationIds, graph) => {
  if (!associationIds) return null
  const escapedIds = associationIds.map(id => sparqlEscapeString(id)).join(' ')
  const res = await querySudo(`${PREFIX} ${associations(escapedIds, graph)}`)
  return parseResult(res)
}

export const queryLocations = async (associationIds, graph) => {
  if (!associationIds) return null
  const escapedIds = associationIds.map(id => sparqlEscapeString(id)).join(' ')
  const res = await querySudo(`${PREFIX} ${locations(escapedIds, graph)}`)
  return parseResult(res)
}

// SPARQL-based representatives query (fallback)
export const queryRepresentativesSPARQL = async (associationIds, graph) => {
  if (!associationIds) return null
  const escapedIds = associationIds.map(id => sparqlEscapeString(id)).join(' ')
  const res = await querySudo(`${PREFIX} ${representatives(escapedIds, graph)}`)
  return parseResult(res)
}

// Get vCodes for given association UUIDs
export async function getVCodesForAssociations(associationIds, graph) {
  if (!associationIds || associationIds.length === 0) return [];

  const escapedIds = associationIds.map(id => sparqlEscapeString(id)).join(' ');

  const queryStr = `
    ${PREFIX}
    SELECT DISTINCT ?uuid ?vCode WHERE {
      GRAPH <${graph}> {
        VALUES ?uuid { ${escapedIds} }
        ?vereniging a <https://data.vlaanderen.be/ns/FeitelijkeVerenigingen#Vereniging> ;
          mu:uuid ?uuid .
        OPTIONAL {
          ?vereniging adms:identifier ?Videntifier .
          ?Videntifier skos:notation "vCode" ;
            generiek:gestructureerdeIdentificator ?VstructuredID .
          ?VstructuredID generiek:lokaleIdentificator ?vCode .
        }
      }
    }
  `;

  const res = await querySudo(queryStr);
  return parseResult(res);
}

// API-based representatives query
export const queryRepresentativesAPI = async (associationIds, graph) => {
  if (!associationIds || associationIds.length === 0) return [];

  // Step 1: Get vCodes for the association UUIDs
  const vCodeMappings = await getVCodesForAssociations(associationIds, graph);
  const vCodes = vCodeMappings
    .filter(m => m.vCode) // Filter out associations without vCode
    .map(m => m.vCode);

  if (vCodes.length === 0) {
    console.warn('No vCodes found for the given associations');
    return [];
  }

  console.log(`Found ${vCodes.length} vCodes for ${associationIds.length} associations`);

  // Step 2: Fetch from API
  const apiResponses = await fetchAssociationsFromAPI(vCodes, CLIENT_ID);

  // Step 3: Map to expected format
  return mapApiResponseToRepresentatives(apiResponses);
}

// Main function with feature flag
export const queryRepresentatives = async (associationIds, graph) => {
  if (USE_API_FOR_REPRESENTATIVES) {
    return queryRepresentativesAPI(associationIds, graph);
  }
  return queryRepresentativesSPARQL(associationIds, graph);
}

export async function writeFileToStore(filename, filepath) {
  const virtualFileUuid = uuid();
  const virtualFileUri = `http://data.lblod.info/files/${virtualFileUuid}`;
  const nowLiteral = sparqlEscapeDateTime(new Date());
  const physicalFileUuid = uuid();
  const physicalFileUri = filepath.replace(SHARE_FOLDER, 'share://');

  await updateSudo(`
    ${PREFIX}

    INSERT DATA {
      GRAPH <${FILES_GRAPH}> {
        <${virtualFileUri}> a nfo:FileDataObject ;
          mu:uuid "${virtualFileUuid}" ;
          nfo:fileName "${filename}" ;
          dcterms:format "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ;
          dcterms:subject <http://data.lblod.info/datasets/verenigingen-loket-organisations-dump>;
          dbpedia:fileExtension "xlsx" ;
          dcterms:created ${nowLiteral} ;
          dcterms:modified ${nowLiteral} ;
          dcterms:publisher <${SERVICE_NAME}> .
        <${physicalFileUri}> a nfo:FileDataObject ;
          mu:uuid "${physicalFileUuid}" ;
          nie:dataSource <${virtualFileUri}> ;
          nfo:fileName "${filename}" ;
          dcterms:format "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ;
          dbpedia:fileExtension "xlsx" ;
          dcterms:created ${nowLiteral} ;
          dcterms:modified ${nowLiteral} .
      }
    }
  `);

  return virtualFileUri;
}

export async function writeFileToAccountStore(filename, filepath, accountUuid) {
  const accountGraph = `http://mu.semte.ch/graphs/accounts/${accountUuid}`;
  const virtualFileUuid = uuid();
  const virtualFileUri = `http://data.lblod.info/files/${virtualFileUuid}`;
  const nowLiteral = sparqlEscapeDateTime(new Date());
  const physicalFileUuid = uuid();
  const physicalFileUri = filepath.replace(SHARE_FOLDER, 'share://');

  await updateSudo(`
    ${PREFIX}

    INSERT DATA {
      GRAPH <${accountGraph}> {
        <${virtualFileUri}> a nfo:FileDataObject ;
          mu:uuid "${virtualFileUuid}" ;
          nfo:fileName "${filename}" ;
          dcterms:format "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ;
          dcterms:subject <http://data.lblod.info/datasets/verenigingen-loket-sensitive-data-dump>;
          dbpedia:fileExtension "xlsx" ;
          dcterms:created ${nowLiteral} ;
          dcterms:modified ${nowLiteral} ;
          dcterms:publisher <${SERVICE_NAME}> .
        <${physicalFileUri}> a nfo:FileDataObject ;
          mu:uuid "${physicalFileUuid}" ;
          nie:dataSource <${virtualFileUri}> ;
          nfo:fileName "${filename}" ;
          dcterms:format "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ;
          dbpedia:fileExtension "xlsx" ;
          dcterms:created ${nowLiteral} ;
          dcterms:modified ${nowLiteral} .
      }
    }
  `);

  return virtualFileUri;
}

const JOB_STATUS_BUSY = 'http://redpencil.data.gift/id/concept/JobStatus/busy';
const JOB_STATUS_SUCCESS = 'http://redpencil.data.gift/id/concept/JobStatus/success';
const JOB_STATUS_FAILED = 'http://redpencil.data.gift/id/concept/JobStatus/failed';
const JOB_OPERATION = 'http://data.lblod.info/operations/sensitive-data-export';

export async function createJob(accountUuid) {
  const accountGraph = `http://mu.semte.ch/graphs/accounts/${accountUuid}`;
  const jobUuid = uuid();
  const jobUri = `http://data.lblod.info/jobs/${jobUuid}`;
  const nowLiteral = sparqlEscapeDateTime(new Date());

  await updateSudo(`
    ${PREFIX}

    INSERT DATA {
      GRAPH <${accountGraph}> {
        <${jobUri}> a cogs:Job ;
          mu:uuid "${jobUuid}" ;
          adms:status <${JOB_STATUS_BUSY}> ;
          task:operation <${JOB_OPERATION}> ;
          dcterms:created ${nowLiteral} ;
          dcterms:modified ${nowLiteral} ;
          dcterms:creator <${SERVICE_NAME}> .
      }
    }
  `);

  return { jobUri, jobUuid };
}

export async function updateJobStatus(jobUri, accountUuid, status, resultFileUri = null, errorMessage = null) {
  const accountGraph = `http://mu.semte.ch/graphs/accounts/${accountUuid}`;
  const nowLiteral = sparqlEscapeDateTime(new Date());

  let statusUri;
  switch (status) {
    case 'success':
      statusUri = JOB_STATUS_SUCCESS;
      break;
    case 'failed':
      statusUri = JOB_STATUS_FAILED;
      break;
    default:
      statusUri = JOB_STATUS_BUSY;
  }

  // Build optional triples
  let optionalTriples = '';
  if (resultFileUri) {
    optionalTriples += `\n        <${jobUri}> task:resultsContainer <${resultFileUri}> .`;
  }
  if (errorMessage) {
    optionalTriples += `\n        <${jobUri}> task:error ${sparqlEscapeString(errorMessage)} .`;
  }

  await updateSudo(`
    ${PREFIX}

    DELETE {
      GRAPH <${accountGraph}> {
        <${jobUri}> adms:status ?oldStatus ;
          dcterms:modified ?oldModified .
      }
    }
    INSERT {
      GRAPH <${accountGraph}> {
        <${jobUri}> adms:status <${statusUri}> ;
          dcterms:modified ${nowLiteral} .${optionalTriples}
      }
    }
    WHERE {
      GRAPH <${accountGraph}> {
        <${jobUri}> adms:status ?oldStatus ;
          dcterms:modified ?oldModified .
      }
    }
  `);
}

/**
 * Get old files (older than maxAgeDays) for cleanup.
 * Returns files from both the general FILES_GRAPH and account-specific graphs.
 */
export async function getOldFiles(maxAgeDays = CLEANUP_MAX_AGE_DAYS) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - maxAgeDays);
  const cutoffLiteral = sparqlEscapeDateTime(cutoffDate);

  const queryStr = `
    ${PREFIX}
    SELECT DISTINCT ?file ?physicalFile ?physicalUri ?graph WHERE {
      GRAPH ?graph {
        ?file a nfo:FileDataObject ;
          dcterms:created ?created .
        FILTER(?created < ${cutoffLiteral})
        FILTER(STRSTARTS(STR(?file), "http://data.lblod.info/files/"))
      }
      OPTIONAL {
        GRAPH ?graph {
          ?physicalFile nie:dataSource ?file ;
            a nfo:FileDataObject .
        }
      }
      BIND(REPLACE(STR(?physicalFile), "^share://", "${SHARE_FOLDER}/") AS ?physicalUri)
    }
  `;

  const res = await querySudo(queryStr);
  return parseResult(res);
}

/**
 * Delete a file and its physical counterpart from the triplestore.
 */
export async function deleteFileFromStore(fileUri, physicalFileUri, graph) {
  await updateSudo(`
    ${PREFIX}
    DELETE {
      GRAPH <${graph}> {
        <${fileUri}> ?p ?o .
      }
    }
    WHERE {
      GRAPH <${graph}> {
        <${fileUri}> ?p ?o .
      }
    }
  `);

  if (physicalFileUri) {
    await updateSudo(`
      ${PREFIX}
      DELETE {
        GRAPH <${graph}> {
          <${physicalFileUri}> ?p ?o .
        }
      }
      WHERE {
        GRAPH <${graph}> {
          <${physicalFileUri}> ?p ?o .
        }
      }
    `);
  }
}

/**
 * Get old jobs (older than maxAgeDays) for cleanup.
 * Only returns completed jobs (success or failed), not busy ones.
 */
export async function getOldJobs(maxAgeDays = CLEANUP_MAX_AGE_DAYS) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - maxAgeDays);
  const cutoffLiteral = sparqlEscapeDateTime(cutoffDate);

  const queryStr = `
    ${PREFIX}
    SELECT DISTINCT ?job ?graph ?resultFile WHERE {
      GRAPH ?graph {
        ?job a cogs:Job ;
          task:operation <${JOB_OPERATION}> ;
          dcterms:created ?created ;
          adms:status ?status .
        FILTER(?created < ${cutoffLiteral})
        FILTER(?status IN (<${JOB_STATUS_SUCCESS}>, <${JOB_STATUS_FAILED}>))
        OPTIONAL { ?job task:resultsContainer ?resultFile . }
      }
    }
  `;

  const res = await querySudo(queryStr);
  return parseResult(res);
}

/**
 * Delete a job from the triplestore.
 */
export async function deleteJobFromStore(jobUri, graph) {
  await updateSudo(`
    ${PREFIX}
    DELETE {
      GRAPH <${graph}> {
        <${jobUri}> ?p ?o .
      }
    }
    WHERE {
      GRAPH <${graph}> {
        <${jobUri}> ?p ?o .
      }
    }
  `);
}

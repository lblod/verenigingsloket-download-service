import { sparqlEscapeString, sparqlEscapeDateTime, uuid } from 'mu'
import { SERVICE_NAME, FILES_GRAPH, SHARE_FOLDER} from './env-config';
import { PREFIX, associations, locations, representatives } from './queries'
import { querySudo, updateSudo } from '@lblod/mu-auth-sudo';

/**
 * convert results of select query to an array of objects.
 * courtesy: Niels Vandekeybus & Felix
 * @method parseResult
 * @return {Array}
 */
export function parseResult (result) {
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

export async function getAllAssociations(graph) {
  const queryStr = `
    ${PREFIX}

    SELECT DISTINCT ?association ?uuid
      WHERE {
        GRAPH <${graph}> {
          ?association a <https://data.vlaanderen.be/ns/FeitelijkeVerenigingen#FeitelijkeVereniging> ;
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

export const queryRepresentatives = async (associationIds, graph) => {
  if (!associationIds) return null
  const escapedIds = associationIds.map(id => sparqlEscapeString(id)).join(' ')
  const res = await querySudo(`${PREFIX} ${representatives(escapedIds, graph)}`)
  return parseResult(res)
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
          dct:format "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ;
          dct:subject <http://data.lblod.info/datasets/verenigingen-loket-organisations-dump>;
          dbpedia:fileExtension "xlsx" ;
          dct:created ${nowLiteral} ;
          dct:modified ${nowLiteral} ;
          dct:publisher <${SERVICE_NAME}> .
        <${physicalFileUri}> a nfo:FileDataObject ;
          mu:uuid "${physicalFileUuid}" ;
          nie:dataSource <${virtualFileUri}> ;
          nfo:fileName "${filename}" ;
          dct:format "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ;
          dbpedia:fileExtension "xlsx" ;
          dct:created ${nowLiteral} ;
          dct:modified ${nowLiteral} .
      }
    }
  `);

  return virtualFileUri;
}

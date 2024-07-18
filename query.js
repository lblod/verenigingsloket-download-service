import { query as muQuery, sparqlEscape } from 'mu'
import { PREFIX, associations, locations, representatives } from './queries'

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

export const queryAssociations = async (associationIds, graph) => {
  if (!associationIds) return null
  const escapedIds = associationIds.map(id => sparqlEscape(id)).join(' ')
  const res = await muQuery(`${PREFIX} ${associations(escapedIds, graph)}`)
  return parseResult(res)
}

export const queryLocations = async (associationIds, graph) => {
  if (!associationIds) return null
  const escapedIds = associationIds.map(id => sparqlEscape(id)).join(' ')
  const res = await muQuery(`${PREFIX} ${locations(escapedIds, graph)}`)
  return parseResult(res)
}

export const queryRepresentatives = async (associationIds, graph) => {
  if (!associationIds) return null
  const escapedIds = associationIds.map(id => sparqlEscape(id)).join(' ')
  const res = await muQuery(`${PREFIX} ${representatives(escapedIds, graph)}`)
  return parseResult(res)
}

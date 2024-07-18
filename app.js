import { app } from 'mu'
import {
  queryAssociations,
  queryLocations,
  queryRepresentatives
} from './query'
import createSheet from './sheet'
import bodyParser from 'body-parser'

app.use(bodyParser.json())

let tempStorage = {}

function splitArrayIntoChunks (array, chunkSize) {
  const chunks = []
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize))
  }
  return chunks
}

app.post('/storeData', (req, res) => {
  const { associationIds, adminUnitId } = req.body
  if (!associationIds) {
    return res.status(400).send('Missing association ids in request body')
  }
  if (!adminUnitId) {
    return res
      .status(400)
      .send('Missing administrative unit id in request body')
  }

  const referenceId = new Date().getTime().toString()
  tempStorage[referenceId] = { adminUnitId, associationIds }

  setTimeout(() => delete tempStorage[referenceId], 10 * 60 * 1000)

  res.json({ referenceId })
})

app.get('/download', async function (req, res) {
  const { ref } = req.query
  if (!ref || !tempStorage[ref]) {
    return res.status(400).send('Invalid or missing reference ID')
  }

  const { adminUnitId, associationIds } = tempStorage[ref]
  const graph = `https://mu.semte.ch/graphs/organizations/${adminUnitId}`
  delete tempStorage[ref]

  const associationIdChunks = splitArrayIntoChunks(associationIds, 300)

  let allAssociations = []
  let allLocations = []
  let allRepresentatives = []

  for (const chunk of associationIdChunks) {
    const associations = await queryAssociations(chunk, graph)
    const locations = await queryLocations(chunk, graph)
    const representatives = await queryRepresentatives(chunk, graph)

    if (associations && associations.length > 0) {
      allAssociations = allAssociations.concat(associations)
      allLocations = allLocations.concat(locations)
      allRepresentatives = allRepresentatives.concat(representatives)
    }
  }

  if (allAssociations.length === 0) {
    return res.status(400).send('Associations not found or empty.')
  }

  const file = await createSheet(
    allAssociations,
    allLocations,
    allRepresentatives
  )
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  )
  res.download(file)
})

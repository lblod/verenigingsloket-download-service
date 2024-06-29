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
  const { associationIds } = req.body
  if (!associationIds) {
    return res.status(400).send('Missing associationIds in request body')
  }

  const referenceId = new Date().getTime().toString()
  tempStorage[referenceId] = associationIds

  setTimeout(() => delete tempStorage[referenceId], 10 * 60 * 1000)

  res.json({ referenceId })
})

app.get('/download', async function (req, res) {
  const { ref } = req.query
  if (!ref || !tempStorage[ref]) {
    return res.status(400).send('Invalid or missing reference ID')
  }

  const associationIds = tempStorage[ref]
  delete tempStorage[ref]

  const associationIdChunks = splitArrayIntoChunks(associationIds, 200)

  let allAssociations = []
  let allLocations = []
  let allRepresentatives = []

  for (const chunk of associationIdChunks) {
    const associations = await queryAssociations(chunk)
    const locations = await queryLocations(chunk)
    const representatives = await queryRepresentatives(chunk)

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

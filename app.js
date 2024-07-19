import { app } from 'mu'
import {
  queryAssociations,
  queryLocations,
  queryRepresentatives
} from './query'
import createSheet from './sheet'
import bodyParser from 'body-parser'
import fs from 'fs'
import path from 'path'
import schedule from 'node-schedule'

app.use(bodyParser.json())
const tempStorage = {}

function splitArrayIntoChunks (array, chunkSize) {
  const chunks = []
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize))
  }
  return chunks
}

async function processJob (referenceId) {
  if (!tempStorage[referenceId]) {
    throw new Error('Invalid reference ID')
  }
  console.log('Job is in proress')
  const { adminUnitId, associationIds } = tempStorage[referenceId]
  const graph = `http://mu.semte.ch/graphs/organizations/${adminUnitId}`
  const associationIdChunks = splitArrayIntoChunks(associationIds, 300)
  let allAssociations = []
  let allLocations = []
  let allRepresentatives = []

  try {
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
      throw new Error('Associations not found or empty.')
    }

    const filePath = path.join('/tmp', `${referenceId}.xlsx`)
    const fileData = await createSheet(
      allAssociations,
      allLocations,
      allRepresentatives
    )
    console.log(`File data length: ${fileData.length}`)
    fs.writeFileSync(filePath, fileData)
    console.log(`File written to: ${filePath}`)
    console.log(`Job with ID ${referenceId} completed successfully`)
    return (tempStorage[referenceId].filePath = filePath)
  } catch (error) {
    console.error(
      `Error processing job with ID ${referenceId}: ${error.message}`
    )
    delete tempStorage[referenceId]
  }
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
  const date = new Date(Date.now() + 1000)
  schedule.scheduleJob(date, async () => {
    try {
      console.log('start process job')
      await processJob(referenceId)
    } catch (error) {
      console.error(
        `Error processing job with ID ${referenceId}: ${error.message}`
      )
    }
  })

  setTimeout(() => {
    if (tempStorage[referenceId] && !tempStorage[referenceId].filePath) {
      delete tempStorage[referenceId]
      console.log(
        `Job with ID ${referenceId} has been cleaned up after timeout`
      )
    }
  }, 10 * 60 * 1000)

  res.json({ referenceId })
})

app.get('/status', (req, res) => {
  const { jobId } = req.query

  if (!tempStorage[jobId]) {
    return res.status(404).send('Job not found')
  }

  if (tempStorage[jobId].filePath) {
    console.log(`Job with ID ${jobId} is completed`)
    return res.json({ complete: true, referenceId: jobId })
  }

  console.log(`Job with ID ${jobId} is still in progress`)
  return res.json({ complete: false })
})

app.get('/download', (req, res) => {
  const { ref } = req.query
  if (!ref || !tempStorage[ref] || !tempStorage[ref].filePath) {
    return res.status(400).send('Invalid or missing reference ID')
  }

  const filePath = tempStorage[ref].filePath
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  )
  return res.download(filePath, err => {
    if (err) {
      console.error(err)
    } else {
      fs.unlinkSync(filePath)
      delete tempStorage[ref]
      console.log(`File ${filePath} has been cleaned up`)
    }
  })
})

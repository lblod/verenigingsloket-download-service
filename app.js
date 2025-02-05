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
  const job = tempStorage[referenceId]

  if (!job) {
    throw new Error('Invalid reference ID')
  }

  console.log('Job is in progress')

  const { associationIds } = job
  const graph = `http://mu.semte.ch/graphs/organizations`
  const chunkSize = parseInt(process.env.CHUNK_SIZE, 100) || 100
  const associationIdChunks = splitArrayIntoChunks(associationIds, chunkSize)

  let allAssociations = []
  let allLocations = []
  let allRepresentatives = []

  try {
    for (const chunk of associationIdChunks) {
      const [associations, locations, representatives] = await Promise.all([
        queryAssociations(chunk, graph),
        queryLocations(chunk, graph),
        queryRepresentatives(chunk, graph)
      ])

      if (associations) allAssociations.push(...associations)
      if (locations) allLocations.push(...locations)
      if (representatives) allRepresentatives.push(...representatives)
    }

    if (allAssociations.length === 0) {
      throw new Error('No associations found.')
    }

    const filePath = path.join('/tmp', `${referenceId}.xlsx`)

    // Measure time taken by createSheet
    const startTime = performance.now()
    const fileData = await createSheet(
      allAssociations,
      allLocations,
      allRepresentatives
    )
    const endTime = performance.now()

    const duration = endTime - startTime
    console.log(
      `Time taken to create sheet: ${duration.toFixed(2)} milliseconds`
    )

    console.log(`File data length: ${fileData.length}`)
    await fs.promises.writeFile(filePath, fileData)

    console.log(`File written to: ${filePath}`)
    console.log(`Job with ID ${referenceId} completed successfully`)

    job.filePath = filePath
    return filePath
  } catch (error) {
    console.error(
      `Error processing job with ID ${referenceId}: ${error.message}`
    )
  }
}

app.post('/storeData', (req, res) => {
  const { associationIds } = req.body
  if (!associationIds) {
    return res.status(400).send('Missing association ids in request body')
  }

  const referenceId = new Date().getTime().toString()
  tempStorage[referenceId] = { associationIds }
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

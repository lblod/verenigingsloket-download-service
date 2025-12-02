import { app, uuid } from 'mu'
import { SHARE_FOLDER,
         SOURCE_GRAPH,
         CRON_PATTERN_SPREADSHEET_JOB,
         FEATURE_INCLUDE_REPRESENTATIVES
       } from './env-config';
import {
  getAllAssociations,
  queryAssociations,
  queryLocations,
  queryRepresentatives,
  writeFileToStore,
} from './query'

import createSheet from './sheet'
import bodyParser from 'body-parser'
import fs from 'fs'
import path from 'path'
import schedule from 'node-schedule'

app.use(bodyParser.json())

function splitArrayIntoChunks (array, chunkSize) {
  const chunks = []
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize))
  }
  return chunks
}

async function createSpreadSheet (associationIds) {
  const graph = `http://mu.semte.ch/graphs/organizations`
  const chunkSize = parseInt(process.env.CHUNK_SIZE, 100) || 100
  const associationIdChunks = splitArrayIntoChunks(associationIds, chunkSize)

  let allAssociations = []
  let allLocations = []
  let allRepresentatives = []

  for (const chunk of associationIdChunks) {
    const queries = [
      queryAssociations(chunk, graph),
      queryLocations(chunk, graph),
    ]
    if (FEATURE_INCLUDE_REPRESENTATIVES) {
      queries.push(queryRepresentatives(chunk, graph))
    }

    const [associations, locations, representatives] = await Promise.all(queries)

    if (associations) allAssociations.push(...associations)
    if (locations) allLocations.push(...locations)
    if (FEATURE_INCLUDE_REPRESENTATIVES && representatives) allRepresentatives.push(...representatives)
  }

  if (allAssociations.length === 0) {
    throw new Error('No associations found.');
  }

  const fileName = `verenigingen-export-${uuid()}.xlsx`;
  const filePath = path.join(SHARE_FOLDER, fileName);

  // Measure time taken by createSheet
  const startTime = performance.now()
  const fileData = await createSheet(
    allAssociations,
    allLocations,
    allRepresentatives
  );
  const endTime = performance.now();

  const duration = endTime - startTime
  console.log(
    `Time taken to create sheet: ${duration.toFixed(2)} milliseconds`
  );

  console.log(`File data length: ${fileData.length}`);
  await fs.promises.writeFile(filePath, fileData);

  console.log(`File written to: ${filePath}`);

  //TODO: cleanup/deprecate previous

  //store meta in DB
  const fileUri = await writeFileToStore('verenigingen-export.xlsx', filePath);
  console.log(`File stored in DB with URI: ${fileUri}`);
  
  return filePath
}

schedule.scheduleJob(CRON_PATTERN_SPREADSHEET_JOB, async function() {
  const timestamp = new Date().toISOString();
  console.log(`Create spreadsheet job at ${timestamp}`);
  const graph = SOURCE_GRAPH;
  try {
    const associations = await getAllAssociations(graph);
    const associationIds = associations.map(a => a.uuid);
    await createSpreadSheet(associationIds);
  }
  catch(error){
    console.error(`Error for job created at ${timestamp}`);
    console.error(`Error details: ${error.message}`);
    console.error(`Error details: ${error.stack}`);
  }
});

/*****
 * DEBUG ENDPOINTS.
 * Do NOT expose publicly
 * curl -X POST http://localhost/jobs?associationIds=123
 *****/
app.post('/jobs', async function (req, res) {
  const graph = SOURCE_GRAPH;
  try {
    let associationIds = req.query?.associationIds?.split(',') || [];
    if(associationIds.length <= 0 ) {
      const associations = await getAllAssociations(graph);
      associationIds = associations.map(a => a.uuid);
    }
    await createSpreadSheet(associationIds);
    res.status(201).end();
  }
  catch (error) {
    console.error('Error:', error);
    res.status(500).end();
  }
})

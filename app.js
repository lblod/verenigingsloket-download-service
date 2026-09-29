import { app, uuid } from 'mu'
import { SHARE_FOLDER,
         SOURCE_GRAPH,
         CRON_PATTERN_SPREADSHEET_JOB,
         CRON_PATTERN_CLEANUP_JOB,
         CLEANUP_MAX_AGE_DAYS,
         USE_API_FOR_REPRESENTATIVES,
       } from './env-config';
import {
  getAllAssociations,
  getAllAllowedAssociationSensitiveDataIds,
  getAccountIdAndGroup,
  queryAssociations,
  queryLocations,
  queryRepresentatives,
  writeFileToStore,
  writeFileToAccountStore,
  createJob,
  updateJobStatus,
  getOldFiles,
  getOldJobs,
  deleteFileFromStore,
  deleteJobFromStore,
} from './query'

import createSheet from './sheet'
import bodyParser from 'body-parser'
import fs from 'fs'
import path from 'path'
import schedule from 'node-schedule'
import {
  checkRole,
  validateRequestReason,
  logDataAccess,
} from './lib/authorization.js'
import { getClientIdFromSessionId } from './lib/authenticator.js'

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

  for (const chunk of associationIdChunks) {
    const [associations, locations] = await Promise.all([
      queryAssociations(chunk, graph),
      queryLocations(chunk, graph),
    ])

    if (associations) allAssociations.push(...associations)
    if (locations) allLocations.push(...locations)
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
    [] // No representatives in regular export
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

async function createSensitiveDataSpreadSheet (associationIds, accountUuid, clientId) {
  const graph = `http://mu.semte.ch/graphs/organizations`
  const chunkSize = parseInt(process.env.CHUNK_SIZE, 100) || 100
  const associationIdChunks = splitArrayIntoChunks(associationIds, chunkSize)

  let allAssociations = []
  let allLocations = []
  let allRepresentatives = []
  const failures = []

  for (const chunk of associationIdChunks) {
    const [associations, locations, representativesResult] = await Promise.all([
      queryAssociations(chunk, graph),
      queryLocations(chunk, graph),
      queryRepresentatives(chunk, graph, clientId),
    ])

    if (associations) allAssociations.push(...associations)
    if (locations) allLocations.push(...locations)
    if (representativesResult?.representatives) allRepresentatives.push(...representativesResult.representatives)
    if (representativesResult?.failures) failures.push(...representativesResult.failures)
  }

  if (allAssociations.length === 0) {
    throw new Error('No associations found.');
  }

  // Verenigingen whose representatives could not be fetched: listed on a warning sheet
  // in the file and in the job warning, so the export is never mistaken for complete.
  const nameByVCode = new Map(allAssociations.map(a => [a.vCode, a.naam]))
  const notFetched = failures.map(f => ({
    VCode: f.vCode,
    Naam: nameByVCode.get(f.vCode) || '',
    Reden: f.reason,
  }))

  const fileName = `verenigingen-sensitive-export-${uuid()}.xlsx`;
  const filePath = path.join(SHARE_FOLDER, fileName);

  // Measure time taken by createSheet
  const startTime = performance.now()
  const fileData = await createSheet(
    allAssociations,
    allLocations,
    allRepresentatives,
    { isSensitiveData: true, notFetched }
  );
  const endTime = performance.now();

  const duration = endTime - startTime
  console.log(
    `Time taken to create sensitive data sheet: ${duration.toFixed(2)} milliseconds`
  );

  console.log(`File data length: ${fileData.length}`);
  await fs.promises.writeFile(filePath, fileData);

  console.log(`Sensitive data file written to: ${filePath}`);

  //store meta in account-specific graph
  const fileUri = await writeFileToAccountStore('verenigingen-sensitive-export.xlsx', filePath, accountUuid);
  console.log(`Sensitive data file stored in DB with URI: ${fileUri}`);

  return { filePath, fileUri, notFetched }
}

// Warning stored on a successful job whose file misses the representatives of some verenigingen.
function incompleteExportWarning(notFetched, total) {
  const shown = notFetched.slice(0, 5).map(row => row.VCode)
  const rest = notFetched.length - shown.length
  const list = rest > 0 ? `${shown.join(', ')} en ${rest} andere` : shown.join(', ')
  return `Onvolledig: de vertegenwoordigers van ${notFetched.length} van de ${total} verenigingen konden niet opgehaald worden (${list}). `
    + 'Zie het tabblad "Niet opgehaald" in het bestand, of vraag een nieuwe export aan.'
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

/**
 * Cleanup job - deletes files and jobs older than CLEANUP_MAX_AGE_DAYS.
 * Runs daily at 1 AM by default.
 * Does NOT delete access logs (DATA_ACCESS_LOG_GRAPH).
 */
schedule.scheduleJob(CRON_PATTERN_CLEANUP_JOB, async function() {
  const timestamp = new Date().toISOString();
  console.log(`Cleanup job started at ${timestamp}`);

  try {
    // 1. Get and delete old files
    const oldFiles = await getOldFiles(CLEANUP_MAX_AGE_DAYS);
    console.log(`Found ${oldFiles.length} old files to clean up`);

    for (const file of oldFiles) {
      try {
        // Delete physical file from disk
        if (file.physicalUri) {
          const filePath = file.physicalUri;
          try {
            await fs.promises.unlink(filePath);
            console.log(`Deleted physical file: ${filePath}`);
          } catch (err) {
            if (err.code !== 'ENOENT') {
              console.error(`Failed to delete physical file ${filePath}:`, err.message);
            }
          }
        }

        // Delete file metadata from triplestore
        await deleteFileFromStore(file.file, file.physicalFile, file.graph);
        console.log(`Deleted file metadata: ${file.file}`);
      } catch (err) {
        console.error(`Failed to clean up file ${file.file}:`, err.message);
      }
    }

    // 2. Get and delete old jobs
    const oldJobs = await getOldJobs(CLEANUP_MAX_AGE_DAYS);
    console.log(`Found ${oldJobs.length} old jobs to clean up`);

    for (const job of oldJobs) {
      try {
        await deleteJobFromStore(job.job, job.graph);
        console.log(`Deleted job: ${job.job}`);
      } catch (err) {
        console.error(`Failed to clean up job ${job.job}:`, err.message);
      }
    }

    console.log(`Cleanup job completed at ${new Date().toISOString()}`);
  } catch (error) {
    console.error(`Cleanup job failed at ${timestamp}:`, error.message);
    console.error(`Error stack: ${error.stack}`);
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

/*****
 * SENSITIVE DATA ENDPOINT
 * Creates spreadsheet with representatives (sensitive data)
 * Requires authenticated session with mu-session-id header
 * Requires valid role (verenigingen-beheerder)
 * Requires X-Request-Reason header with valid ReasonCode UUID
 * Requires a MAGDA client linked to the administrative unit of the session
 * (only when USE_API_FOR_REPRESENTATIVES is enabled)
 *****/
app.post('/sensitive-data-jobs', async function (req, res) {
  let sessionData = { accountUuid: null, adminUnit: null, person: null };
  let reasonValidation = { valid: false, reasonUuid: null, reasonUri: null };
  let jobUri = null;

  try {
    // 1. Get session ID from headers
    const sessionId = req.headers['mu-session-id'];
    if (!sessionId) {
      await logDataAccess({
        resourceUri: null,
        reasonUri: null,
        person: null,
        adminUnit: null,
        success: false,
        error: 'Missing session ID',
      });
      return res.status(401).json({ error: 'Missing session ID' });
    }

    // 2. Get account ID, admin unit, and person from session
    sessionData = await getAccountIdAndGroup(sessionId);
    const { accountUuid, adminUnit, person } = sessionData;

    if (!accountUuid || !adminUnit) {
      await logDataAccess({
        resourceUri: null,
        reasonUri: null,
        person,
        adminUnit,
        success: false,
        error: 'Invalid session',
      });
      return res.status(401).json({ error: 'Invalid session' });
    }

    // 3. Check role authorization
    const roleCheck = checkRole(req);
    if (!roleCheck.authorized) {
      await logDataAccess({
        resourceUri: null,
        reasonUri: null,
        person,
        adminUnit,
        success: false,
        error: roleCheck.detail,
      });
      return res.status(403).json({ error: roleCheck.detail });
    }

    // 4. Validate request reason (if feature enabled)
    reasonValidation = await validateRequestReason(req);
    if (!reasonValidation.valid) {
      await logDataAccess({
        resourceUri: null,
        reasonUri: null,
        person,
        adminUnit,
        success: false,
        error: reasonValidation.detail,
      });
      return res.status(400).json({ error: reasonValidation.detail });
    }

    // 5. Resolve the MAGDA client of the administrative unit once, up front.
    // Only needed when representatives are fetched from the API. The job runs
    // asynchronously and must not depend on the session afterwards: a logout or
    // a new login on the same session would stop a running export.
    let clientId = null;
    if (USE_API_FOR_REPRESENTATIVES) {
      try {
        clientId = await getClientIdFromSessionId(sessionId);
      } catch (error) {
        await logDataAccess({
          resourceUri: null,
          reasonUri: reasonValidation.reasonUri,
          person,
          adminUnit,
          success: false,
          error: error.message,
        });
        return res.status(403).json({ error: error.message });
      }
    }

    // 6. Create job record (status: busy)
    const jobResult = await createJob(accountUuid);
    jobUri = jobResult.jobUri;
    const jobUuid = jobResult.jobUuid;

    // 7. Log successful authorization (job created)
    await logDataAccess({
      resourceUri: jobUri,
      reasonUri: reasonValidation.reasonUri,
      person,
      adminUnit,
      success: true,
      error: null,
    });

    // 8. Return job info immediately (async processing)
    res.status(202).json({
      jobId: jobUuid,
      status: 'busy',
      message: 'Sensitive data spreadsheet creation started',
    });

    // 9. Process asynchronously
    processSensitiveDataJob(jobUri, jobUuid, accountUuid, adminUnit, clientId);
  } catch (error) {
    console.error('Error creating sensitive data job:', error);

    // Log the error
    await logDataAccess({
      resourceUri: jobUri,
      reasonUri: reasonValidation.reasonUri,
      person: sessionData.person,
      adminUnit: sessionData.adminUnit,
      success: false,
      error: error.message,
    });

    // Only send error response if headers haven't been sent yet
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    }
  }
})

async function processSensitiveDataJob(jobUri, jobUuid, accountUuid, adminUnit, clientId) {
  const timestamp = new Date().toISOString();
  console.log(`Processing sensitive data job ${jobUuid} at ${timestamp}`);

  try {
    // 1. Get allowed association IDs based on werkingsgebied
    const associations = await getAllAllowedAssociationSensitiveDataIds(adminUnit);
    const associationIds = associations.map(a => a.uuid);

    if (associationIds.length === 0) {
      console.log(`No associations found for job ${jobUuid}`);
      await updateJobStatus(jobUri, accountUuid, 'failed', null, 'No associations found in werkingsgebied');
      return;
    }

    console.log(`Found ${associationIds.length} associations for job ${jobUuid}`);

    // 2. Create spreadsheet WITH representatives
    const { fileUri, notFetched } = await createSensitiveDataSpreadSheet(associationIds, accountUuid, clientId);

    // 3. Update job status to success with file reference; keep a warning when the file is incomplete
    if (notFetched.length > 0) {
      await updateJobStatus(jobUri, accountUuid, 'success', fileUri, incompleteExportWarning(notFetched, associationIds.length));
      console.warn(`Sensitive data job ${jobUuid} completed, but ${notFetched.length} of ${associationIds.length} associations could not be fetched`);
    } else {
      await updateJobStatus(jobUri, accountUuid, 'success', fileUri);
      console.log(`Sensitive data job ${jobUuid} completed successfully`);
    }
  } catch (error) {
    console.error(`Sensitive data job ${jobUuid} failed:`, error);
    await updateJobStatus(jobUri, accountUuid, 'failed', null, error.message);
  }
}

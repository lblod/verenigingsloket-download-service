import axios from 'axios';
import { uuid } from 'mu';
import Authenticator from './authenticator.js';
import { API_BASE, API_VERSION, API_CONCURRENT_REQUESTS, API_RETRY_ATTEMPTS, API_RETRY_DELAY_MS } from '../env-config.js';
import { withRetry, isTransientApiError } from './retry.js';

const authenticator = new Authenticator();

// Configure axios to accept 304 as valid status
axios.defaults.validateStatus = (status) => {
  return (status >= 200 && status < 300) || status === 304;
};

/**
 * Build headers for API requests
 */
async function buildHeaders(clientId) {
  const accessToken = await authenticator.getAccessToken(clientId);
  return {
    Authorization: `Bearer ${accessToken}`,
    'x-correlation-id': uuid(),
    ...(API_VERSION && { 'vr-api-version': API_VERSION }),
  };
}

/**
 * Fetch a single association by vCode
 * @param {string} vCode - The vCode identifier of the association
 * @param {string} clientId - OAuth2 client id of the administrative unit (resolved once at job creation)
 * @returns {Object} The API response
 * @throws an Error with `vCode` and `reason` when the association cannot be fetched after the configured retries
 */
export async function fetchAssociationByVCode(vCode, clientId) {
  const base = API_BASE.endsWith('/') ? API_BASE : `${API_BASE}/`;
  const url = `${base}verenigingen/${vCode}`;
  console.log(`Fetching association from URL: ${url}`);
  const headers = await buildHeaders(clientId);

  try {
    const response = await withRetry(
      () => axios({
        url,
        method: 'GET',
        headers,
        timeout: 30000, // 30 second timeout per attempt
      }),
      {
        attempts: API_RETRY_ATTEMPTS,
        delayMs: API_RETRY_DELAY_MS,
        shouldRetry: isTransientApiError,
        onRetry: (error, attempt, delay) =>
          console.warn(
            `Retrying association ${vCode} in ${delay} ms, attempt ${attempt} of ${API_RETRY_ATTEMPTS} failed: ${error.response?.status || error.message}`
          ),
      }
    );

    return response.data;
  } catch (error) {
    const reason = error.response?.status ? `HTTP ${error.response.status}` : error.message;
    console.error(`Failed to fetch association ${vCode}: ${reason}`);
    if (error.response?.data) {
      console.error('Error details:', error.response.data);
    }
    const failure = new Error(`Failed to fetch association ${vCode} from the API: ${reason}`);
    failure.vCode = vCode;
    failure.reason = reason;
    throw failure;
  }
}

/**
 * Split array into chunks
 */
function splitIntoChunks(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Fetch associations for multiple vCodes with rate limiting
 * @param {string[]} vCodes - Array of vCode identifiers
 * @param {string} clientId - OAuth2 client id of the administrative unit (resolved once at job creation)
 * @returns {{ associations: Object[], failures: { vCode: string, reason: string }[] }}
 *          the API responses that succeeded and the vCodes that could not be fetched
 * @throws when every request of a full batch fails, which means the API is unavailable
 */
export async function fetchAssociationsFromAPI(vCodes, clientId) {
  const failures = [];
  if (!vCodes || vCodes.length === 0) {
    return { associations: [], failures };
  }

  console.log(`Fetching ${vCodes.length} associations from API...`);
  const results = [];
  const chunks = splitIntoChunks(vCodes, API_CONCURRENT_REQUESTS);

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    console.log(`Processing chunk ${i + 1}/${chunks.length} (${chunk.length} associations)`);

    const settled = await Promise.allSettled(
      chunk.map(vCode => fetchAssociationByVCode(vCode, clientId))
    );
    const rejected = settled.filter(result => result.status === 'rejected');

    // Every request of a full batch failed: the API is unavailable. Stop here instead
    // of working through the remaining associations with retries for hours.
    if (rejected.length === chunk.length && chunk.length === API_CONCURRENT_REQUESTS) {
      const reason = rejected[0].reason?.reason || rejected[0].reason?.message;
      throw new Error(`The association API is unavailable: all ${chunk.length} requests of a batch failed (${reason})`);
    }

    settled.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        failures.push({
          vCode: chunk[index],
          reason: result.reason?.reason || result.reason?.message || String(result.reason),
        });
      }
    });

    console.log(`Chunk ${i + 1}: ${chunk.length - rejected.length}/${chunk.length} successful`);
  }

  console.log(`API fetch complete: ${results.length}/${vCodes.length} associations retrieved, ${failures.length} not fetched`);
  return { associations: results, failures };
}

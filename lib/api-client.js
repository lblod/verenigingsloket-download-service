import axios from 'axios';
import { uuid } from 'mu';
import Authenticator from './authenticator.js';
import { API_BASE, API_VERSION, API_CONCURRENT_REQUESTS } from '../env-config.js';

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
 * @param {string} clientId - The OAuth2 client ID
 * @returns {Object|null} The API response or null on error
 */
export async function fetchAssociationByVCode(vCode, clientId) {
  const base = API_BASE.endsWith('/') ? API_BASE : `${API_BASE}/`;
  const url = `${base}verenigingen/${vCode}`;
  console.log(`Fetching association from URL: ${url}`);
  const headers = await buildHeaders(clientId);

  try {
    const response = await axios({
      url,
      method: 'GET',
      headers,
      timeout: 30000, // 30 second timeout
    });

    return response.data;
  } catch (error) {
    console.error(`Failed to fetch association ${vCode}:`, error.response?.status || error.message);
    if (error.response?.data) {
      console.error('Error details:', error.response.data);
    }
    return null;
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
 * @param {string} clientId - The OAuth2 client ID
 * @returns {Object[]} Array of API responses (nulls filtered out)
 */
export async function fetchAssociationsFromAPI(vCodes, clientId) {
  if (!vCodes || vCodes.length === 0) {
    return [];
  }

  console.log(`Fetching ${vCodes.length} associations from API...`);
  const results = [];
  const chunks = splitIntoChunks(vCodes, API_CONCURRENT_REQUESTS);

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    console.log(`Processing chunk ${i + 1}/${chunks.length} (${chunk.length} associations)`);

    const chunkResults = await Promise.all(
      chunk.map(vCode => fetchAssociationByVCode(vCode, clientId))
    );

    // Filter out failed requests (null values)
    const successfulResults = chunkResults.filter(r => r !== null);
    results.push(...successfulResults);

    console.log(`Chunk ${i + 1}: ${successfulResults.length}/${chunk.length} successful`);
  }

  console.log(`API fetch complete: ${results.length}/${vCodes.length} associations retrieved`);
  return results;
}

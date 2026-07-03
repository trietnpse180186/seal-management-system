const BASE_URL = 'https://api-hackathon.lexatek.vn/api';

/**
 * Helper to get authorization headers.
 */
function getHeaders() {
  const serviceKey = process.env.SERVICE_API_KEY;
  if (!serviceKey) {
    console.warn('[MQTT SERVICE] Warning: SERVICE_API_KEY is not defined in environment variables.');
  }
  return {
    'Content-Type': 'application/json',
    'X-Service-Key': serviceKey || ''
  };
}

/**
 * Register a team on the external simulator API.
 * @param {string} code - Uppercase team code.
 * @param {string} name - Team name.
 * @param {string} environmentId - UUID of the environment.
 * @returns {Promise<object>} The API result containing credentials.
 */
async function createExternalTeam(code, name, environmentId) {
  const url = `${BASE_URL}/external/teams`;
  const response = await fetch(url, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ code, name, environmentId })
  });

  const data = await response.json();

  if (!response.ok) {
    const errorMsg = data.message || `HTTP error ${response.status}`;
    const err = new Error(errorMsg);
    err.code = data.code;
    err.status = response.status;
    throw err;
  }

  return data.result;
}

/**
 * Fetch credentials (keys) of an existing team from the external API.
 * @param {string} code - Team code.
 * @returns {Promise<object>} The API result containing keys and topics.
 */
async function fetchExternalKeys(code) {
  const url = `${BASE_URL}/external/teams/${encodeURIComponent(code)}/keys`;
  const response = await fetch(url, {
    method: 'GET',
    headers: getHeaders()
  });

  const data = await response.json();

  if (!response.ok) {
    const errorMsg = data.message || `HTTP error ${response.status}`;
    const err = new Error(errorMsg);
    err.code = data.code;
    err.status = response.status;
    throw err;
  }

  return data.result;
}

module.exports = {
  createExternalTeam,
  fetchExternalKeys
};

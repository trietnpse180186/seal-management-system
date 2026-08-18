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

let cachedToken = null;

/**
 * Log in to the simulator backend as admin to retrieve a JWT token.
 * Caches the token for subsequent requests.
 */
async function getAdminToken() {
  if (cachedToken) {
    return cachedToken;
  }

  const email = process.env.SIMULATOR_ADMIN_EMAIL || 'admin@hackathon.com';
  const password = process.env.SIMULATOR_ADMIN_PASSWORD || 'Admin@123456';

  const url = `${BASE_URL}/auth/login`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });

  const data = await response.json();
  if (!response.ok) {
    const errorMsg = data.message || `Failed to login to simulator: ${response.statusText}`;
    throw new Error(errorMsg);
  }

  cachedToken = data.result.accessToken;
  return cachedToken;
}

/**
 * Call the simulator admin REST API with bearer token authentication.
 * Automatically handles token expiry/refresh.
 */
async function callSimulatorAdmin(endpoint, method, body = null) {
  let token = await getAdminToken();
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  const options = {
    method,
    headers
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  let response = await fetch(`${BASE_URL}${endpoint}`, options);

  if (response.status === 401) {
    // Token might have expired, clear cache and retry once
    cachedToken = null;
    token = await getAdminToken();
    options.headers['Authorization'] = `Bearer ${token}`;
    response = await fetch(`${BASE_URL}${endpoint}`, options);
  }

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
 * Toggle the active status of the judge environment for a team on the simulator.
 */
async function toggleJudgeActive(externalTeamId, active) {
  return callSimulatorAdmin(`/team/${externalTeamId}/judge`, 'PATCH', { active });
}

/**
 * Update the judge scenario for a team on the simulator.
 */
async function updateJudgeScenario(externalTeamId, scenario) {
  return callSimulatorAdmin(`/team/${externalTeamId}/judge-scenario`, 'PATCH', { scenario });
}

/**
 * Fetch all available judge scenarios grouped by environment code.
 */
async function getJudgeScenarios() {
  return callSimulatorAdmin('/team/judge-scenarios', 'GET');
}

async function getJudgeLive(externalTeamId) {
  const url = externalTeamId ? `/team/judge-live?teamId=${externalTeamId}` : '/team/judge-live';
  return callSimulatorAdmin(url, 'GET');
}

/**
 * Fetch details of the currently active judge team.
 */
async function getJudgeActive() {
  return callSimulatorAdmin('/team/judge-active', 'GET');
}

/**
 * Fetch details of a specific environment.
 */
async function getEnvironment(environmentId) {
  return callSimulatorAdmin(`/environment/${environmentId}`, 'GET');
}

module.exports = {
  createExternalTeam,
  fetchExternalKeys,
  toggleJudgeActive,
  updateJudgeScenario,
  getJudgeScenarios,
  getJudgeLive,
  getJudgeActive,
  getEnvironment
};

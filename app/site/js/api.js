/**
 * API client for SPEAR backend
 */

const API_BASE = '/api';

/**
 * Generic fetch wrapper with error handling
 */
async function fetchAPI(endpoint, options = {}) {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'API request failed');
    }

    return data.data;
  } catch (error) {
    console.error(`API Error (${endpoint}):`, error);
    throw error;
  }
}

// ============================================================================
// Platform API
// ============================================================================

const platformAPI = {
  /**
   * Get all platforms
   */
  async getAll() {
    return fetchAPI('/platforms');
  },

  /** 
   * Get specific platform
   */
  async get(type, id) {
    return fetchAPI(`/platforms/${type}/${id}`);
  },

  /**
   * Create new platform
   */
  async create(type, data) {
    return fetchAPI('/platforms', {
      method: 'POST',
      body: JSON.stringify({ type, data }),
    });
  },

  /**
   * Update platform
   */
  async update(type, id, data) {
    return fetchAPI(`/platforms/${type}/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  /**
   * Delete platform
   */
  async delete(type, id) {
    return fetchAPI(`/platforms/${type}/${id}`, {
      method: 'DELETE',
    });
  },
};

// ============================================================================
// Scenario API
// ============================================================================

const scenarioAPI = {
  /**
   * Get all scenarios
   */
  async getAll() {
    return fetchAPI('/scenarios');
  },

  /**
   * Get specific scenario
   */
  async get(id) {
    return fetchAPI(`/scenarios/${id}`);
  },

  /**
   * Create new scenario
   */
  async create(scenario) {
    return fetchAPI('/scenarios', {
      method: 'POST',
      body: JSON.stringify(scenario),
    });
  },

  /**
   * Update scenario
   */
  async update(id, scenario) {
    return fetchAPI(`/scenarios/${id}`, {
      method: 'PUT',
      body: JSON.stringify(scenario),
    });
  },

  /**
   * Delete scenario
   */
  async delete(id) {
    return fetchAPI(`/scenarios/${id}`, {
      method: 'DELETE',
    });
  },
};

// ============================================================================
// Simulation API
// ============================================================================

const simulationAPI = {
  /**
   * Initialize simulation with scenario
   */
  async init(scenarioId, timeStep = 0.5) {
    return fetchAPI('/simulation/init', {
      method: 'POST',
      body: JSON.stringify({ scenarioId, timeStep }),
    });
  },

  /**
   * Run full simulation (all steps at once)
   */
  async run(simulationKey) {
    return fetchAPI('/simulation/run', {
      method: 'POST',
      body: JSON.stringify({ simulationKey }),
    });
  },

  /**
   * Advance simulation by one time step
   */
  async step(simulationKey) {
    return fetchAPI('/simulation/step', {
      method: 'POST',
      body: JSON.stringify({ simulationKey }),
    });
  },

  /**
   * Get current simulation state without stepping
   */
  async getState() {
    return fetchAPI('/simulation/state');
  },

  /**
   * Reset simulation to initial state
   */
  async reset() {
    return fetchAPI('/simulation/reset', {
      method: 'POST',
    });
  },


  /**
   * Get SAM precipitation-attenuated ranges profile
   */
  async getRanges() {
    return fetchAPI('/simulation/getRanges', {
      method: 'POST',
    });
  },
};

// ============================================================================
// Export to global scope for browser access
// ============================================================================
window.platformAPI = platformAPI;
window.scenarioAPI = scenarioAPI;
window.simulationAPI = simulationAPI;

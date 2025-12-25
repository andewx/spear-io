/**
 * Main application logic for SPEAR
 */

// State management
const appState = {
  platforms: { sams: [], fighters: [] },
  scenarios: [],
  selectedSAM: null,
  selectedFighter: null,
  selectedScenario: null,
  simulationKey: null,
  simulationManager: null,
  rangeProfile: null,
};

// Visualization instance
let visualization;

// ============================================================================
// Initialization
// ============================================================================

document.addEventListener('DOMContentLoaded', async () => {
  console.log('SPEAR Application Starting...');
  
  // Initialize simulation manager
  appState.simulationManager = new SimulationManager();
  
  // Initialize visualization
  visualization = new RadarVisualization('radarCanvas');
  
  // Load initial data
  await loadPlatforms();
  await loadScenarios();
  
  // Setup event listeners
  setupEventListeners();
  
  console.log('Application Ready');
});

// ============================================================================
// Data Loading
// ============================================================================

async function loadPlatforms() {
  try {
    const platforms = await platformAPI.getAll();
    appState.platforms = platforms;
    
    // Update editor panel
    updateEditorPanel();
    
    console.log(`Loaded ${platforms.sams.length} SAMs and ${platforms.fighters.length} fighters`);
  } catch (error) {
    console.error('Failed to load platforms:', error);
  }
}

// Make loadPlatforms globally accessible for forms.js to call after delete/update
window.reloadPlatforms = loadPlatforms;

async function loadScenarios() {
  try {
    const scenarios = await scenarioAPI.getAll();
    appState.scenarios = scenarios;
    
    // Populate scenario dropdown
    const scenarioSelect = document.getElementById('scenarioSelect');
    scenarioSelect.innerHTML = '<option value="">Select Scenario...</option>';
    scenarios.forEach(scenario => {
      const option = document.createElement('option');
      option.value = scenario.id;
      option.textContent = scenario.name;
      scenarioSelect.appendChild(option);
    });
    
    // Update editor panel
    updateEditorPanel();
    
    console.log(`Loaded ${scenarios.length} scenarios`);
  } catch (error) {
    console.error('Failed to load scenarios:', error);
  }
}

// Make loadScenarios globally accessible for forms.js to call after delete/update
window.reloadScenarios = loadScenarios;

// ============================================================================
// Event Listeners
// ============================================================================

function setupEventListeners() {
  // Event listeners are now handled by bluejs bindings
}
// ============================================================================

function updateEditorPanel() {
  const editorPanel = document.getElementById('editorPanel');
  if (!editorPanel) return;
  
  const { sams, fighters } = appState.platforms;
  const scenarios = appState.scenarios;
  
  if (sams.length === 0 && fighters.length === 0 && scenarios.length === 0) {
    editorPanel.innerHTML = '<p class="text-muted small">No platforms or scenarios available. Create new items to get started.</p>';
    return;
  }
  
  let html = '<div class="platform-hierarchy">';
  
  // SAM Systems Section
  if (sams.length > 0) {
    html += '<div class="mb-3">';
    html += '<h6 class="text-primary mb-2"><i class="bi bi-diagram-3"></i> SAM Systems</h6>';
    html += '<div class="list-group list-group-flush">';
    
    sams.forEach(sam => {
      html += `
        <div class="list-group-item bg-dark border-secondary p-2 d-flex justify-content-between align-items-center">
          <div class="flex-grow-1">
            <small class="fw-bold text-light">${sam.name}</small>
            <br>
            <small class="text-muted">${sam.nominalRange} km | ${sam.systemFrequency} GHz</small>
          </div>
          <div class="btn-group btn-group-sm" role="group">
            <button class="btn btn-outline-primary py-0 px-2" 
                    bluejs="btn-edit-sam-editor-${sam.id}" 
                    bluejs-trigger="click" 
                    bluejs-binding="editPlatform"
                    data-type="sam"
                    data-id="${sam.id}"
                    title="Edit SAM System">
              <i class="bi bi-pencil"></i>
            </button>
            <button class="btn btn-outline-danger py-0 px-2" 
                    bluejs="btn-delete-sam-editor-${sam.id}" 
                    bluejs-trigger="click" 
                    bluejs-binding="deletePlatform"
                    data-type="sam"
                    data-id="${sam.id}"
                    title="Delete SAM System">
              <i class="bi bi-trash"></i>
            </button>
          </div>
        </div>
      `;
    });
    
    html += '</div></div>';
  }
  
  // Fighter Aircraft Section
  if (fighters.length > 0) {
    html += '<div class="mb-3">';
    html += '<h6 class="text-primary mb-2"><i class="bi bi-airplane"></i> Fighter Aircraft</h6>';
    html += '<div class="list-group list-group-flush">';
    
    fighters.forEach(fighter => {
      html += `
        <div class="list-group-item bg-dark border-secondary p-2 d-flex justify-content-between align-items-center">
          <div class="flex-grow-1">
            <small class="fw-bold text-light">${fighter.type}</small>
            <br>
            <small class="text-muted">RCS: ${fighter.rcs.nose} m² | Mach ${fighter.velocity}</small>
          </div>
          <div class="btn-group btn-group-sm" role="group">
            <button class="btn btn-outline-primary py-0 px-2" 
                    bluejs="btn-edit-fighter-editor-${fighter.id}" 
                    bluejs-trigger="click" 
                    bluejs-binding="editPlatform"
                    data-type="fighter"
                    data-id="${fighter.id}"
                    title="Edit Fighter">
              <i class="bi bi-pencil"></i>
            </button>
            <button class="btn btn-outline-danger py-0 px-2" 
                    bluejs="btn-delete-fighter-editor-${fighter.id}" 
                    bluejs-trigger="click" 
                    bluejs-binding="deletePlatform"
                    data-type="fighter"
                    data-id="${fighter.id}"
                    title="Delete Fighter">
              <i class="bi bi-trash"></i>
            </button>
          </div>
        </div>
      `;
    });
    
    html += '</div></div>';
  }
  
  // Scenarios Section
  if (scenarios.length > 0) {
    html += '<div class="mb-3">';
    html += '<h6 class="text-success mb-2"><i class="bi bi-folder"></i> Scenarios</h6>';
    html += '<div class="list-group list-group-flush">';
    
    scenarios.forEach(scenario => {
      const samName = scenario.platforms?.sam?.configId || 'N/A';
      const fighterName = scenario.platforms?.fighter?.configId || 'N/A';
      const hasRain = scenario.environment?.precipitation?.enabled ? '🌧️' : '☀️';
      
      html += `
        <div class="list-group-item bg-dark border-secondary p-2 d-flex justify-content-between align-items-center">
          <div class="flex-grow-1">
            <small class="fw-bold text-light">${scenario.name} ${hasRain}</small>
            <br>
            <small class="text-muted">${scenario.grid?.width || 0}×${scenario.grid?.height || 0} km</small>
          </div>
          <div class="btn-group btn-group-sm" role="group">
            <button class="btn btn-outline-success py-0 px-2" 
                    bluejs="btn-edit-scenario-editor-${scenario.id}" 
                    bluejs-trigger="click" 
                    bluejs-binding="editScenario"
                    data-id="${scenario.id}"
                    title="Edit Scenario">
              <i class="bi bi-pencil"></i>
            </button>
            <button class="btn btn-outline-danger py-0 px-2" 
                    bluejs="btn-delete-scenario-editor-${scenario.id}" 
                    bluejs-trigger="click" 
                    bluejs-binding="deleteScenario"
                    data-id="${scenario.id}"
                    title="Delete Scenario">
              <i class="bi bi-trash"></i>
            </button>
          </div>
        </div>
      `;
    });
    
    html += '</div></div>';
  }
  
  html += '</div>';
  
  editorPanel.innerHTML = html;
  
  // Re-initialize bluejs bindings for dynamically added elements
  if (typeof bluejs !== 'undefined') {
    bluejs.register();
  }
}

// ============================================================================
// Scenario Selection & Simulation Initialization
// ============================================================================

/**
 * Handle scenario selection - initializes simulation and loads range profile
 */
async function selectScenario(scenarioId) {
  if (!scenarioId) {
    console.log('[App] No scenario selected');
    appState.selectedScenario = null;
    appState.simulationKey = null;
    return;
  }
  
  try {
    // Find scenario in loaded scenarios
    const scenario = appState.scenarios.find(s => s.id === scenarioId);
    if (!scenario) {
      console.error('[App] Scenario not found:', scenarioId);
      return;
    }
    
    appState.selectedScenario = scenario;
    console.log('[App] Selected scenario:', scenario.name);
    
    // Initialize simulation with this scenario
    console.log('[App] Initializing simulation...');
    const initResult = await appState.simulationManager.initialize(appState.selectedScenario, visualization);
    appState.simulationKey = appState.simulationManager.getSimulationKey();
    
    // Render visualization with updated state
    if (visualization && visualization.render) {
      visualization.render();
    }
    
    console.log('[App] Scenario initialization complete');
    
  } catch (error) {
    console.error('[App] Failed to select scenario:', error);
    alert('Failed to initialize scenario: ' + error.message);
  }
}


// ============================================================================
// Simulation
// ============================================================================

/**
 * Run simulation to completion
 */
async function runSimulation() {
  if (!appState.selectedScenario || !appState.simulationKey) {
    alert('Please select a scenario first');
    return;
  }
  
  const resultsPanel = document.getElementById('resultsPanel');
  
  try {
    console.log('[App] Running simulation to completion...');
    
    if (resultsPanel) {
      resultsPanel.innerHTML = '<div class="spinner-border spinner-border-sm text-primary"></div> Running simulation...';
    }
    
    const result = await appState.simulationManager.runToCompletion();
    
    console.log('[App] Simulation completed:', result);
    
    // Display results
    if (resultsPanel && result) {
      displaySimulationResults(result.result);
    }
    
  } catch (error) {
    console.error('[App] Simulation failed:', error);
    if (resultsPanel) {
      resultsPanel.innerHTML = `
        <div class="alert alert-danger mb-0">
          <strong>Error:</strong> ${error.message}
        </div>
      `;
    }
  }
}

/**
 * Step simulation forward by one time step
 */
async function stepSimulation() {
  if (!appState.selectedScenario || !appState.simulationKey) {
    alert('Please select a scenario first');
    return;
  }
  
  try {
    const response = await appState.simulationManager.step();
    const timeElapsed = appState.simulationManager.state.timeElapsed;
    const simulationComplete = appState.simulationManager.state.simulationComplete;

    
    if (response) {
      const { state } = response;
      
      // Update time display
      const timeEl = document.getElementById('sim-time');
      if (timeEl) {
        timeEl.textContent = `${timeElapsed.toFixed(1)} s`;
      }
      
      if (simulationComplete) {
        console.log('[App] Simulation complete at t =', timeElapsed, 's');
      }
    }
    
  } catch (error) {
    console.error('[App] Step failed:', error);
  }
}


/**
 * Stop Simulation
 */
function pauseSimulation() {
  if (appState.simulationManager) {
    appState.simulationManager.pause();
    console.log('[App] Simulation stopped by user');
  }
}


/**
 * Reset simulation to initial state
 */
async function resetSimulation() {
  if (!appState.simulationManager) {
    return;
  }
  
  try {
    await appState.simulationManager.reset();
    
    // Clear results panel
    const resultsPanel = document.getElementById('resultsPanel');
    if (resultsPanel) {
      resultsPanel.innerHTML = '<p class="text-muted">No simulation run yet</p>';
    }
    
    // Reset time display
    const timeEl = document.getElementById('sim-time');
    if (timeEl) {
      timeEl.textContent = '0.0 s';
    }
    
    console.log('[App] Simulation reset');
  } catch (error) {
    console.error('[App] Reset failed:', error);
  }
}

/**
 * Display simulation results
 */
function displaySimulationResults(state) {
  const resultsPanel = document.getElementById('resultsPanel');
  if (!resultsPanel) return;
  
  let html = '<div class="simulation-results">';
  
  // Display summary first summary and SAM and fighter status
  for(const sams of state.sams) {
   const classResult = sams.state === 'destroyed' ? 'text-success' : 'text-danger';
    html += `<h5 class="text-primary">SAM System: ${sams.id}</h5>`;
    html += `<p class=${classResult}>Status: ${sams.state.charAt(0).toUpperCase() + sams.state.slice(1)}</p>`;
  }
  for(const fighters of state.fighters) {
    const classResult = fighters.state === 'destroyed' ? 'text-danger' : 'text-success';
    html += `<h5 class="text-success">Fighter Aircraft: ${fighters.id}</h5>`;
    html += `<p class=${classResult}>Status: ${fighters.state.charAt(0).toUpperCase() + fighters.state.slice(1)}</p>`;
  }

  // Missile results

  html += '<h6 class="text-primary mt-3">Missile Results</h6>';
  html += '<dl class="row small mb-0">';
  
  state.missiles.forEach(missile => {
    const key = missile.launchedBy === 'sam' ? 'SAM Missile' : 'HARM Missile';
    let value = `Launched at ${missile.launchTime.toFixed(2)} s`;
    
    
    if (missile.status === 'kill') {
      value += `, Position: (${missile.position.x.toFixed(2)}, ${missile.position.y.toFixed(2)}) km`;
    }
    
    value += `, Status: ${missile.status.charAt(0).toUpperCase() + missile.status.slice(1)}`;
    
    html += `<dt class="col-sm-6">${key}:</dt>`;
    html += `<dd class="col-sm-6">${value}</dd>`;
  });
  
  html += '</dl>';
  
  
  html += '</div>';
  resultsPanel.innerHTML = html;
}

// ============================================================================
// Utility Functions
// ============================================================================

function formatNumber(value, decimals = 2) {
  return typeof value === 'number' ? value.toFixed(decimals) : '-';
}

/**
 * Form Handlers
 * Client-side handlers for platform and scenario form operations using bluejs framework
 */

//====================================================================
// Form state for adding multiple platforms
//====================================================================

let samPlatformCount = 0;
let fighterPlatformCount = 0;

// Store platform data for use in dynamic forms
window.scenarioFormData = {
  samSystems: appState.platforms.sams || [],
  fighters: appState.platforms.fighters || []
};

/**
 * Initialize scenario form with platform data
 * Called from EJS templates to provide platform options
 */
window.initScenarioFormData = function(samSystems, fighters) {
  window.scenarioFormData.samSystems = samSystems || [];
  window.scenarioFormData.fighters = fighters || [];
};

/**
 * Add SAM Platform to scenario form
 * @param {Object} existingData - Optional existing platform data for edit mode
 */
window.addSAMPlatform = function(existingData) {
  const container = document.getElementById('sam-platforms-container');
  if (!container) return;
  
  const index = samPlatformCount++;
  
  // Default or existing data
  const data = existingData || {
    id: `sam-${index + 1}`,
    configId: '',
    position: { x: 0, y: 0 },
    heading: 0,
    velocity: 0
  };
  
  const configId = data.configId || data.platform?.id || '';
  
  // Build SAM options from stored data
  let samOptions = '<option value="">Select SAM System...</option>';
  appState.platforms.sams.forEach(sam => {
    const selected = configId === sam.id ? 'selected' : '';
    samOptions += `<option value="${sam.id}" ${selected}>${sam.name}</option>`;
  });
  
  const html = `
    <div class="form-item border border-secondary rounded p-3 mb-3" id="sam-${index}">
      <div class="d-flex justify-content-between align-items-center mb-3">
        <h6 class="text-secondary mb-0">SAM System ${index + 1}</h6>
        <button type="button" class="btn btn-sm btn-outline-danger" onclick="window.removeSAMPlatform(${index})">
          <i class="bi bi-trash"></i> Remove
        </button>
      </div>
      
      <div class="row">
        <div class="col-md-6 mb-3">
          <label class="form-label">SAM System</label>
          <select name="platforms[sams][${index}][id]" class="form-select bg-dark text-light border-secondary" required>
            ${samOptions}
          </select>
        </div>
      </div>
      
      <div class="row">
        <div class="col-md-3 mb-3">
          <label class="form-label">Position X (km)</label>
          <input type="hidden" name="platforms[sams][${index}][type]" value="sam">
          <input type="number" step="0.1" name="platforms[sams][${index}][position][x]" class="form-control bg-dark text-light border-secondary" required value="${data.position.x}">
        </div>
        <div class="col-md-3 mb-3">
          <label class="form-label">Position Y (km)</label>
          <input type="number" step="0.1" name="platforms[sams][${index}][position][y]" class="form-control bg-dark text-light border-secondary" required value="${data.position.y}">
        </div>
        <div class="col-md-3 mb-3">
          <label class="form-label">Heading (deg)</label>
          <input type="number" step="1" name="platforms[sams][${index}][heading]" class="form-control bg-dark text-light border-secondary" value="${data.heading || 0}">
        </div>
        <div class="col-md-3 mb-3">
          <label class="form-label">Velocity (Mach)</label>
          <input type="number" step="0.1" name="platforms[sams][${index}][velocity]" class="form-control bg-dark text-light border-secondary" value="${data.velocity || 0}" readonly>
        </div>
      </div>
    </div>
  `;
  
  container.insertAdjacentHTML('beforeend', html);
};

/**
 * Remove SAM Platform from scenario form
 */
window.removeSAMPlatform = function(index) {
  const element = document.getElementById(`sam-${index}`);
  if (element) {
    element.remove();
  }
};

/**
 * Add Fighter Platform to scenario form
 * @param {Object} existingData - Optional existing platform data for edit mode
 */
window.addFighterPlatform = function(existingData) {
  const container = document.getElementById('fighter-platforms-container');
  if (!container) return;
  
  const index = fighterPlatformCount++;
  
  // Default or existing data
  const data = existingData || {
    id: `fighter-${index + 1}`,
    configId: '',
    position: { x: -150, y: 250 },
    velocity: 0.8,
    heading: 0,
    flightPath: 'straight'
  };
  
  const configId = data.configId || data.platform?.id || '';
  const flightPath = data.flightPath || data.data?.flightPath || 'straight';
  
  console.log(`Fighters: `, appState.platforms);
  // Build fighter options from stored data
  let fighterOptions = '<option value="">Select Fighter...</option>';
  appState.platforms.fighters.forEach(fighter => {
    const selected = configId === fighter.id ? 'selected' : '';
    fighterOptions += `<option value="${fighter.id}" ${selected}>${fighter.type}</option>`;
  });
  
  const html = `
    <div class="platform-item border border-secondary rounded p-3 mb-3" id="fighter-${index}">
      <div class="d-flex justify-content-between align-items-center mb-3">
        <h6 class="text-secondary mb-0">Fighter ${index + 1}</h6>
        <button type="button" class="btn btn-sm btn-outline-danger" onclick="window.removeFighterPlatform(${index})">
          <i class="bi bi-trash"></i> Remove
        </button>
      </div>
      
      <div class="row">
        <div class="col-md-6 mb-3">
          <label class="form-label">Fighter Aircraft</label>
          <select name="platforms[fighters][${index}][id]" class="form-select bg-dark text-light border-secondary" required>
            ${fighterOptions}
          </select>
        </div>
      </div>
      
      <div class="row">
        <div class="col-md-3 mb-3">
          <label class="form-label">Position X (km)</label>
          <input type="hidden" name="platforms[fighters][${index}][type]" value="fighter">
          <input type="number" step="0.1" name="platforms[fighters][${index}][position][x]" class="form-control bg-dark text-light border-secondary" required value="${data.position.x}">
        </div>
        <div class="col-md-3 mb-3">
          <label class="form-label">Position Y (km)</label>
          <input type="number" step="0.1" name="platforms[fighters][${index}][position][y]" class="form-control bg-dark text-light border-secondary" required value="${data.position.y}">
        </div>
        <div class="col-md-3 mb-3">
          <label class="form-label">Heading (deg)</label>
          <input type="number" step="1" name="platforms[fighters][${index}][heading]" class="form-control bg-dark text-light border-secondary" required value="${data.heading || 0}">
        </div>
        <div class="col-md-3 mb-3">
          <label class="form-label">Velocity (Mach)</label>
          <input type="number" step="0.1" name="platforms[fighters][${index}][velocity]" class="form-control bg-dark text-light border-secondary" value="${data.velocity || 0.8}">
        </div>
      </div>
      
      <div class="mb-3">
        <label class="form-label">Flight Path Type</label>
        <select name="platforms[fighters][${index}][flightPath]" class="form-select bg-dark text-light border-secondary">
          <option value="straight" ${flightPath === 'straight' ? 'selected' : ''}>Straight</option>
          <option value="evasive" ${flightPath === 'evasive' ? 'selected' : ''}>Evasive</option>
          <option value="memrFringe" ${flightPath === 'memrFringe' ? 'selected' : ''}>MEMR Fringe</option>
        </select>
      </div>
    </div>
  `;
  
  container.insertAdjacentHTML('beforeend', html);
};

/**
 * Remove Fighter Platform from scenario form
 */
window.removeFighterPlatform = function(index) {
  const element = document.getElementById(`fighter-${index}`);
  if (element) {
    element.remove();
  }
};

/**
 * Toggle precipitation fields visibility
 */
window.togglePrecipitation = function() {
  const enabled = document.getElementById('precipitationEnabled');
  const fields = document.getElementById('precipitationFields');
  if (enabled && fields) {
    if (enabled.checked) {
      fields.classList.remove('d-none');
    } else {
      fields.classList.add('d-none');
    }
  }
};

/**
 * Distribution Toggle Binding
 */

function distributionToggle(event) {
  event?.preventDefault();
  const select = document.getElementById('distributionPresetSelect');
  const customFields = document.getElementById('customDistributionFields');
  if (select && customFields) {
    if (select.value === 'custom') {
      customFields.classList.remove('d-none');
    } else {
      customFields.classList.add('d-none');
    }
  }
}


/**
 * Get selected platform from dropdown
 * @param {string} selectId - ID of select element
 * @returns {string|null} Selected platform ID
 */
function getSelectedPlatform(selectId) {
  const select = document.getElementById(selectId);
  return select ? select.value : null;
}

/**
 * Get selected scenario from dropdown
 * @returns {string|null} Selected scenario ID
 */
function getSelectedScenario() {
  const select = document.getElementById('scenarioSelect');
  return select ? select.value : null;
}


function submitScenarioForm(event) {
  event?.preventDefault();
  fighterPlatformCount = 0;
  samPlatformCount = 0;
  const form = document.getElementById('scenarioForm');
  if (form) {
    form.submit();  
  }
}

function cancelScenarioForm(event) {
  event?.preventDefault();
  fighterPlatformCount = 0;
  samPlatformCount = 0;
}






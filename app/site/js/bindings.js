// ============================================================================
// BlueJS Bindings Registration
// ============================================================================

// ============================================================================
// Platform Form Handlers
// ============================================================================

/**
 * Open create SAM system form
 */
function createSAMSystem(e) {
  e?.preventDefault();
  openOverlay('/forms/platform/create?type=sam', 'Create SAM System');
}

/**
 * Open create fighter aircraft form
 */
function createFighter(e) {
  e?.preventDefault();
  openOverlay('/forms/platform/create?type=fighter', 'Create Fighter');
}



/**
 * Open edit platform form
 */
function editPlatform(e) {
  e?.preventDefault();
  const element = e.currentTarget;
  const type = element.getAttribute('data-type');
  const id = element.getAttribute('data-id');
  
  if (!type || !id) {
    console.error('Platform type and ID required');
    return;
  }
  
  const title = type === 'sam' ? 'Edit SAM System' : 'Edit Fighter Aircraft';
  openOverlay(`/forms/platform/edit/${type}/${id}`, title);
}

/**
 * Delete platform with confirmation
 */
async function deletePlatform(e) {
  e?.preventDefault();
  const element = e.currentTarget;
  const type = element.getAttribute('data-type');
  const id = element.getAttribute('data-id');
  
  if (!type || !id) {
    console.error('Platform type and ID required');
    return;
  }
  
  const confirmMsg = `Are you sure you want to delete this ${type === 'sam' ? 'SAM system' : 'fighter aircraft'}?`;
  if (!confirm(confirmMsg)) {
    return;
  }
  
  try {
    const response = await fetch(`/api/platforms/${type}/${id}`, {
      method: 'DELETE',
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete platform');
    }
    
    // Reload page to show updated list
    window.location.reload();
  } catch (error) {
    console.error('Error deleting platform:', error);
    alert(`Error: ${error.message}`);
  }
}

// ============================================================================
// Scenario Form Handlers
// ============================================================================

/**
 * Open create scenario form
 */
function createScenario(e) {
  e?.preventDefault();
  openOverlay('/forms/scenario/create', 'Create Scenario');
}

/**
 * Open edit scenario form
 */
function editScenario(e) {
  e?.preventDefault();
  const element = e.currentTarget;
  const id = element.getAttribute('data-id');
  
  if (!id) {
    console.error('Scenario ID required');
    return;
  }
  
  openOverlay(`/forms/scenario/edit/${id}`, 'Edit Scenario');
}

/**
 * Delete scenario with confirmation
 */
async function deleteScenario(e) {
  e?.preventDefault();
  const element = e.currentTarget;
  const id = element.getAttribute('data-id');
  
  if (!id) {
    console.error('Scenario ID required');
    return;
  }
  
  if (!confirm('Are you sure you want to delete this scenario?')) {
    return;
  }
  
  try {
    const response = await fetch(`/api/scenarios/${id}`, {
      method: 'DELETE',
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete scenario');
    }
    
    // Reload page to show updated list
    window.location.reload();
  } catch (error) {
    console.error('Error deleting scenario:', error);
    alert(`Error: ${error.message}`);
  }
}

/**
 * View scenario details
 */
function viewScenario(e) {
  e?.preventDefault();
  const element = e.currentTarget;
  const id = element.getAttribute('data-id');
  
  if (!id) {
    console.error('Scenario ID required');
    return;
  }
  
  // Navigate to scenario detail page
  window.location.href = `/scenarios/${id}`;
}

// ============================================================================
// Scenario Selection Handlers
// ============================================================================

/**
 * Handle scenario selection from dropdown
 */
async function handleSelectScenario(e) {
  const scenarioId = e?.currentTarget?.value;
  
  if (!scenarioId) {
    console.log('[Bindings] No scenario selected');
    return;
  }
  
  // Delegate to app.js
  await selectScenario(scenarioId);
}

// ============================================================================
// Precipitation Field Handlers
// ============================================================================

/**
 * Generate precipitation field for selected scenario
 */
async function generatePrecipitation(e) {
  console.log('generatePrecipitation called', e);
  e?.preventDefault();
  
  // Get selected scenario from dropdown
  const scenarioSelect = document.getElementById('scenarioSelect');
  console.log('scenarioSelect:', scenarioSelect, 'value:', scenarioSelect?.value);
  
  if (!scenarioSelect || !scenarioSelect.value) {
    alert('Please select a scenario first');
    return;
  }
  
  const scenarioId = scenarioSelect.value;
  const btn = e?.currentTarget;
  const originalText = btn?.innerHTML;
  
  console.log('Generating precipitation for scenario:', scenarioId);
  
  try {
    // Disable button and show loading state
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Generating...';
    }
    
    // Call API to generate precipitation field
    console.log('Calling /api/synthetic/precipitation with scenarioId:', scenarioId);
    const response = await fetch('/api/synthetic/precipitation', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ scenarioId }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to generate precipitation field');
    }
    
    const result = await response.json();
    console.log('Precipitation field generated successfully:', result.data);
    
    // Reload page to update visualization
    window.location.reload();
    
  } catch (error) {
    console.error('Error generating precipitation field:', error);
    alert(`Error: ${error.message}`);
  } finally {
    // Re-enable button
    if (btn && originalText) {
      btn.disabled = false;
      btn.innerHTML = originalText;
    }
  }
}

// ============================================================================
// Simulation Handlers
// ============================================================================

/**
 * Step simulation forward
 */
async function handleStepSimulation(e) {
  e?.preventDefault();
  await stepSimulation();
}

/**
 * Run simulation to completion
 */
async function handleRunSimulation(e) {
  e?.preventDefault();
  await runSimulation();
}

/**
 * Reset simulation
 */
async function handleResetSimulation(e) {
  e?.preventDefault();
  await resetSimulation();
}


function scenarioGridValueInputWidth(e) {
  e?.preventDefault();
    const input = e?.currentTarget;

    
    //enforce 16:9 aspect ratio constraint on the input height
    if (input) {
        const width = input.value;
        const height = Math.round((width * 9) / 16);
        const heightInput = document.getElementById('gridHeightInput');
        if (heightInput) {
            heightInput.value = height;
        }
    }
}


function scenarioGridValueInputHeight(e) {
  e?.preventDefault();
    const input = e?.currentTarget;
    
    //enforce 16:9 aspect ratio constraint on the input width
    if (input) {
        const height = input.value;
        const width = Math.round((height * 16) / 9);
        const widthInput = document.getElementById('gridWidthInput');
        if (widthInput) {
            widthInput.value = width;
        }
    }
}

/**
 * Open create platform form (general)
 */
function createPlatform(e) {
  e?.preventDefault();
  openOverlay('/forms/platform/create', 'Create Platform');
}


// Register all form handler bindings with bluejs
bluejs.addBinding('createPlatform', null, createPlatform);
bluejs.addBinding('createSAMSystem', null, createSAMSystem);
bluejs.addBinding('createFighter', null, createFighter);
bluejs.addBinding('editPlatform', null, editPlatform);
bluejs.addBinding('deletePlatform', null, deletePlatform);
bluejs.addBinding('createScenario', null, createScenario);
bluejs.addBinding('editScenario', null, editScenario);
bluejs.addBinding('deleteScenario', null, deleteScenario);
bluejs.addBinding('viewScenario', null, viewScenario);
bluejs.addBinding('selectScenario', null, handleSelectScenario);
bluejs.addBinding('generatePrecipitation', null, generatePrecipitation);
bluejs.addBinding('runSimulation', null, handleRunSimulation);
bluejs.addBinding('stepSimulation', null, handleStepSimulation);
bluejs.addBinding('resetSimulation', null, handleResetSimulation);
bluejs.addBinding('distributionToggle', null, distributionToggle);
bluejs.addBinding('gridWidth',null , scenarioGridValueInputWidth);
bluejs.addBinding('gridHeight',null , scenarioGridValueInputHeight);
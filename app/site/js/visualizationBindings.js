/*
    * Visualization Bindings
    * 
    * Interactive Fighter Positioning:
    * - Hold SHIFT and click a fighter to select it
    * - Drag selected fighter to move position
    * - Click/drag the outer ring to adjust heading
    * - Click empty space to deselect
    * - Changes auto-save to backend on mouse release
    * - Normal pan/zoom: left-click drag (no shift) / scroll wheel
*/

let canvasPanActive = false;
let lastMousePos = { x: 0, y: 0 };

function zoomWheel(event) {
    event.preventDefault();
    const zoomFactor = 1.01;
    if (event.deltaY < 0) {
        visualization.currentZoom *= zoomFactor;
    } else {
        visualization.currentZoom /= zoomFactor;
    }

    if (visualization.currentZoom < 1.0/visualization.maxZoom) {
        visualization.currentZoom = 1.0/visualization.maxZoom;
    }
    if (visualization.currentZoom > visualization.maxZoom) {
        visualization.currentZoom = visualization.maxZoom;
    }
   
    visualization.render();
}

async function handleCanvasMouseDown(event) {
    event?.preventDefault();
    const rect = visualization.canvas.getBoundingClientRect();
    
    // Scale mouse coordinates to match canvas internal resolution
    const scaleX = visualization.canvas.width / rect.width;
    const scaleY = visualization.canvas.height / rect.height;
    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;
    

    console.log('Mouse click - clientX:', event.clientX, 'clientY:', event.clientY);
    console.log('Canvas rect - left:', rect.left, 'top:', rect.top, 'width:', rect.width, 'height:', rect.height);
    console.log('Canvas internal size - width:', visualization.canvas.width, 'height:', visualization.canvas.height);
    console.log('Scale factors - scaleX:', scaleX, 'scaleY:', scaleY);
    console.log('Scaled canvas coords - x:', x, 'y:', y);

    lastMousePos = { x, y };

    
    // Check if clicking on a fighter (only in edit mode or when shift is held)
    if (event.shiftKey || visualization.interactionMode === 'edit') {
        // Check if clicking heading knob
        if (visualization.isClickOnHeadingKnob(x, y)) {
            visualization.isAdjustingHeading = true;
            updateEditModeIndicator();
            return; // Don't activate pan
        }
        
        // Check if clicking fighter
        const result = visualization.getFighterAtPosition(x, y);
        console.log('Clicked fighter result:', result);
        if (result) {
            visualization.selectedFighter = result.fighter;
            visualization.selectedFighterIndex = result.index;
            visualization.isDraggingFighter = true;
            visualization.interactionMode = 'edit';
            updateEditModeIndicator();
            visualization.render();
            return; // Don't activate pan
        }
        
        // Clicking empty space in edit mode deselects but stays in edit if shift held
        if (visualization.interactionMode === 'edit') {
            visualization.selectedFighter = null;
            visualization.selectedFighterIndex = -1;
            if (!event.shiftKey) {
                visualization.interactionMode = 'pan';
            }
            updateEditModeIndicator();
            visualization.render();
            return; // Don't activate pan in edit mode
        }
    }else{
        // Clear selection if clicking without shift in non-edit mode
        visualization.selectedFighter = null;
        visualization.selectedFighterIndex = -1;
        visualization.interactionMode = 'pan';
        updateEditModeIndicator();
        visualization.render();
    }
    
    // Only activate pan if NOT in edit mode and NOT holding shift
    if (visualization.interactionMode !== 'edit' && !event.shiftKey) {
        canvasPanActive = true;
    }
}

function handleCanvasMouseMove(event) {
    event?.preventDefault();
    const rect = visualization.canvas.getBoundingClientRect();
    
    // Scale mouse coordinates to match canvas internal resolution
    const scaleX = visualization.canvas.width / rect.width;
    const scaleY = visualization.canvas.height / rect.height;
    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;
    
    // Dragging fighter position
    if (visualization.isDraggingFighter && visualization.selectedFighter) {
        visualization.canvas.style.cursor = 'move';
        const gridPos = visualization.canvasToGrid(x, y);
        visualization.selectedFighter.position.x = gridPos.x;
        visualization.selectedFighter.position.y = gridPos.y;

        // We need to update fighter position in the simulation manager

        visualization.render();
        return;
    }
    
    // Adjusting heading with knob
    if (visualization.isAdjustingHeading && visualization.selectedFighter) {
        visualization.canvas.style.cursor = 'crosshair';
        const pos = visualization.gridToCanvas(
            visualization.selectedFighter.position.x,
            visualization.selectedFighter.position.y
        );
        const transformedX = pos.x * visualization.currentZoom + visualization.panOffset.x;
        const transformedY = pos.y * visualization.currentZoom + visualization.panOffset.y;
        
        const dx = x - transformedX;
        const dy = y - transformedY;
        // Canvas Y increases downward, but we want standard math coordinates (Y up)
        // So negate dy to get correct angle
        let angleRadians = Math.atan2(-dy, dx); // In radians (-π to π)
        // Normalize to 0 to 2π
        if (angleRadians < 0) angleRadians += 2 * Math.PI;
        
        visualization.selectedFighter.heading = angleRadians; // Store in radians

        // We need to update fighter heading in the backend state
        
    
        visualization.render();
        return;
    }
    
    // Update cursor based on hover state
    if (event.shiftKey || visualization.interactionMode === 'edit') {
        if (visualization.isClickOnHeadingKnob(x, y)) {
            visualization.canvas.style.cursor = 'crosshair';
        } else if (visualization.getFighterAtPosition(x, y)) {
            visualization.canvas.style.cursor = 'pointer';
        } else {
            visualization.canvas.style.cursor = 'default';
        }
    } else {
        visualization.canvas.style.cursor = canvasPanActive ? 'grabbing' : 'grab';
    }
    
    // Pan canvas (only if not in edit mode and left mouse button is down)
    if (canvasPanActive && event.buttons === 1 && visualization.interactionMode !== 'edit') {
        visualization.panOffset.x += event.movementX;
        visualization.panOffset.y += event.movementY;
        visualization.render();
    }
}

async function handleCanvasMouseUp(event) {
    event?.preventDefault();
    
    if ((visualization.isDraggingFighter || visualization.isAdjustingHeading) && visualization.selectedFighter) {
        visualization.canvas.style.cursor = 'default';

        console.log(`Selected Figher:`, visualization.selectedFighter);
        await saveFighterUpdate(visualization.selectedFighterIndex, visualization.selectedFighter);
  
    }
   
    
    
    visualization.isDraggingFighter = false;
    visualization.isAdjustingHeading = false;
    canvasPanActive = false;
    updateEditModeIndicator();
    visualization.render();
}

/**
 * Update edit mode indicator visibility
 */
function updateEditModeIndicator() {
    const indicator = document.getElementById('editModeIndicator');
    if (!indicator) {
        console.warn('Edit mode indicator element not found');
        return;
    }
    
    // Check if visualization exists and has interactionMode property
    if (!visualization || typeof visualization.interactionMode === 'undefined') {
        console.warn('Visualization not initialized yet');
        indicator.classList.add('d-none');
        return;
    }
    
    if (visualization.interactionMode === 'edit') {
        indicator.classList.remove('d-none');
        indicator.style.display = 'block';
        if (visualization.isDraggingFighter) {
            indicator.textContent = '✏️ EDIT MODE - Dragging Fighter';
        } else if (visualization.isAdjustingHeading) {
            indicator.textContent = '✏️ EDIT MODE - Adjusting Heading';
        } else if (visualization.selectedFighter) {
            indicator.textContent = '✏️ EDIT MODE - Fighter Selected';
        } else {
            indicator.textContent = '✏️ EDIT MODE - Click fighter to select';
        }
    } else {
        indicator.classList.add('d-none');
        indicator.style.display = 'none';
    }
}

/**
 * Save updated fighter position/heading to backend
 */
async function saveFighterUpdate(fighterIndex, fighter) {
    if (!appState.simulationManager.scenario) return;
    
    try {
        console.log('Saving fighter update to backend...');
        const scenario = appState.simulationManager.scenario;
        if (!scenario) {
            console.error('No scenario loaded in simulation manager');
            return;
        }
        
        // Update the scenario's fighter platform data
        if (!scenario.platforms || !scenario.platforms.fighters || !scenario.platforms.fighters[fighterIndex]) {
            console.error('Fighter not found in scenario platforms');
            return;
        }
        
        // Use the fighter parameter (from appState) to get the latest values
        scenario.platforms.fighters[fighterIndex].position = {
            x: Math.round(fighter.position.x * 10) / 10, // Round to 1 decimal
            y: Math.round(fighter.position.y * 10) / 10
        };
        scenario.platforms.fighters[fighterIndex].heading = fighter.heading; // Already in radians
        
        console.log('Saving fighter:', fighterIndex);
        console.log('  Position:', fighter.position);
        console.log('  Heading (radians):', fighter.heading);
        console.log('  Heading (degrees):', fighter.heading * 180 / Math.PI);
        
        // Save to backend
        await scenarioAPI.update(scenario.id, scenario);
        await appState.simulationManager.initialize(scenario, visualization);

        console.log('Scenario saved and simulation re-initialized');

    } catch (error) {
        console.error('Failed to save fighter update:', error);
    }
}

function panStart(event) {
    event?.preventDefault();
    canvasPanActive = true;
}

function panEnd(event) {
    event?.preventDefault();
    canvasPanActive = false;
}

function panCanvas(event) {
    event?.preventDefault
    if (event.buttons !== 1) return; // Only pan on left mouse button drag
    visualization.panOffset.x += event.movementX;
    visualization.panOffset.y += event.movementY;

  
   visualization.render();
}


function resetView(event) {
    event?.preventDefault();
    visualization.currentZoom = 1.0;
    visualization.panOffset = { x: 0, y: 0 };
    visualization.selectedFighter = null;
    visualization.selectedFighterIndex = -1;
    visualization.interactionMode = 'pan';
    updateEditModeIndicator();
    visualization.render();
}

/**
 * Set precipitation image display type
 */
function setPrecipImageType(event) {
    event?.preventDefault();
    const imageType = event.currentTarget.getAttribute('data-image-type');
    
    // Update button active states
    document.querySelectorAll('[data-image-type]').forEach(btn => {
        btn.classList.remove('active');
    });
    event.currentTarget.classList.add('active');
    
    // Update visualization
    if (visualization && visualization.setPrecipImageType) {
        visualization.setPrecipImageType(imageType);
    }
}

/**
 * Handle keyboard shortcuts
 */
function handleKeyDown(event) {
    // ESC key exits edit mode
    if (event.key === 'Escape' && visualization.interactionMode === 'edit') {
        visualization.selectedFighter = null;
        visualization.selectedFighterIndex = -1;
        visualization.interactionMode = 'pan';
        updateEditModeIndicator();
        visualization.render();
    }
}


bluejs.addBinding("canvasZoom", null, zoomWheel);
bluejs.addBinding("canvasPanStart", null, panStart);
bluejs.addBinding("canvasPanEnd", null, panEnd);
bluejs.addBinding("canvasPanMove", null, panCanvas);
bluejs.addBinding("resetViewVisualization", null, resetView);
bluejs.addBinding("setPrecipImageType", null, setPrecipImageType);



// Additional event bindings after canvas loads
document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('radarCanvas');
    if (!canvas) return;
    
    // Wheel zoom
    canvas.addEventListener('wheel', (e) => {
        bluejs.triggerBinding('canvasZoom', e);
    });
    
    // Replace old pan handlers with new interactive handlers
    canvas.addEventListener('mousedown', handleCanvasMouseDown);
    canvas.addEventListener('mousemove', handleCanvasMouseMove);
    canvas.addEventListener('mouseup', handleCanvasMouseUp);
    
    // Pan cancel
    canvas.addEventListener('mouseleave', (e) => {
        handleCanvasMouseUp(e);
    });
    
    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyDown);
    
    // Initialize edit mode indicator
    updateEditModeIndicator();
});



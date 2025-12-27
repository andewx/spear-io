/**
 * Visualization module for SPEAR radar display
 */

class RadarVisualization {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.scenario = null;
    this.sam = null;
    this.fighter = null;
    this.results = null;
    this.precipitationImage = null;
    this.precipImageType = 'normal'; // 'normal', 'overlay', or 'jet'
    this.rangeData = null;
    this.currentZoom = 1.0;
    this.panOffset = { x: 0, y: 0 };
    this.maxZoom = 5.0;
    
    // Fighter interaction state
    this.selectedFighter = null;
    this.selectedFighterIndex = -1;
    this.isDraggingFighter = false;
    this.isAdjustingHeading = false;
    this.interactionMode = 'pan'; // 'pan' or 'edit'
    
    // Aspect ratio constant (16:9)
    this.ASPECT_RATIO = 16 / 9;
    
    // Resize canvas to fill container
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());
    
    // Initial render
    this.render();
  }

  updateRangeProfile(rangeData) {
    // Process and display range profile data on the radar visualization
    try{
       this.rangeData = rangeData.ranges.map(r => parseFloat(r));
    } catch(e){
      console.error("Failed to parse range profile data:", e);
      this.rangeData = JSON.parse(JSON.stringify(rangeData.ranges));
    }
  }

  renderRangeProfile(){
    if (!this.rangeData) return;

    const ctx = this.ctx;
    // Example: Draw range profile as a simple line graph at the bottom of the canvas
    const padding = 0;
    const graphHeight = 100;
    const graphWidth = this.canvas.width - 2 * padding;


    ctx.beginPath();
    

    try{

      ////Just iterate through range data as array
      let az = 0;
      const step = 360 / this.rangeData.length;

      for(let i = 0; i < this.rangeData.length-1; i++){
        const range = this.rangeData[i];
        const unitX = Math.cos(az * Math.PI / 180);
        const unitY = Math.sin(az * Math.PI / 180);
        const gridX = unitX * range;
        const gridY = unitY * range;
        const canvasPos = this.gridToCanvas(gridX, gridY);

        az += step;

        if (i === 0) {
          ctx.moveTo(canvasPos.x, canvasPos.y);
        } else {
          ctx.lineTo(canvasPos.x, canvasPos.y);
        }
      }

      ctx.closePath();

      ctx.fillStyle = 'rgba(99, 99, 99, 0.14)';
      ctx.strokeStyle = '#8f8f8f23';
      ctx.lineWidth = 2;
      ctx.fill();
      ctx.stroke();


    } catch(e){
      console.error("Error drawing range profile:", e);
      console.log("Range data:", this.rangeData);
    }


    ctx.stroke();
  }

  resizeCanvas() {
    const container = this.canvas.parentElement;
    // Get the actual rendered size of the container
    const rect = container.getBoundingClientRect();
    
    // Enforce 16:9 aspect ratio
    const containerWidth = rect.width;
    const containerHeight = rect.height;
    const targetHeight = containerWidth / this.ASPECT_RATIO;
    
    // Use the constrained dimensions
    let canvasWidth = containerWidth;
    let canvasHeight = targetHeight;
    
    // If target height exceeds container height, scale down width instead
    if (targetHeight > containerHeight) {
      canvasHeight = containerHeight;
      canvasWidth = containerHeight * this.ASPECT_RATIO;
    }
    
    // Set canvas internal resolution to match 16:9 aspect ratio
    this.canvas.width = canvasWidth;
    this.canvas.height = canvasHeight;
    
    this.render();
  }


 setScenario(scenario) {
    this.scenario = scenario;
    this.precipitationImage = null;
    
    // Load precipitation field image if available
    if (scenario.precipitationFieldImage) {
       this.loadPrecipitationImage(scenario.precipitationFieldImage);
       this.render();
    } else {
      this.render();
    }
  }
  
  /**
   * Load precipitation field JPEG image
   * @param {string} filename - Base filename (without suffix)
   * @param {string} imageType - 'normal', 'overlay', or 'jet'
   */
  loadPrecipitationImage(filename, imageType = null) {
    if (imageType) {
      this.precipImageType = imageType;
    }
    
    // Get the base filename without extension and any existing suffix
    let baseName = filename.replace(/\.(jpg|jpeg|png)$/i, '');
    baseName = baseName.replace(/_(normal|overlay|jet)$/, '');
    
    // Construct filename with appropriate suffix
    let targetFilename;
    if (this.precipImageType === 'overlay') {
      targetFilename = this.scenario.precipitationFieldOverlay;
    } else if (this.precipImageType === 'jet') {
      targetFilename = this.scenario.precipitationFieldJet;
    } else {
      targetFilename = this.scenario.precipitationFieldImage;
    }
    
    const img = new Image();
    img.onload = () => {
      console.log('Precipitation image loaded:', targetFilename);
      this.precipitationImage = img;
      this.render();
    };
    img.onerror = () => {
      console.error('Failed to load precipitation image:', targetFilename);
      this.precipitationImage = null;
      this.render();
    };
    img.src = `/api/synthetic/precipitation/${targetFilename}`;
  }
  
  /**
   * Set precipitation image type and reload
   */
  setPrecipImageType(imageType) {
    if (!this.scenario || !this.scenario.precipitationFieldImage) return;
    this.precipImageType = imageType;
    this.loadPrecipitationImage(this.scenario.precipitationFieldImage, imageType);
  }

  setSAM(sam) {
    this.sam = sam;
    this.render();
  }

  setFighter(fighter) {
    this.fighter = fighter;
    this.render();
  }

  setResults(results) {
    this.results = results;
    this.render();
  }

  /**
   * Convert grid coordinates (km) to canvas pixels grid coordinates assume (0,0) is center of image
   */
  gridToCanvas(x, y) {
    if (!this.scenario) return { x: 0, y: 0 };
    
   
    const padding = 0;
    const availableWidth = this.canvas.width - 2 * padding;
    const availableHeight = this.canvas.height - 2 * padding;
    
    const scaleX = availableWidth / this.scenario.grid.width;
    const scaleY = availableHeight / this.scenario.grid.height;
    const scale = Math.min(scaleX, scaleY);

    const centerX = (this.scenario.grid.width / 2)*scale;
    const centerY = (this.scenario.grid.height / 2)*scale;

    let xs = x * scale;
    let ys = y * scale;
    
    return {
      x: (centerX + xs) + padding,
      y: (centerY - ys) + padding, // Flip Y axis
    };
  }

  /**
   * Convert km to canvas pixels (for distances)
   */
  kmToPixels(km) {
    if (!this.scenario) return 0;
    
    const padding = 0;
    const availableWidth = this.canvas.width - 2 * padding;
    const availableHeight = this.canvas.height - 2 * padding;
    
    const scaleX = availableWidth / this.scenario.grid.width;
    const scaleY = availableHeight / this.scenario.grid.height;
    const scale = Math.min(scaleX, scaleY);

    return km * scale;
  }

  /**
   * Convert canvas pixels to grid coordinates (km)
   * Inverse of gridToCanvas, accounting for zoom and pan
   */
  canvasToGrid(canvasX, canvasY) {
    //if (!this.scenario) return { x: 0, y: 0 };
    

    // Reverse zoom and pan transformations
    const x = (canvasX - this.panOffset.x) / this.currentZoom;
    const y = (canvasY - this.panOffset.y) / this.currentZoom;
    
    const padding = 0;
    const availableWidth = this.canvas.width - 2 * padding;
    const availableHeight = this.canvas.height - 2 * padding;
    
    const scaleX = availableWidth / this.scenario.grid.width;
    const scaleY = availableHeight / this.scenario.grid.height;
    const scale = Math.min(scaleX, scaleY);

    const centerX = (this.scenario.grid.width / 2) * scale;
    const centerY = (this.scenario.grid.height / 2) * scale;
    
    return {
      x: (x - padding - centerX) / scale,
      y: -(y - padding - centerY) / scale, // Flip Y axis back
    };
  }

  /**
   * Check if mouse click is on a fighter
   * Returns {fighter, index} or null
   */
  getFighterAtPosition(canvasX, canvasY) {
    if (!appState.simulationManager.state.fighters) return null;
    
    const fighters = appState.simulationManager.state.fighters;
    const clickRadius = 15; // pixels (in screen space)
    
    for (let i = 0; i < fighters.length; i++) {
      const fighter = fighters[i];
      const pos = this.gridToCanvas(fighter.position.x, fighter.position.y);
      
      // Apply zoom/pan transformation to fighter position to get screen coordinates
      const screenX = pos.x * this.currentZoom + this.panOffset.x;
      const screenY = pos.y * this.currentZoom + this.panOffset.y;

      
      // Calculate distance in screen space
      const dx = canvasX - screenX;
      const dy = canvasY - screenY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance <= clickRadius * this.currentZoom) {
        return { fighter, index: i};
      }
    }
    
    return null;
  }

  /**
   * Check if click is on heading knob
   */
  isClickOnHeadingKnob(canvasX, canvasY) {
    if (!this.selectedFighter) return false;
    
    const pos = this.gridToCanvas(this.selectedFighter.position.x, this.selectedFighter.position.y);
    
    // Apply zoom/pan transformation to get screen coordinates
    const screenX = pos.x * this.currentZoom + this.panOffset.x;
    const screenY = pos.y * this.currentZoom + this.panOffset.y;
    
    const knobRadius = 30 * this.currentZoom;
    const dx = canvasX - screenX;
    const dy = canvasY - screenY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    return distance >= knobRadius - 10 * this.currentZoom && distance <= knobRadius + 10 * this.currentZoom;
  }

  /**
   * Main render function
   */
  render() {
    const ctx = this.ctx;
    
    // Clear canvas
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);


    //2. Save the current default state
    ctx.save();

    //Apply zoom and pan transformations
    ctx.translate(this.panOffset.x, this.panOffset.y);
    ctx.scale(this.currentZoom, this.currentZoom);


    // Draw the scene
    
    if (!this.scenario) {
      this.renderEmptyState();
      return;
    }

    // Render precipitation field
    if (this.scenario.precipitationFieldImage || this.scenario.precipitationFieldOverlay) {
      this.renderPrecipitationImage();
    }

    // Render range rings
    this.renderRangeRings();
    
    // Render SAM (use simulation state if available, otherwise scenario config)
    if (appState.simulationManager.state.sams) {
      this.renderSAM();
    }
    
    // Render fighter (use simulation state if available, otherwise scenario config)
    if (appState.simulationManager.state.fighters) {
      this.renderFighter();
    }

    // Render missiles if simulation state has active missiles
    if (appState.simulationManager.state.missiles) {
      appState.simulationManager.state.missiles.forEach(missile => {
        if (missile.status === 'active' || missile.status === 'inflight') {
          this.renderMissile(missile);
        }
      });
    }
       
  
    this.renderRangeProfile();

    //3. Restore to default state
    ctx.restore();

    // Draw any UI overlays here (if needed)
  }


  applyZoomPanTransformations() {
    const ctx = this.ctx;

    this.imageBuffer = ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    // Clear canvas
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Save context state
    ctx.save();
    // Apply zoom and pan
    ctx.translate(this.panOffset.x, this.panOffset.y);
    ctx.scale(this.currentZoom, this.currentZoom);
    // Draw the image buffer
    ctx.putImageData(imageBuffer, 0, 0);
    // Restore context state
    ctx.restore();
  }



  renderSAM() {
    if (!appState.simulationManager.state.sams || appState.simulationManager.state.sams.length === 0) {
      console.warn('No SAMs found in scenario');
      return;
    }


    for (const sam of appState.simulationManager.state.sams) {
        // Use simulation state position if available, otherwise scenario initial position
        const position = sam.position;

        if (!position) {
          console.warn('SAM position not found in scenario');
          return;
        }

        const pos = this.gridToCanvas(
          position.x,
          position.y
        );
        const ctx = this.ctx;
        
        // SAM marker (red triangle)
        ctx.fillStyle = '#df2222ab';
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y - 10);
        ctx.lineTo(pos.x - 8, pos.y + 8);
        ctx.lineTo(pos.x + 8, pos.y + 8);
        ctx.closePath();
        ctx.fill();
        
        // Label  
        ctx.fillStyle = '#ff4444ab';
        ctx.font = '18px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('SAM', pos.x, pos.y + 25);
      }
   
  }

  renderEmptyState() {
    const ctx = this.ctx;
    ctx.fillStyle = '#50505051';
    ctx.font = '20px Sans-Serif';
    ctx.textAlign = 'center';
    ctx.fillText('Select a scenario to begin', this.canvas.width / 2, this.canvas.height / 2);
  }

  renderGrid() {
    const ctx = this.ctx;
    const gridStep = 10; // 10km grid
    
    ctx.strokeStyle = '#000000ff';
    ctx.lineWidth = 1;
    
    // Vertical lines
    for (let x = 0; x <= this.scenario.grid.width; x += gridStep) {
      const p1 = this.gridToCanvas(x, 0);
      const p2 = this.gridToCanvas(x, this.scenario.grid.height);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }
    
    // Horizontal lines
    for (let y = 0; y <= this.scenario.grid.height; y += gridStep) {
      const p1 = this.gridToCanvas(0, y);
      const p2 = this.gridToCanvas(this.scenario.grid.width, y);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }
  }


  renderRangeRings(){
    const ctx = this.ctx;

    const ranges = [10, 20, 40, 80, 160, 320, 640]; // in km
    const firstSAM = appState.simulationManager.state.sams ? appState.simulationManager.state.sams[0] : null;
    const centerPosition = firstSAM ? firstSAM.position : this.scenario.platforms?.sam?.position;
    if (!centerPosition) return;

    const center = this.gridToCanvas(centerPosition.x, centerPosition.y);

    ctx.strokeStyle = 'rgba(100, 100, 100, 0.3)';
    ctx.lineWidth = 3;
    ctx.setLineDash([5, 5]);

    ranges.forEach((range) => {
      const radius = this.kmToPixels(range);
      ctx.beginPath();
      ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
      ctx.stroke();

      //Label range ring in km
      ctx.fillStyle = 'rgba(200, 200, 200, 0.15)';
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(`${range} km`, center.x, center.y - radius + 12);
    });

    ctx.setLineDash([]);


  }



  /**
   * Render precipitation field image as background
   * Image luminance represents rain rate (0-100 mm/hr)
   */
  renderPrecipitationImage() {
    if (!this.precipitationImage){
      console.warn('No precipitation image loaded');
      return;
    }
    
    const ctx = this.ctx;
    const padding = 0;
    const availableWidth = this.canvas.width - 2 * padding;
    const availableHeight = this.canvas.height - 2 * padding;
    
    const scaleX = availableWidth / this.scenario.grid.width;
    const scaleY = availableHeight / this.scenario.grid.height;
    const scale = Math.min(scaleX, scaleY);
    
    const renderWidth = this.scenario.grid.width * scale;
    const renderHeight = this.scenario.grid.height * scale;
    
    // Save context state
    ctx.save();
    
    // Apply transparency for overlay effect
    ctx.globalAlpha = 0.5;
    
    // Draw image (flipped vertically to match coordinate system)
    ctx.translate(padding, this.canvas.height - padding);
    ctx.scale(1, -1);
    ctx.drawImage(this.precipitationImage, 0, 0, renderWidth, renderHeight);
    
    // Restore context state
    ctx.restore();
  }


  worldToImageCoordinates(position, scenario) {
    // Convert world coordinates (km) to image pixel coordinates
    let originX = 0;
    let originY = 0;
    if (scenario.grid.origin) {
      originX = scenario.grid.origin.x;
      originY = scenario.grid.origin.y;
    }
    const resolution = scenario.grid.resolution; // pixels per km
    const width = scenario.grid.width * scenario.grid.resolution;
    const height = scenario.grid.height * scenario.grid.resolution;
    //Image coordinates are top-left origin - transform accordingly
    const centerPixelCoordinate = {x: Math.floor(width/2)*resolution, y: Math.floor(height/2)*resolution};
    const centerWorldCoordinate = {x: originX, y: originY};
    let ix = centerPixelCoordinate.x + Math.floor((position.x - originX) * resolution);
    let iy = centerPixelCoordinate.y + Math.floor((position.y - originY) * resolution);

    if (ix < 0 || ix >= width || iy < 0 || iy >= height) {
      console.warn(`Position (${position.x}, ${position.y}) maps outside image bounds to (${ix}, ${iy})`);
    }
    return { x: ix, y: iy };
  }

  renderFighter() {
    if (!appState.simulationManager.state.fighters) {
      console.warn('Fighter position not found in scenario');
      return;
    }

    for(let i = 0; i < appState.simulationManager.state.fighters.length; i++) {
        const fighter = appState.simulationManager.state.fighters[i];
        const isSelected = this.selectedFighterIndex === i;
        let position = fighter.position;
        let headingDegrees = fighter.heading * 180 / Math.PI;
        let heading = fighter.heading;
        if(isSelected){
          position = this.selectedFighter.position;
          headingDegrees = this.selectedFighter.heading * 180 / Math.PI;
          heading = this.selectedFighter.heading;
        }

    
     

        if (!position) {
          console.warn('Fighter position not found in scenario');
          return;
        } 

        
        const pos = this.gridToCanvas(position.x, position.y);
        const ctx = this.ctx;

        //Notes: Later draw SVG depending on fighter state (normal, launching HARM, damaged, etc)
        
        // Fighter marker (blue circle) - highlight if selected
        ctx.fillStyle = isSelected ? '#3a7ae0' : '#195abbd4';
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, isSelected ? 14 : 12, 0, Math.PI * 2);
        ctx.fill();
        
        // Add selection ring if selected
        if (isSelected) {
          ctx.strokeStyle = '#3a7ae0';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, 18, 0, Math.PI * 2);
          ctx.stroke();
        }
        
        // Draw heading indicator (heading is in radians)
        // Canvas Y increases downward, so negate sin to match standard coordinate system
        const indicatorLength = 20;
        ctx.strokeStyle = isSelected ? '#ffffff' : '#aaaaaa';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
        ctx.lineTo(
          pos.x + Math.cos(heading) * indicatorLength,
          pos.y - Math.sin(heading) * indicatorLength
        );
        ctx.stroke();
        
        // Label
        ctx.fillStyle = isSelected ? '#ffffff' : '#214f94ff';
        ctx.font = '12px Sans-Serif';
        ctx.textAlign = 'center';
        ctx.fillText('Fighter', pos.x, pos.y + 30);
        
        // Render heading control knob if selected
        if (isSelected && this.interactionMode === 'edit') {
          this.renderHeadingKnob(pos.x, pos.y, headingDegrees);
        }
    }
    

  }

  /**
   * Render heading control knob for selected fighter
   * @param {number} headingDegrees - Heading in degrees for display
   */
  renderHeadingKnob(centerX, centerY, headingDegrees) {
    const ctx = this.ctx;
    const knobRadius = 30;
    
    // Draw control circle
    ctx.strokeStyle = '#3a7ae0';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.arc(centerX, centerY, knobRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // Draw heading handle (convert degrees to radians)
    // Canvas Y increases downward, so negate sin to match standard coordinate system
    const headingRadians = headingDegrees * Math.PI / 180;
    const handleX = centerX + Math.cos(headingRadians) * knobRadius;
    const handleY = centerY - Math.sin(headingRadians) * knobRadius;
    
    ctx.fillStyle = '#3a7ae0';
    ctx.beginPath();
    ctx.arc(handleX, handleY, 6, 0, Math.PI * 2);
    ctx.fill();
    
    // Draw heading value
    ctx.fillStyle = '#ffffff';
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.round(headingDegrees)}°`, centerX, centerY - knobRadius - 10);
  }

  renderMissile(missile) {
    const pos = this.gridToCanvas(missile.position.x, missile.position.y);
    const ctx = this.ctx;
    
    // Determine color based on missile type
    const color = missile.launchedBy === 'sam' ? '#c88964d6' : '#0da9e2d8'; // Red for SAM, green for HARM
    
    // Draw missile as small diamond
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y - 5);
    ctx.lineTo(pos.x + 5, pos.y);
    ctx.lineTo(pos.x, pos.y + 5);
    ctx.lineTo(pos.x - 5, pos.y);
    ctx.closePath();
    ctx.fill();
    
    // Draw velocity vector (direction indicator)
    const speed = Math.sqrt(missile.velocity.x ** 2 + missile.velocity.y ** 2);
    if (speed > 0) {
      const dirX = missile.velocity.x / speed;
      const dirY = missile.velocity.y / speed;
      const vectorLength = 15;
      
      // Convert velocity vector to canvas coordinates
      const endPos = this.gridToCanvas(
        missile.position.x + dirX * 0.5, // Small offset for arrow
        missile.position.y + dirY * 0.5
      );
      
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
      ctx.lineTo(endPos.x, endPos.y);
      ctx.stroke();
    }
  }

  renderRanges() {
   
    // Render ranges for the first SAM only for now
    if (!appState.simulationManager.state.sams || appState.simulationManager.state.sams.length === 0) {
      console.warn('No SAMs found in scenario for range rendering');
      return;
    }
    
    const samState = appState.simulationManager.state.sams[0]; 
    const samPos = this.gridToCanvas(
      samState.position.x,
      samState.position.y
    );
    const ctx = this.ctx;
    
    // MEMR circle (red, semi-transparent)
    if (samState.memr) {
      const memrRadius = this.kmToPixels(this.sam.memr);
      ctx.strokeStyle = 'rgba(255, 100, 100, 0.6)';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.arc(samPos.x, samPos.y, memrRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      
      ctx.fillStyle = 'rgba(255, 100, 100, 0.24)';
      ctx.fill();
    }
  }
}

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
    this.simulationState = null; // Runtime simulation state
    this.rangeData = null;
    this.currentZoom = 1.0;
    this.panOffset = { x: 0, y: 0 };
    this.maxZoom = 5.0;
    
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
    this.render();
    // Implementation of range profile rendering goes here
  }

  renderRangeProfile(){
    if (!this.rangeData) return;

    const ctx = this.ctx;
    // Example: Draw range profile as a simple line graph at the bottom of the canvas
    const padding = 20;
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


  setScenarioData(state) {
    this.simulationState = state;
    this.render();
  }

 setScenario(scenario) {
    this.scenario = scenario;
    this.precipitationImage = null;
    
    // Load precipitation field image if available
    if (scenario.precipitationFieldImage) {
       this.loadPrecipitationImage(scenario.precipitationFieldImage);
    } else {
      this.render();
    }
  }
  
  /**
   * Load precipitation field JPEG image
   */
  loadPrecipitationImage(filename) {
    console.log('Loading precipitation image:', filename);
    const img = new Image();
    img.onload = () => {
      console.log('Precipitation image loaded:', filename);
      this.precipitationImage = img;
      this.render();
    };
    img.onerror = () => {
      console.error('Failed to load precipitation image:', filename);
      this.precipitationImage = null;
      this.render();
    };
    img.src = `/api/synthetic/precipitation/${filename}`;
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

  setSimulationState(state) {
    this.simulationState = state;
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
    if (this.scenario.precipitationField || this.scenario.precipitationFieldOverlay) {
      this.renderPrecipitationImage();
    }

    // Render range rings
    this.renderRangeRings();
    
    // Render SAM (use simulation state if available, otherwise scenario config)
    if (this.scenario.platforms?.sam) {
      this.renderSAM();
    }
    
    // Render fighter (use simulation state if available, otherwise scenario config)
    if (this.scenario.platforms?.fighter) {
      this.renderFighter();
    }

    // Render missiles if simulation state has active missiles
    if (this.simulationState?.missiles) {
      this.simulationState.missiles.forEach(missile => {
        if (missile.status === 'inflight') {
          this.renderMissile(missile);
        }
      });
    }
    
    // Render ranges if results available
    if (this.results && this.sam) {
      this.renderRanges();
    }
    
  
    this.renderRangeProfile();

    //3. Restore to default state
    ctx.restore();

    // Draw overlay elements
  
    this.renderTelemetry();
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
    if (!this.scenario.platforms?.sam?.position) {
      console.warn('SAM position not found in scenario');
      return;
    }
    // Use simulation state position if available, otherwise scenario initial position
    const position = this.simulationState?.sam?.position || this.scenario.platforms.sam.position;
    const heading = this.simulationState?.sam?.heading || this.scenario.platforms.sam.heading || 0;
    
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

    const centerPosition = this.scenario.platforms?.sam?.position;
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
    if (!this.scenario.platforms?.fighter?.position) {
      console.warn('Fighter position not found in scenario');
      return;
    }
    
    // Use simulation state position if available, otherwise scenario initial position
    const position = this.simulationState?.fighter?.position || this.scenario.platforms.fighter.position;
    const heading = this.simulationState?.fighter?.heading || this.scenario.platforms.fighter.heading || 0;
    
    const pos = this.gridToCanvas(position.x, position.y);
    const ctx = this.ctx;
    
    // Fighter marker (blue circle)
    ctx.fillStyle = '#1d375dc1';
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 8, 0, Math.PI * 2);
    ctx.fill();
    
    // Label
    ctx.fillStyle = '#1d375dbc';
    ctx.font = '12px Sans-Serif';
    ctx.textAlign = 'center';
    ctx.fillText('Fighter', pos.x, pos.y + 25);
  }

  renderMissile(missile) {
    const pos = this.gridToCanvas(missile.position.x, missile.position.y);
    const ctx = this.ctx;
    
    // Determine color based on missile type
    const color = missile.type === 'SAM' ? '#88ffd9a9' : '#88ff88b6'; // Red for SAM, green for HARM
    
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
    if (!this.scenario.platforms?.sam?.position) {
      return;
    }
    
    const samPos = this.gridToCanvas(
      this.scenario.platforms.sam.position.x,
      this.scenario.platforms.sam.position.y
    );
    const ctx = this.ctx;
    
    // Detection range (yellow, semi-transparent)
    if (this.results.detectionRange) {
      const detectionRadius = this.kmToPixels(this.results.detectionRange);
      ctx.strokeStyle = 'rgba(255, 255, 100, 0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(samPos.x, samPos.y, detectionRadius, 0, Math.PI * 2);
      ctx.stroke();
      
      ctx.fillStyle = 'rgba(255, 255, 100, 0.1)';
      ctx.fill();
    }
    
    // MEMR circle (red, semi-transparent)
    if (this.sam.memr) {
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

  renderTelemetry() {
    if (!this.scenario) return;
    
    const ctx = this.ctx;
    const padding = 10;
    const lineHeight = 18;
    const boxWidth = 280;
    const x = this.canvas.width - boxWidth - padding;
    let y = this.canvas.height - padding;
    
    // Collect telemetry data
    const data = [];
    let scenarioName = this.scenario.name.length > 25 ? this.scenario.name.substring(0, 22) + '...' : this.scenario.name;
    
    // Scenario info
    data.push(`SCENARIO: ${scenarioName}`);
    data.push(`Grid: ${this.scenario.grid.width}×${this.scenario.grid.height} km`);
    
    // Simulation time
    if (this.simulationState) {
      data.push(`Time: ${this.simulationState.timeElapsed.toFixed(1)}s`);
    }
    
    // SAM info
    if (this.scenario.platforms?.sam) {
      let sam = this.scenario.platforms.sam;
      let samState = this.simulationState?.sam;

      //truncate the sam name to 25 characters if more than 25 add ...
      let samName = sam.configId.length > 20 ? sam.configId.substring(0, 22) + '...' : sam.configId;
      
      data.push(`SAM: ${samName}`);
      if (samState) {
        data.push(`  Pos: (${samState.position.x.toFixed(1)}, ${samState.position.y.toFixed(1)}) km`);
        data.push(`  Status: ${samState.status}`);
      } else {
        data.push(`  Pos: (${sam.position.x}, ${sam.position.y}) km`);
      }
      if (this.sam?.memr) {
        data.push(`  MEMR: ${this.sam.memr} km`);
      }
    }
    
    // Fighter info
    if (this.scenario.platforms?.fighter) {
      const fighter = this.scenario.platforms.fighter;
      const fighterState = this.simulationState?.fighter;
      
      data.push(`Fighter: ${fighter.configId}`);
      if (fighterState) {
        data.push(`  Pos: (${fighterState.position.x.toFixed(1)}, ${fighterState.position.y.toFixed(1)}) km`);
        data.push(`  Vel: ${(Math.sqrt(fighterState.velocity.x**2 + fighterState.velocity.y**2) * 3600).toFixed(0)} km/h`);
        data.push(`  Status: ${fighterState.status}`);
      } else {
        data.push(`  Pos: (${fighter.position.x}, ${fighter.position.y}) km`);
      }
      data.push(`  Path: ${fighter.flightPath?.type || 'N/A'}`);
    }
    
    // Missiles info
    if (this.simulationState?.missiles && this.simulationState.missiles.length > 0) {
      const inflightMissiles = this.simulationState.missiles.filter(m => m.status === 'inflight');
      if (inflightMissiles.length > 0) {
        data.push(`Missiles: ${inflightMissiles.length} inflight`);
        inflightMissiles.forEach(missile => {
          const tof = (this.simulationState.timeElapsed - missile.launchTime).toFixed(1);
          data.push(`  ${missile.type} (t=${tof}s)`);
        });
      }
    }
    
    // Environment info
    if (this.scenario.environment?.precipitation?.enabled) {
      const precip = this.scenario.environment.precipitation;
      data.push(`Precipitation: ENABLED`);
      data.push(`  Rate: ${precip.nominalRainRate} mm/hr`);
      data.push(`  Cell Size: ${precip.nominalCellSize} km`);
    } else {
      data.push(`Precipitation: CLEAR`);
    }
    
    // Calculate box height
    const boxHeight = data.length * lineHeight + padding * 2;
    y = y - boxHeight;
    
    // Draw semi-transparent background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(x, y, boxWidth, boxHeight);
    
    // Draw border
    ctx.strokeStyle = 'rgba(100, 100, 100, 0.8)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, boxWidth, boxHeight);
    
    // Draw telemetry text
    ctx.fillStyle = '#6e7579ff';
    ctx.font = '11px "Calibri", monospace';
    ctx.textAlign = 'left';
    
    data.forEach((line, i) => {
      ctx.fillText(line, x + padding, y + padding + (i + 1) * lineHeight);
    });
  }
}

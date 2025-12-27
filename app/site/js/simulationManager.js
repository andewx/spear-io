/**
 * Simulation Manager
 * Handles simulation lifecycle, stepping, and visualization updates
 */

class SimulationManager {
  constructor() {
    this.simulationKey = null;
    this.scenarioId = null;
    this.scenario = null;
    this.isRunning = false;
    this.isPaused = false;
    this.stepInterval = null;
    this.autoStepDelay = 100; // ms between auto steps
    this.visualization = null;
    this.state = null;
  }

  /**
   * Initialize simulation with a scenario
   */
  async initialize(scenario, visualization) {
    try {
      this.scenario = scenario;
      this.scenarioId = scenario.id;
      this.visualization = visualization;

      // Initialize simulation on backend
      const result = await simulationAPI.init(this.scenarioId);
      this.simulationKey = result.simulationKey;

      // Get initial state
      const state = await simulationAPI.getState();
      this.state = state;

      console.log('[Simulation] Initial state:', state);
      
      // Update visualization
      if (this.visualization) {
        await this.visualization.setScenario(this.scenario)
        await this.visualization.updateRangeProfile(await simulationAPI.getRanges());
        this.visualization.render();
      }

      console.log('[Simulation] Initialized:', { scenarioId: this.scenarioId, simulationKey: this.simulationKey });
      return state;
    } catch (error) {
      console.error('[Simulation] Initialization failed:', error);
      throw error;
    }
  }



  /**
   * Step simulation forward by one time step
   */
  async step() {
    if (!this.simulationKey) {
      console.warn('[Simulation] Not initialized');
      return null;
    }

    try {
      const response = await simulationAPI.step(this.simulationKey);
      const {state } = response;
      this.state = state;

        // Update visualization
        if (this.visualization) {
            this.visualization.render();
        }
  
      // Stop auto-stepping if complete
      if (state.isComplete) {
        this.stop();
        console.log('[Simulation] Complete at t =', state.timeElapsed, 's');
      }

      return response;
    } catch (error) {
      console.error('[Simulation] Step failed:', error);
      this.stop();
      throw error;
    }
  }

  /**
   * Start auto-stepping simulation
   */
  start() {
    if (this.isRunning) return;

    this.isRunning = true;
    this.isPaused = false;

    this.stepInterval = setInterval(async () => {
      if (!this.isPaused) {
        await this.step();
      }
    }, this.autoStepDelay);

    console.log('[Simulation] Started auto-stepping');
  }

  /**
   * Pause simulation (can be resumed)
   */
  pause() {
    this.isPaused = true;
    console.log('[Simulation] Paused');
  }

  /**
   * Resume paused simulation
   */
  resume() {
    if (!this.isRunning) {
      this.start();
    } else {
      this.isPaused = false;
      console.log('[Simulation] Resumed');
    }
  }

  /**
   * Stop simulation completely
   */
  stop() {
    if (this.stepInterval) {
      clearInterval(this.stepInterval);
      this.stepInterval = null;
    }
    this.isRunning = false;
    this.isPaused = false;
    displaySimulationResults(this.state);
    console.log('[Simulation] Stopped');
  }

  /**
   * Reset simulation to initial state
   */
  async reset() {
    try {
      this.stop();
      await simulationAPI.reset();
      
      // Get reset state
      const state = await simulationAPI.getState();
        this.state = state;

      // Update visualization
      if (this.visualization)   
      this.visualization.render();
      

      console.log('[Simulation] Reset');
      return state;
    } catch (error) {
      console.error('[Simulation] Reset failed:', error);
      throw error;
    }
  }

  /**
   * Run simulation to completion (fast forward)
   */
  async runToCompletion() {
    if (!this.simulationKey) {
      console.warn('[Simulation] Not initialized');
      return null;
    }

    this.setStepDelay(0.5); // Disable auto-stepping

    try {
      this.stop(); // Stop any auto-stepping
      this.isRunning = true;
      this.isPaused = false;

      //const response = await simulationAPI.run(this.simulationKey);
      while (this.isRunning && !this.isPaused) {
        await this.step();
        await new Promise(resolve => setTimeout(resolve, 50));
        
      }


    displaySimulationResults(this.state);
    console.log('[Simulation] Run to completion finished');

    } catch (error) {
      console.error('[Simulation] Run to completion failed:', error);
      throw error;
    }
  }

  /**
   * Set auto-step delay (ms)
   */
  setStepDelay(delay) {
    this.autoStepDelay = delay;
    
    // Restart interval if running
    if (this.isRunning) {
      this.stop();
      this.start();
    }
  }

  /**
   * Get current simulation key
   */
  getSimulationKey() {
    return this.simulationKey;
  }

  /**
   * Check if simulation is running
   */
  isSimulationRunning() {
    return this.isRunning;
  }
}

// Export singleton instance
window.simulationManager = new SimulationManager();

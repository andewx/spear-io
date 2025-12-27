/**
 * Simulation Controller
 * Handles engagement simulation execution
 */

import type { Request, Response } from 'express';
import * as storage from '../services/fileStorage.js';
import { Radar } from '../scenario/Radar.js';
import { SAMSystem } from '../scenario/SAMSystem.js';
import { Fighter } from '../scenario/Fighter.js';
import { getAspectRCS } from '../services/radarCalculations.js';
import { calculatePathAttenuation } from '../scenario/PathAttenuation.js';
import * as itu from '../services/ituData.js';
import type { TAPIResponse, IEngagementResult, IScenario, IPosition2D } from '../types/index.js';
import { Scenario } from '../scenario/index.js';
import { randomUUID } from 'crypto';


export class SimulationController {
  /**
   * Constructor for SimulationController
   * Scenario-specific objects (Radar, SAMSystem, Fighter) in this instance
   * are permitted to hold state during a single simulation run. We therefore
   * lock operation to a single user with a simulationKey for the session.
   */

  private simulationKey: string;
  private keyLocked: boolean = false;
  private scenarioMeta: IScenario;
  private scenario: Scenario;
  private timeStep: number = 0.5; // default time step in seconds
  private timeElapsed: number = 0;
  
  constructor() {

    //generate random UUID for simulation session
    this.simulationKey = randomUUID();

  }

  /*
    * Initialize simulation with scenario ID passes simulationKey ID if not locked
    * simulation SAM site is initialized with precipitation attenuated ranges if precip enabled
    * POST /api/simulation/initialize
    * Body: { simulationKey : string }
    * 
  */
  async initialize(req: Request, res: Response): Promise<void> {

    //parse scenarioId from request body
    const { scenarioId, timeStep } = req.body as {
      scenarioId: string;
      timeStep?: number;  
    };

    this.scenarioMeta = await storage.loadScenario(scenarioId);
    if (!this.scenarioMeta) {
      res.status(404).json({ error: `Scenario not found: ${scenarioId}` });
      return;
    }

    // Get the platform objects for each SAM and Fighter in the scenario
    for(const samPlatform of this.scenarioMeta.platforms.sams.filter(p => p.type === 'sam')){
      const platformData = await storage.loadSAMPlatform(samPlatform.id);
      if (!platformData) {
        res.status(404).json({ error: `SAM Platform not found: ${samPlatform.type}/${samPlatform.id}` });
        return;
      }
      samPlatform.platform = platformData;
    }
    for(const fighterPlatform of this.scenarioMeta.platforms.fighters.filter(p => p.type === 'fighter')){
      const platformData = await storage.loadFighterPlatform(fighterPlatform.id);
      if (!platformData) {
        res.status(404).json({ error: `Fighter Platform not found: ${fighterPlatform.type}/${fighterPlatform.id}` });
        return;
      }
      fighterPlatform.platform = platformData;
    }


    this.scenario = await Scenario.create(this.scenarioMeta, 0.5); // default timeStep 0.5s

    //return JSON response
    const response: TAPIResponse<{ simulationKey: string }> = {
      success: true,
      data: { simulationKey: this.simulationKey },
    };
    res.json(response);
  }
  /**
   * POST /api/simulation/run -- applies full engagement simulation without discrete time step requests
   * Execute engagement simulation
   */
  async run(req: Request, res: Response): Promise<void> {
    try{


      //Get simulation key for validation
      const { simulationKey } = req.body as { simulationKey: string };

      if (simulationKey !== this.simulationKey) {
        const response: TAPIResponse<never> = {
          success: false,
          error: 'Invalid simulation key',
        };
        res.status(403).json(response);
        return;
      }
    
      while(!this.scenario.engagementComplete()){
        this.scenario.advanceSimulationTimeStep();
      }

      const result = this.getSimulationState();
      const response: TAPIResponse<{state: any}> = {
        success: true,
        data: {state: result},
      };
      res.json(response);
    } catch (error) {
      this.handleError(res, error);
      const response: TAPIResponse<never> = {
        success: false,
        error: 'Error running simulation',
      };
      res.status(500).json(response);
    }
  }

  /**
   * POST /api/simulation/step
   * Advance simulation by one time step and return current state
   */
  async step(req: Request, res: Response): Promise<void> {
    try {
      const { simulationKey } = req.body as { simulationKey: string };

      if (simulationKey !== this.simulationKey) {
        const response: TAPIResponse<never> = {
          success: false,
          error: 'Invalid simulation key',
        };
        res.status(403).json(response);
        return;
      }

      // Advance simulation by one time step
      const simulationComplete = this.scenario.advanceSimulationTimeStep();

      // Get current state for visualization
      const state = this.getSimulationState();

      const response: TAPIResponse<{
        state: any;
      }> = {
        success: true,
        data: {
          state: state,
        },
      };
      res.json(response);
    } catch (error) {
      this.handleError(res, error);
      const response: TAPIResponse<never> = {
        success: false,
        error: 'Error advancing simulation step',
      };
      res.status(500).json(response);
    }
  }

  /**
   * GET /api/simulation/state
   * Get current simulation state without advancing time step
   */
  async getState(req: Request, res: Response): Promise<void> {
    try {
      const state = this.getSimulationState();
      
      const response: TAPIResponse<any> = {
        success: true,
        data: state,
      };
      res.json(response);
    } catch (error) {
      this.handleError(res, error);
      const response: TAPIResponse<never> = {
        success: false,
        error: 'Error retrieving simulation state',
      };
      res.status(500).json(response);
    }
  }

  /**
   * Extract current simulation state for visualization
   */
  private getSimulationState() {
    // For now, use first SAM and first fighter (multi-platform visualization to be implemented later)
    const firstSAM = this.scenario.scenarioSams[0];
    const firstFighter = this.scenario.scenarioFighters[0];


    // Create copies of positions to avoid reference sharing
    const samPos = { x: firstSAM.position.x, y: firstSAM.position.y };
    const fighterPos = { x: firstFighter.position.x, y: firstFighter.position.y };
    
    // Calculate distance
    const dx = fighterPos.x - samPos.x;
    const dy = fighterPos.y - samPos.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Get detection range at fighter's current position/azimuth
    const azimuth = this.calculateAzimuth(samPos, fighterPos);
    const fighterRCS = firstFighter.getRCSFromPosition(fighterPos, samPos, azimuth);
    
    // Use typical burst size for pulse integration (10 pulses)
    const numPulses = 10;
    
    // TODO: Implement getRangeAtAzimuth for multi-platform scenarios
    const detectionRange = firstSAM.calculateDetectionRange(
      fighterRCS,
      numPulses,
      firstSAM.range
    );

    // Get missile states - create copies of all position objects
    const missiles = this.scenario.getMissiles().map((missile, index) => ({
      id: missile.launchedBy === 'sam' ? `SAM-${missile.timeOfLaunch}` : `HARM-${missile.timeOfLaunch}`,
      launchedBy: missile.launchedBy,
      launchTime: missile.timeOfLaunch,
      position: { x: missile.position.x, y: missile.position.y },
      heading: missile.heading,
      velocity: missile.velocity,
      status: missile.status,
      targetPosition: { x: missile.target.position.x, y: missile.target.position.y },
    }));

    return {
      timeElapsed: this.scenario.getTimeElapsed(),
      scenario: {
        id: this.scenario.id,
        name: this.scenarioMeta.name,
        bounds: {
          minX: -this.scenarioMeta.grid.width / 2,
          maxX: this.scenarioMeta.grid.width / 2,
          minY: -this.scenarioMeta.grid.height / 2,
          maxY: this.scenarioMeta.grid.height / 2,
        },
      },
      sams:this.scenario.scenarioSams.map(sam => ({
        id: sam.id,
        position: { x: sam.position.x, y: sam.position.y },
        memr: sam.properties.memr,
        state: sam.state,
      })),
      fighters:this.scenario.scenarioFighters.map(fighter => ({
        id: fighter.id,
        position: { x: fighter.position.x, y: fighter.position.y },
        heading: fighter.heading,
        velocity: fighter.velocity,
        state: fighter.state,
      })),
      missiles,
      distance,
      detectionRange,
      isComplete: this.scenario.engagementComplete(),
    };
  }

  /**
   * Calculate azimuth from SAM to Fighter
   */
  private calculateAzimuth(from: IPosition2D, to: IPosition2D): number {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const azimuth = Math.atan2(dy, dx) * (180 / Math.PI);
    return azimuth < 0 ? azimuth + 360 : azimuth;
  }

  async reset(req: Request, res: Response): Promise<void> {
    try {
      this.scenarioMeta = await storage.loadScenario(this.scenarioMeta.id);
      if (!this.scenarioMeta) {
        res.status(404).json({ error: `Scenario not found: ${this.scenarioMeta.id}` });
        return;
      }
      this.scenario = await Scenario.create(this.scenarioMeta, 0.5); // default timeStep 0.5s
      const response: TAPIResponse<{ message: string }> = {
        success: true,
        data: { message: 'Simulation reset successfully' },
      };
      res.json(response);
    } catch (error) {
      this.handleError(res, error);
      const response: TAPIResponse<never> = {
        success: false,
        error: 'Error resetting simulation',
      };
      res.status(500).json(response);
    }
  }


  async getRangesProfile(req: Request, res: Response): Promise<void> {
    try {
      // TODO: Implement getPrecipitationRanges logic for multi-platform scenarios
      // For now, return first SAM's precipitation ranges
      const firstSAM = this.scenario.scenarioSams[0];
      if (!firstSAM) {
        throw new Error('No SAM system found in scenario');
      }

      const numPulses = 10; // Typical burst size for pulse integration

      await firstSAM.getPrecipitationRanges(numPulses);
      const ranges = firstSAM.ranges;
      const response: TAPIResponse<{ranges:Array<number>}> = {
        success: true,
        data: {ranges: ranges},
      };
      res.json(response);
    } catch (error) {
      this.handleError(res, error);
      console.error('Error getting SAM scenario ranges profile:', error);
      const response: TAPIResponse<never> = {
        success: false,
        error: 'Error retrieving SAM scenario ranges profile',
      };
      res.status(500).json(response);
    }
  }


  /**
   * Error handler
   */
  private handleError(res: Response, error: unknown): void {
    const response: TAPIResponse<never> = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    res.status(500).json(response);
  }
}

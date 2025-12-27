/**
 * Simulation Controller
 * Handles engagement simulation execution
 */
import type { Request, Response } from 'express';
export declare class SimulationController {
    /**
     * Constructor for SimulationController
     * Scenario-specific objects (Radar, SAMSystem, Fighter) in this instance
     * are permitted to hold state during a single simulation run. We therefore
     * lock operation to a single user with a simulationKey for the session.
     */
    private simulationKey;
    private keyLocked;
    private scenarioMeta;
    private scenario;
    private timeStep;
    private timeElapsed;
    constructor();
    initialize(req: Request, res: Response): Promise<void>;
    /**
     * POST /api/simulation/run -- applies full engagement simulation without discrete time step requests
     * Execute engagement simulation
     */
    run(req: Request, res: Response): Promise<void>;
    /**
     * POST /api/simulation/step
     * Advance simulation by one time step and return current state
     */
    step(req: Request, res: Response): Promise<void>;
    /**
     * GET /api/simulation/state
     * Get current simulation state without advancing time step
     */
    getState(req: Request, res: Response): Promise<void>;
    /**
     * Extract current simulation state for visualization
     */
    private getSimulationState;
    /**
     * Calculate azimuth from SAM to Fighter
     */
    private calculateAzimuth;
    reset(req: Request, res: Response): Promise<void>;
    getRangesProfile(req: Request, res: Response): Promise<void>;
    /**
     * Error handler
     */
    private handleError;
}
//# sourceMappingURL=SimulationController.d.ts.map
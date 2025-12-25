/**
 * Scenario environment
 * Defines simulation grid, platforms, and environmental conditions
 */
import { SAMSystem } from './SAMSystem.js';
import { Fighter } from './Fighter.js';
import { IScenario, IPosition2D, IEngagementResult, IScenarioPlatform } from '../types/index.js';
type TMissile = {
    position: IPosition2D;
    velocity: number;
    heading: number;
    status: 'active' | 'kill' | 'missed';
    launchedBy: 'sam' | 'fighter';
    timeOfLaunch: number;
    timeOfImpact: number;
    maxRange?: number;
    target: SAMSystem | Fighter;
};
export declare class Scenario {
    readonly id: string;
    readonly timeStep: number;
    timeElapsed: number;
    readonly scenario: IScenario;
    readonly sams: IScenarioPlatform[];
    readonly fighters: IScenarioPlatform[];
    private missiles;
    private isEngagementComplete;
    scenarioSams: SAMSystem[];
    scenarioFighters: Fighter[];
    /**
     * Private constructor - use static create() method instead
     * This enforces async initialization through the factory pattern
     */
    constructor(scenario: IScenario, sams: SAMSystem[], fighters: Fighter[], timeStep: number);
    /**
     * Static factory method for async initialization
     * Use this instead of constructor: const scenario = await Scenario.create(...)
     *
     * Supports both legacy single-platform format and new array format
     */
    static create(scenario: IScenario, timeStep?: number): Promise<Scenario>;
    engagementComplete(): boolean;
    updateSAMTrackingStatus(): void;
    SAMDetectionAndEngagementLogic(): void;
    fighterLaunchHARMLogic(): void;
    /**
     * Update missile tracking status and heading based on target tracking
     */
    private updateMissileTracking;
    /**
     * Update missile positions based on velocity and heading
     */
    private updateMissilePositions;
    /**
     * Update fighter evasive maneuvers (6G max)
     */
    private updateFighterManeuvers;
    /**
     * Update fighter positions based on velocity and heading
     */
    private updateFighterPositions;
    /**
     * Evaluate missile kill criteria and update status
     */
    private evaluateKillCriteria;
    /**
     * Check if simulation is complete
     */
    private checkSimulationComplete;
    /**
     * Advance scenario by time step and update platform states
     */
    advanceSimulationTimeStep(): boolean;
    resetScenario(): void;
    getTimeElapsed(): number;
    getMissiles(): Array<TMissile>;
    engagementResult(): IEngagementResult;
    wrapToPi(a: number): number;
    updateHeading(prev: number, current: number): number;
    /**
     * Apply RCS and Pulse Integration to array and return array
     * @param azimuthDeg
     * @param rcs
     * @returns
     */
    /**
     * Get fighter RCS as seen from SAM position
     */
    getFighterRCSFromSAM(fighter: Fighter, samSystem: SAMSystem): number;
    /**
     * Need to check between time steps if either missile intercepted its target
     * by raycast method
     */
    checkMissileIntercept(missile: TMissile, targetPos: IPosition2D, previousMissilePos: IPosition2D): boolean;
    /**
     * Get current scenario state snapshot
     */
    getState(): Promise<{
        sams: SAMSystem[];
        fighters: Fighter[];
        missiles: TMissile[];
        timeElapsed: number;
        isEngagementComplete: boolean;
    }>;
}
export {};
//# sourceMappingURL=Scenario.d.ts.map
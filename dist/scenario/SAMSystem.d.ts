/**
 * SAM System platform model
 * Represents a Surface-to-Air Missile system with radar and missile characteristics
 */
import { Radar } from './Radar.js';
import type { IScenario, ISAMSystem, IPosition2D } from '../types/index.js';
type SAMStatus = {
    missilesRemaining: number;
    launchedMissiles?: number;
    totalMissiles?: number;
    lastLaunchTime?: number;
};
type Track = {
    id: string;
    acquisitionTime: number;
    distance: number;
    azimuth: number;
    status: 'tracking' | 'not_tracking' | 'lost';
    timeElapsedTracking: number;
};
export declare class SAMSystem {
    readonly id: string;
    readonly name: string;
    readonly properties: ISAMSystem;
    trackedTargets: Map<string, Track>;
    readonly radar: Radar;
    state: 'active' | 'destroyed';
    readonly range: number;
    ranges: Array<number>;
    readonly numAzimuths = 360;
    private scenario;
    launchIntervalSec: number;
    position: IPosition2D;
    status: SAMStatus;
    constructor(platform: ISAMSystem, scenario: IScenario);
    getRangeAtAzimuth(azimuthDeg: number): number;
    getDetectionRanges(): Array<number>;
    getAzimuthToTarget(targetPosition: IPosition2D): number;
    getPrecipitationRanges(numPulses: number): Promise<void>;
    getMissileProperties(): {
        memr: number;
        velocity: number;
    };
    getTrackings(): Map<string, Track>;
    /**
     * Calculate detection range for a target with given RCS and path attenuation
     *
     * @param rcs - Target RCS (m²)
     * @param pulses - Number of integrated pulses
     * @param range - Base range to scale from
     * @returns Detection range (km)
     */
    calculateDetectionRange(rcs: number, pulses: number, range: number): number;
    /**
     * Calculate detection range with attenuation precipitation sampling method along azimuth
     * use radar.calculateDetectionRange(rcs, range) when applying a specific RCS
     *
     * @param scenario - Scenario with precipitation field
     * @param numPulses - Number of pulses to integrate (default 1)
     */
    calculateDetectionRangesWithSampling(scenario: IScenario, numPulses?: number): number;
    /**
     * Calculate time for missile to reach target
     *
     * @param distance - Distance to target (km)
     * @returns Flight time (seconds)
     */
    calculateMissileFlightTime(distance: number): number;
}
export {};
//# sourceMappingURL=SAMSystem.d.ts.map
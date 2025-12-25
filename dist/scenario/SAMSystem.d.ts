/**
 * SAM System platform model
 * Represents a Surface-to-Air Missile system with radar and missile characteristics
 */
import { Radar, TPulseIntegrationMode } from './Radar.js';
import type { IScenario, ISAMSystem, IPosition2D } from '../types/index.js';
type SAMStatus = {
    missilesRemaining: number;
    launchedMissiles?: number;
    totalMissiles?: number;
    lastLaunchTime?: number;
};
interface IPulseIntegrationMode {
    numPulses: number;
    mode: TPulseIntegrationMode;
}
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
    pulseMode: IPulseIntegrationMode;
    trackedTargets: Map<string, Track>;
    readonly radar: Radar;
    state: 'active' | 'destroyed';
    readonly trackingRadar: Radar;
    readonly missileVelocity: number;
    readonly nominalRange: number;
    readonly nominalRangesAzimuth: Array<number>;
    readonly precipRangesAzimuth: Array<number>;
    readonly numAzimuths = 216;
    launchIntervalSec: number;
    position: IPosition2D;
    status: SAMStatus;
    constructor(platform: ISAMSystem, scenario: IScenario);
    getRangeAtAzimuth(azimuthDeg: number): number;
    getDetectionRanges(): Array<number>;
    getAzimuthToTarget(targetPosition: IPosition2D): number;
    initPrecipitationField(scenario: IScenario): Promise<void>;
    getMissileProperties(): {
        memr: number;
        velocity: number;
    };
    getTrackings(): Map<string, Track>;
    /**
     * Calculate detection range for a target with given RCS and path attenuation
     *
     * @param rcs - Target RCS (m²)
     * @param pathAttenuationDb - Path attenuation (dB)
     * @returns Detection range (km)
     */
    calculateDetectionRange(rcs: number, pulses: number, range: number): number;
    calculateDetectionRanges(scenario: IScenario): number;
    /**
     * Calculate detection range with attenuation precipitation sampling method along azimuth
     * use radar.calculateDetectionRange(rcs, range) when applying a specific RCS
     */
    calculateDetectionRangesWithSampling(scenario: IScenario): number;
    /**
     * Get Ranges Azimuth Array for nominal range adjustment without RCS recalulation
     */
    getRangesAzimuth(): Array<number>;
    /**
     * Calculate time for missile to reach target
     *
     * @param distance - Distance to target (km)
     * @returns Flight time (seconds)
     */
    calculateMissileFlightTime(distance: number): number;
    /**
     * Calculate total kill time (acquisition + missile flight)
     *
     * @param distance - Distance to target (km)
     * @param autoAcquisition - Use automatic acquisition time
     * @returns Total kill time (seconds)
     */
    calculateKillTime(distance: number, autoAcquisition?: boolean): number;
    /**
     * Check if target is within MEMR
     */
    isWithinMEMR(distance: number): boolean;
}
export {};
//# sourceMappingURL=SAMSystem.d.ts.map
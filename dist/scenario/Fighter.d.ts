/**
 * Fighter platform model
 * Represents fighter aircraft with multi-aspect RCS and HARM capability
 */
import type { IFighterPlatform, IRCSProfile, IScenarioPlatform } from '../types/index.js';
import type { IPosition2D } from '../types/index.js';
export declare class Fighter {
    id: string;
    readonly type: IFighterPlatform['type'];
    position: IPosition2D;
    velocity: number;
    readonly rcs: IRCSProfile;
    readonly harmVelocity: number;
    readonly harmRange: number;
    readonly launchPreference: IFighterPlatform['harmParams']['launchPreference'];
    readonly memrRatio?: number;
    heading: number;
    launchedHARM: boolean;
    launchTime: number | null;
    missilesRemaining: number;
    state: 'active' | 'destroyed';
    maneuvers: 'none' | 'evasive';
    constructor(fighter: IScenarioPlatform, position: IPosition2D, heading: number);
    getHarmProperties(): {
        velocity: number;
        range: number;
        launchPreference: "maxRange" | "memrRatio";
        memrRatio: number;
    };
    launchHARM(currentTime: number): void;
    getVelocityKms(): number;
    getAzimuthToTarget(targetPos: IPosition2D): number;
    /**
     * Get RCS based on aspect angle from observer
     *
     * @param azimuthDeg - Azimuth angle from nose (degrees, 0 = nose-on, 180 = tail-on)
     * @returns RCS (m²)
     */
    getRCSAtAspect(azimuthDeg: number): number;
    getAzimuthFromSAM(samPosition: IPosition2D): number;
    /**
     * Get RCS from position relative to observer
     *
     * @param fighterPos - Fighter position {x, y}
     * @param observerPos - Observer position {x, y}
     * @param fighterHeadingDeg - Fighter heading in degrees (0 = +X axis)
     * @returns RCS (m²)
     */
    getRCSFromPosition(fighterPos: {
        x: number;
        y: number;
    }, observerPos: {
        x: number;
        y: number;
    }, fighterHeadingDeg: number): number;
    /**
     * Calculate HARM flight time
     *
     * @param distance - Distance to target (km)
     * @returns Flight time (seconds)
     */
    calculateHARMFlightTime(distance: number): number;
    /**
     * Determine if fighter should launch HARM based on strategy
     *
     * @param distanceToSAM - Current distance to SAM (km)
     * @param samMEMR - SAM's maximum effective missile range (km)
     * @returns True if should launch
     */
    shouldLaunchHARM(distanceToSAM: number, samMEMR: number, samTracking: boolean): boolean;
}
//# sourceMappingURL=Fighter.d.ts.map
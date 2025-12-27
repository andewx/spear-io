/**
 * Radar calculation utilities
 * Standard radar equation with RCS scaling and attenuation
 */
import type { ISAMSystem, IFighterPlatform, IPosition2D, IRadarModel } from '../types/index.js';
/**
 * Convert dB to linear power ratio
 */
export declare function dbToLinear(db: number): number;
/**
 * Convert linear power ratio to dB
 */
export declare function linearToDb(linear: number): number;
export declare function createRadar(sys: ISAMSystem, antenna_gain: number): IRadarModel;
/**
 * Calculate minimum required SNR for fluctuating targets
 *
 * @param pd - Probability of detection (0-1)
 * @param pfa - Probability of false alarm (0-1), typically 10^-6
 * @param swerlingCase - Swerling model:  0 (non-fluctuating), 1, 2, 3, or 4
 * @param nPulses - Number of integrated pulses (default 1)
 * @returns Required SNR in dB (per pulse)
 */
export declare function calculateMinSNRSwerling(pd: number, pfa?: number, swerlingCase?: 0 | 1 | 2 | 3 | 4, nPulses?: number): number;
/**
 * Apply attenuation loss to detection range
 * Attenuation reduces received power, which affects range by R ∝ P^0.25
 *
 * @param range - Original detection range (km)
 * @param attenuationDb - Path attenuation in dB
 * @returns Attenuated detection range (km)
 */
export declare function applyAttenuation(range: number, attenuationDb: number): number;
/**
 * Calculate distance between two 2D points
 */
export declare function calculateDistance(p1: IPosition2D, p2: IPosition2D): number;
/**
 * Calculate time for missile to reach target
 *
 * @param distance - Distance to target (km)
 * @param velocityMach - Missile velocity in Mach
 * @returns Time to target (seconds)
 */
export declare function calculateMissileFlightTime(distance: number, velocityMach: number): number;
/**
 * Determine if fighter is within SAM's vulnerability window
 * Fighter engages when approaching MEMR
 *
 * @param samToFighterDistance - Current distance from SAM to fighter (km)
 * @param memr - Maximum Effective Missile Range (km)
 * @param memrRatio - Engagement threshold as ratio of MEMR (0-1)
 * @returns True if within vulnerability window
 */
export declare function isInVulnerabilityWindow(samToFighterDistance: number, memr: number, memrRatio?: number): boolean;
/**
 * Get aspect-dependent RCS from fighter platform
 * Simplified aspect calculation based on position vector
 *
 * @param fighter - Fighter platform
 * @param samToFighterVector - Normalized vector from SAM to fighter
 * @returns RCS value (m²) for current aspect
 */
export declare function getAspectRCS(fighter: IFighterPlatform, samToFighterVector: {
    x: number;
    y: number;
}): number;
//# sourceMappingURL=radarCalculations.d.ts.map
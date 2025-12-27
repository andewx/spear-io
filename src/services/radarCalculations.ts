/**
 * Radar calculation utilities
 * Standard radar equation with RCS scaling and attenuation
 */

import type { ISAMSystem, IFighterPlatform, IPosition2D } from '../types/index.js';

/**
 * Convert dB to linear power ratio
 */
export function dbToLinear(db: number): number {
  return Math.pow(10, db / 10);
}

/**
 * Convert linear power ratio to dB
 */
export function linearToDb(linear: number): number {
  return 10 * Math.log10(linear);
}


// Given Radar's Nominal Range and Antenna Gain Determine Emitter Power and Form Correct IRadarSystem interface object
export function createRadar(range: number, antenna_gain:number){

}
/**
 * Calculate adjusted detection range based on RCS
 * Uses radar range equation: R1/R2 = (RCS2/RCS1)^0.25
 * 
 * @param nominalRange - Detection range for 1m² RCS target (km)
 * @param targetRCS - Target radar cross section (m²)
 * @returns Adjusted detection range (km)
 */
export function calculateDetectionRange(nominalRange: number, targetRCS: number): number {
  const rcsRatio = targetRCS / 1.0; // Nominal is 1m²
  return nominalRange * Math.pow(rcsRatio, 0.25);
}

/**
 * Apply attenuation loss to detection range
 * Attenuation reduces received power, which affects range by R ∝ P^0.25
 * 
 * @param range - Original detection range (km)
 * @param attenuationDb - Path attenuation in dB
 * @returns Attenuated detection range (km)
 */
export function applyAttenuation(range: number, attenuationDb: number): number {
  // Convert attenuation to power ratio
  const powerRatio = dbToLinear(-attenuationDb); // Negative because it's a loss
  
  // Range scales with power^0.25
  return range * Math.pow(powerRatio, 0.25);
}

/**
 * Calculate distance between two 2D points
 */
export function calculateDistance(p1: IPosition2D, p2: IPosition2D): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Calculate time for missile to reach target
 * 
 * @param distance - Distance to target (km)
 * @param velocityMach - Missile velocity in Mach
 * @returns Time to target (seconds)
 */
export function calculateMissileFlightTime(distance: number, velocityMach: number): number {
  const speedOfSound = 343; // m/s at sea level
  const velocityMs = velocityMach * speedOfSound;
  const velocityKmS = velocityMs / 1000;
  return distance / velocityKmS;
}

/**
 * Determine if fighter is within SAM's vulnerability window
 * Fighter engages when approaching MEMR
 * 
 * @param samToFighterDistance - Current distance from SAM to fighter (km)
 * @param memr - Maximum Effective Missile Range (km)
 * @param memrRatio - Engagement threshold as ratio of MEMR (0-1)
 * @returns True if within vulnerability window
 */
export function isInVulnerabilityWindow(
  samToFighterDistance: number,
  memr: number,
  memrRatio: number = 0.9
): boolean {
  return samToFighterDistance <= memr * memrRatio;
}

/**
 * Calculate engagement result for SAM vs Fighter scenario
 * 
 * @param sam - SAM system configuration
 * @param fighter - Fighter platform configuration
 * @param samPosition - SAM position
 * @param fighterPosition - Fighter position
 * @param pathAttenuationDb - Attenuation along radar path (dB)
 * @returns Object with kill times and success flag
 */
export function calculateEngagement(
  sam: ISAMSystem,
  fighter: IFighterPlatform,
  samPosition: IPosition2D,
  fighterPosition: IPosition2D,
  pathAttenuationDb: number,
  fighterRCS: number // Aspect-dependent RCS
): {
  detectionRange: number;
  currentDistance: number;
  samKillTime: number;
  harmKillTime: number;
  success: boolean;
  detected: boolean;
} {
  const currentDistance = calculateDistance(samPosition, fighterPosition);

  // Calculate adjusted detection range
  let detectionRange = calculateDetectionRange(sam.nominalRange, fighterRCS);
  detectionRange = applyAttenuation(detectionRange, pathAttenuationDb);

  const detected = currentDistance <= detectionRange;

  // Calculate SAM kill time (acquisition + missile flight)
  const acquisitionTime = sam.autoAcquisitionTime; // Assuming automatic for now
  const samMissileFlightTime = calculateMissileFlightTime(currentDistance, sam.missileVelocity);
  const samKillTime = acquisitionTime + samMissileFlightTime;

  // Calculate HARM kill time (launch + missile flight)
  const harmMissileFlightTime = calculateMissileFlightTime(currentDistance, fighter.harmParams.velocity);
  const harmKillTime = harmMissileFlightTime; // Assume immediate launch when in window

  const success = harmKillTime < samKillTime;

  return {
    detectionRange,
    currentDistance,
    samKillTime,
    harmKillTime,
    success,
    detected,
  };
}

/**
 * Get aspect-dependent RCS from fighter platform
 * Simplified aspect calculation based on position vector
 * 
 * @param fighter - Fighter platform
 * @param samToFighterVector - Normalized vector from SAM to fighter
 * @returns RCS value (m²) for current aspect
 */
export function getAspectRCS(
  fighter: IFighterPlatform,
  samToFighterVector: { x: number; y: number }
): number {
  // Simplified: use x-component to determine nose/tail/side aspect
  const angle = Math.atan2(samToFighterVector.y, samToFighterVector.x);
  const angleDeg = (angle * 180) / Math.PI;

  // Nose: ±30°, Tail: ±30° from 180°, Side: everything else
  if (Math.abs(angleDeg) < 30) {
    return fighter.rcs.nose;
  } else if (Math.abs(Math.abs(angleDeg) - 180) < 30) {
    return fighter.rcs.tail;
  } else {
    return fighter.rcs.side;
  }
}

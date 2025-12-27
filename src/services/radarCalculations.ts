/**
 * Radar calculation utilities
 * Standard radar equation with RCS scaling and attenuation
 */

import type { ISAMSystem, IFighterPlatform, IPosition2D, IRadarModel } from '../types/index.js';

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
export function createRadar(sys: ISAMSystem, antenna_gain:  number): IRadarModel {
  // Radar equation: R = [(P_t * G^2 * λ^2 * σ) / ((4π)^3 * P_min)]^(1/4)
  // Solving for P_t (transmit power):
  // P_t = R^4 * (4π)^3 * P_min / (G^2 * λ^2 * σ)
  
  // Assumptions:
  // - Nominal RCS (σ) = 1 m²
  // - Typical radar frequency = 10 GHz (X-band)
  // - λ = c / f where c = 3×10^8 m/s
  
  const SPEED_OF_LIGHT = 3e8; // m/s
  const FREQUENCY = 10e9; // 10 GHz (typical fighter radar)
  const wavelength = SPEED_OF_LIGHT / FREQUENCY; // meters
  const nominalRCS = 1.0; // m²
  
  // Convert range from km to meters
  const rangeMeters = range * 1000;
  
  // Convert antenna gain from dB to linear
  const antennaGainLinear = dbToLinear(antenna_gain);
  
  // Minimum detectable signal (P_min) - typically -100 to -110 dBm for radars
  // Using -105 dBm as a reasonable middle ground
  const P_min_dBm = -105;
  const P_min_watts = Math.pow(10, (P_min_dBm - 30) / 10); // Convert dBm to watts
  
  // Calculate required transmit power using radar equation
  // R^4 = (P_t * G^2 * λ^2 * σ) / ((4π)^3 * P_min)
  const fourPiCubed = Math.pow(4 * Math.PI, 3);
  const transmitPower = (Math.pow(rangeMeters, 4) * fourPiCubed * P_min_watts) / 
                        (Math.pow(antennaGainLinear, 2) * Math.pow(wavelength, 2) * nominalRCS);
  
  // Normalize power to a 0-1 scale based on typical radar power ranges
  // Typical fighter radars: 1-10 kW
  // Typical ground radars: 10-100+ kW
  const typicalMaxPower = 100000; // 100 kW
  const normalizedPower = Math.min(transmitPower / typicalMaxPower, 1.0);
  
  // Noise floor as function of normalized power:  5-10 dB
  // Higher power systems typically have higher noise floors
  const noiseFloor = 5 + (normalizedPower * 5); // Maps 0-1 to 5-10 dB
  
  return {
    nominalRange: range,
    antennaGain: antenna_gain,
    emitterPower: linearToDb(transmitPower / 1000), // Convert to dBkW for practical units
    noiseFloor: noiseFloor,
    frequency: FREQUENCY / 1e9, // Store in GHz
    wavelength: wavelength
  };
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

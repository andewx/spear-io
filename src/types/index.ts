/**
 * Core type definitions for SPEAR application
 * Naming convention: Interfaces use I prefix, type aliases use T prefix
 */

// ============================================================================
// Platform Types
// ============================================================================

export type TPulseModel = 'short' | 'medium' | 'long';

export interface ISAMSystem {
  id: string;
  name: string;
  pulseModel: TPulseModel;
  manualAcquisitionTime: number; // seconds
  autoAcquisitionTime: number; // seconds
  memr: number; // Maximum Effective Missile Range )
  missileVelocity: number; // Mach number
  systemFrequency: number; // GHz
  missileTrackingFrequency: number; // GHz
  nominalRange: number;
  radar: IRadarModel; //IRadar Mode 
}


 export interface IRadarModel{
  nominalRange: number; // nominalRnage against 1.0m^2 target
  antennaGain: number; // [antennaGain in system)
  frequency: number;
  wavelength: number;
  noiseFloorDb: number; // [min Noise Floor DB 5-10dB]
  probD: number; //Probability of detection desired - default 0.9, determines minSNR desired
  minSNR: number; //Calculated fro probD. 
  transmitKPower: number; //Transmit power in KW prior to antenna gain (Base power emitted)
  beamWidthDeg: number; //Beam-width 3dB loss in degrees (Default 2.5 degree)
  effectiveKPower: number: //Calculates effective power due to antennaGain
 }

// Fighter platform interface and model
export interface IFighterPlatform {
  id: string;
  name?: string;
  type: string; // e.g., "F-16", "F-22", "F-35"
  velocity: number; // Mach number
  capacity?: number; // Number of weapon hardpoints
  rcs: IRCSProfile; // Multi-aspect RCS (Swerling 2 model)
  harmParams: IHARMParameters; // Use harmParams to match JSON
  harm?: IHARMParameters; // Alias for compatibility
  dynamicModel?: IFighterModel; // Optional dynamic flight model
}

export interface IFighterModel extends IFighterPlatform {
  fuelCapacity: number; // kg
  fuelConsumptionRate: number; // kg/s at max thrust
  intertiaMoments: InertiaMoments;
  maxGLoad: number; // g's
  weight: number; // kg
  maxVelocity: number; // Mach number
}
export interface InertiaMoments{
  roll: number; // kg·m²
  pitch: number; // kg·m²
  yaw: number; // kg·m²
}

export interface IRCSProfile {
  nose: number; // m²
  tail: number; // m²
  side: number; // m²
  top: number; // m²
  bottom: number; // m²
}

export interface IHARMParameters {
  velocity: number; // Mach number
  range: number; // km
  launchPreference: 'maxRange' | 'memrRatio'; // Launch at max range or ratio of MEMR
  memrRatio?: number; // If launchPreference is memrRatio (0-1)
}

// ============================================================================
// Simulation State Types (runtime dynamic state)
// ============================================================================

export interface ISimulationState {
  time: number; // Current simulation time (seconds)
  sam: IPlatformState;
  fighter: IPlatformState;
  missiles: IMissileState[];
}

export interface IPlatformState {
  position: IPosition2D; // Current position (km)
  velocity: IVelocity2D; // Current velocity (km/s)
  heading: number; // Current heading (degrees)
  status: 'active' | 'destroyed';
}

export interface IVelocity2D {
  x: number; // km/s
  y: number; // km/s
}

export interface IMissileState {
  id: string;
  type: 'SAM' | 'HARM';
  launchedBy: 'sam' | 'fighter';
  launchTime: number; // seconds
  position: IPosition2D; // Current position (km)
  velocity: IVelocity2D; // Current velocity (km/s)
  targetPosition: IPosition2D; // Target position at launch (km)
  status: 'inflight' | 'hit' | 'miss' | 'intercepted';
}

// ============================================================================
// Scenario Types
// ============================================================================

export interface IScenario {
  id: string;
  configId?: string; // Optional reference to saved scenario config
  name: string;
  description?: string;
  grid: IGridBounds;
  timeStep: number; // seconds
  platforms: IScenarioPlatforms;
  environment: IScenarioEnvironment;
  precipitationFieldImage?: string; // Filename of generated precipitation field JPEG
  precipitationFieldOverlay?: string; // Filename of generated precipitation field overlay PNG
  precipitationFieldJet?: string; // Filename of generated precipitation field JET colormap PNG
  createdAt?: Date;
  updatedAt?: Date;
  latLongOrigin?: IScenarioLatLong; // Optional lat/long origin for georeferencing
}

export interface IScenarioLatLong{
  latitude: number; // degrees
  longitude: number; // degrees
}

export interface IGridBounds {
  width: number; // km
  height: number; // km
  resolution: number; // pixels per km
  origin?: IPosition2D;
}

export interface IPosition2D {
  x: number; // km
  y: number; // km
}

export interface IScenarioPlatforms {
  sams: IScenarioPlatform[];
  fighters: IScenarioPlatform[];
}


// ============================================================================
// Scenario Platform Types
// ============================================================================
// TODO : Create a vector embedding for platform controls for AI model integration
export interface IScenarioPlatform {
  id: string; // Platform instance ID (e.g., "sam-1", "fighter-1")
  configId: string; // References ISAMSystem.id or IFighterPlatform.id for config lookup
  type: 'sam' | 'fighter';
  platform?: ISAMSystem | IFighterPlatform; // Loaded platform config (populated after loading)
  position: IPosition2D;
  velocity?: number; // Mach number
  heading?: number; // degrees
  flightPath?: TFlightPathType; // Fighter flight path type
  data?: Record<string, unknown>; // Additional platform-specific data
  controlSchema?: Record<string, unknown>; // Control schema for AI integration
}

export type TFlightPathType = 'straight' | 'evasive' | 'memrFringe';


export interface IScenarioEnvironment {
  precipitation: IPrecipitationConfig;
}

export interface IPrecipitationConfig {
  enabled: boolean;
  nominalRainRate: number; // mm/hr
  nominalCellSize: number; // km
  nominalCoverage: number; // percentage (0-100%)
  alpha: number; // sigma = alpha * nominalCellSize: var = sigma^2
  maxRainRateCap: number; // multiplier for max rain rate (e.g., 1.5 = 150% of nominal)
  sigmoidK: number; // Sigmoid steepness for dynamic range compression (higher = more compression)
  seed?: number; // Random seed for reproducible generation
}

export interface IPrecipitationField {
  cells: IPrecipitationCell[];
  nominalRainRate: number; // mm/hr
  nominalCellSize: number; // km
  nominalCoverage: number; // percentage (0-100%)
}

export interface IPrecipitationCell {
  id: string;
  center: IPosition2D;
  size: number; // km (radius)
  rainRate: number; // mm/hr (nominal at center)
  intensity: number; // 0-1 scale
}

// ============================================================================
// Session Types
// ============================================================================

export interface ISession {
  id: string;
  userId?: string;
  createdAt: Date;
  lastAccessedAt: Date;
  activeSAMId?: string;
  activeFighterId?: string;
  activeScenarioId?: string;
}

// ============================================================================
// Simulation Results
// ============================================================================
export interface IMissileResult{
  id: string;
  launchedBy: 'sam' | 'fighter';
  launchTime: number; // seconds
  timeOfImpact: number | null; // seconds
  impactPosition: IPosition2D | null; // km
  status: 'active' | 'kill' | 'missed';
}

export interface IMissileResults{
  missiles: IMissileResult[];
}


export interface IEngagementResult {
  scenarioId: string;
  missileResults: IMissileResults;
  success: boolean; // true if HARM kills SAM before SAM kills fighter
  timestamp: Date;
}

// ============================================================================
// ITU Data Types
// ============================================================================

// Standard ITU rain rate scale (mm/hr)
export const ITU_RAIN_RATES = [0.01, 0.1, 0.5, 1, 2, 3, 4, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60] as const;
export type TITURainRate = typeof ITU_RAIN_RATES[number];

export interface IITUData {
  attenuationMatrix: number[][]; // 2D array: [frequencyIndex][rainRateIndex] = attenuation (dB/km)
  frequencies: number[]; // Available frequencies (stepped by 0.2 GHz)
  rainRates: readonly number[]; // Standard ITU rain rate scale
  frequencyStart: number; // 5.0 GHz
  frequencyStep: number; // 0.2 GHz
  frequencyRange: [number, number]; // [min, max] GHz
  rainRateRange: [number, number]; // [min, max] mm/hr
}

// ============================================================================
// API Request/Response Types
// ============================================================================

export interface ICreatePlatformRequest {
  type: 'sam' | 'fighter';
  data: ISAMSystem | IFighterPlatform;
}

export interface ICreateScenarioRequest {
  scenario: Omit<IScenario, 'id' | 'createdAt' | 'updatedAt'>;
}

export interface ISimulationRequest {
  scenarioId: string;
  samId: string;
  fighterId: string;
}

export type TAPIResponse<T> = {
  success: true;
  data: T;
} | {
  success: false;
  error: string;
};

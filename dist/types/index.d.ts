/**
 * Core type definitions for SPEAR application
 * Naming convention: Interfaces use I prefix, type aliases use T prefix
 */
export interface ISAMSystem {
    id: string;
    name: string;
    memr: number;
    vel: number;
    frequency: number;
    range: number;
    radar: IRadarModel;
}
export interface IRadarModel {
    range: number;
    antennaGain: number;
    frequency: number;
    wavelength: number;
    noiseFloor: number;
    pd: number;
    min_dbm: number;
    min_watts: number;
    min_snr: number;
    emitterPower: number;
}
export interface IFighterPlatform {
    id: string;
    name?: string;
    type: string;
    velocity: number;
    capacity?: number;
    rcs: IRCSProfile;
    harmParams: IHARMParameters;
    harm?: IHARMParameters;
    dynamicModel?: IFighterModel;
}
export interface IFighterModel extends IFighterPlatform {
    fuelCapacity: number;
    fuelConsumptionRate: number;
    intertiaMoments: InertiaMoments;
    maxGLoad: number;
    weight: number;
    maxVelocity: number;
}
export interface InertiaMoments {
    roll: number;
    pitch: number;
    yaw: number;
}
export interface IRCSProfile {
    nose: number;
    tail: number;
    side: number;
    top: number;
    bottom: number;
}
export interface IHARMParameters {
    velocity: number;
    range: number;
    launchPreference: 'maxRange' | 'memrRatio';
    memrRatio?: number;
}
export interface ISimulationState {
    time: number;
    sam: IPlatformState;
    fighter: IPlatformState;
    missiles: IMissileState[];
}
export interface IPlatformState {
    position: IPosition2D;
    velocity: IVelocity2D;
    heading: number;
    status: 'active' | 'destroyed';
}
export interface IVelocity2D {
    x: number;
    y: number;
}
export interface IMissileState {
    id: string;
    type: 'SAM' | 'HARM';
    launchedBy: 'sam' | 'fighter';
    launchTime: number;
    position: IPosition2D;
    velocity: IVelocity2D;
    targetPosition: IPosition2D;
    status: 'inflight' | 'hit' | 'miss' | 'intercepted';
}
export interface IScenario {
    id: string;
    configId?: string;
    name: string;
    description?: string;
    grid: IGridBounds;
    timeStep: number;
    platforms: IScenarioPlatforms;
    environment: IScenarioEnvironment;
    precipitationFieldImage?: string;
    precipitationFieldOverlay?: string;
    precipitationFieldJet?: string;
    createdAt?: Date;
    updatedAt?: Date;
    latLongOrigin?: IScenarioLatLong;
}
export interface IScenarioLatLong {
    latitude: number;
    longitude: number;
}
export interface IGridBounds {
    width: number;
    height: number;
    resolution: number;
    origin?: IPosition2D;
}
export interface IPosition2D {
    x: number;
    y: number;
}
export interface IScenarioPlatforms {
    sams: IScenarioPlatform[];
    fighters: IScenarioPlatform[];
}
export interface IScenarioPlatform {
    id: string;
    configId: string;
    type: 'sam' | 'fighter';
    platform?: ISAMSystem | IFighterPlatform;
    position: IPosition2D;
    velocity?: number;
    heading?: number;
    flightPath?: TFlightPathType;
    data?: Record<string, unknown>;
    controlSchema?: Record<string, unknown>;
}
export type TFlightPathType = 'straight' | 'evasive' | 'memrFringe';
export interface IScenarioEnvironment {
    precipitation: IPrecipitationConfig;
}
export interface IPrecipitationConfig {
    enabled: boolean;
    nominalRainRate: number;
    nominalCellSize: number;
    nominalCoverage: number;
    alpha: number;
    maxRainRateCap: number;
    sigmoidK: number;
    seed?: number;
}
export interface IPrecipitationField {
    cells: IPrecipitationCell[];
    nominalRainRate: number;
    nominalCellSize: number;
    nominalCoverage: number;
}
export interface IPrecipitationCell {
    id: string;
    center: IPosition2D;
    size: number;
    rainRate: number;
    intensity: number;
}
export interface ISession {
    id: string;
    userId?: string;
    createdAt: Date;
    lastAccessedAt: Date;
    activeSAMId?: string;
    activeFighterId?: string;
    activeScenarioId?: string;
}
export interface IMissileResult {
    id: string;
    launchedBy: 'sam' | 'fighter';
    launchTime: number;
    timeOfImpact: number | null;
    impactPosition: IPosition2D | null;
    status: 'active' | 'kill' | 'missed';
}
export interface IMissileResults {
    missiles: IMissileResult[];
}
export interface IEngagementResult {
    scenarioId: string;
    missileResults: IMissileResults;
    success: boolean;
    timestamp: Date;
}
export declare const ITU_RAIN_RATES: readonly [0.01, 0.1, 0.5, 1, 2, 3, 4, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60];
export type TITURainRate = typeof ITU_RAIN_RATES[number];
export interface IITUData {
    attenuationMatrix: number[][];
    frequencies: number[];
    rainRates: readonly number[];
    frequencyStart: number;
    frequencyStep: number;
    frequencyRange: [number, number];
    rainRateRange: [number, number];
}
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
//# sourceMappingURL=index.d.ts.map
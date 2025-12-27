import { IITUData, IPosition2D, IScenario, IRadarModel } from '../types/index.js';
export type TPulseIntegrationMode = 'coherent' | 'noncoherent';
export interface IRadarConfig {
    range: number;
    frequency: number;
    radarModel?: IRadarModel;
}
/**
 * Radar system for detection range calculations
 * Operates using relative range scaling from nominal 1m² RCS baseline
 * Now supports power-based detection with pulse integration
 */
export declare class Radar {
    private range;
    private frequency;
    private pulseIntegrationGain;
    private radarConfig;
    ituData: IITUData;
    private radarModel;
    private ctx;
    private imageData;
    constructor(config: IRadarConfig);
    /** Canvas context and image data for precipitation image processing */
    loadImageDataFromScenario(scenario: IScenario): Promise<void>;
    /**
     * Calculate pulse integration gain
     * Coherent: sqrt(N)
     * Non-coherent: N^0.7
     */
    private calculatePulseIntegrationGain;
    /**
     * Calculate received power at a given range using radar equation
     * P_r = (P_t * G^2 * λ^2 * σ) / ((4π)^3 * R^4)
     *
     * @param range - Range to target (km)
     * @param rcs - Target radar cross section (m²)
     * @param pathAttenuationDb - Two-way path attenuation in dB (default 0)
     * @returns Received power in watts
     */
    private calculateReceivedPower;
    /**
     * Calculate SNR for received power with pulse integration
     * SNR = (P_r * N^α) / P_noise
     * where α = 0.7 for non-coherent integration (Swerling 2)
     *
     * @param receivedPower - Received power per pulse (watts)
     * @param numPulses - Number of integrated pulses
     * @returns SNR in dB
     */
    private calculateSNR;
    /**
     * Determine if target is detectable at given range with current parameters
     * Detection occurs when SNR >= min_snr (from probability of detection requirements)
     *
     * @param range - Range to target (km)
     * @param rcs - Target RCS (m²)
     * @param pathAttenuationDb - Two-way path attenuation (dB)
     * @param numPulses - Number of integrated pulses
     * @returns True if target is detectable
     */
    private isDetectable;
    /**
     * Load the ITU data for path attenuation calculations
     */
    loadITUData(): Promise<IITUData>;
    /**
     * Calculate detection range for a given RCS
     * Uses R₁/R₂ = (RCS₂/RCS₁)^0.25 from radar range equation
     *
     * @param rcs - Target radar cross section (m²)
     * @returns Detection range (km)
     */
    calculateDetectionRange(rcs: number, pulses: number, range: number): number;
    private decibelsToWatts;
    /**Given a decibel gain convert the resulting range increase/decrease */
    private rangeDeltaFromDecibels;
    private wattsToDecibels;
    /**
     * Calculate detection range with precipitation field attenuation sampling
     * Calculates effective radar power at each step along the beam path and returns
     * the range where received power drops below the minimum SNR threshold
     *
     * @param rcs fighter RCS (m²)
     * @param position radar position
     * @param azimuth beam azimuth (degrees)
     * @param scenario scenario with precipitation field
     * @param numPulses number of pulses to integrate (default 1)
     * @returns detection range (km) where SNR falls below detection threshold
     */
    calculateDetectionRangeWithPrecipitationFieldSampling(rcs: number, position: IPosition2D, azimuth: number, scenario: IScenario, numPulses?: number): number;
    /**
     * Sample rain rate using bilinear interpolation for smooth values
     * Returns null if position is outside image bounds
     */
    private sampleRainRateBilinear;
    /**
     * Get pixel intensity (average of RGB) at given coordinates
     */
    private getPixelIntensity;
    private degToRad;
    /**
     * Given rain rate (mm/hr), get specific attenuation (dB/km) from ITU data
     */
    getSpecificAttenuation(rainRate: number): number;
}
//# sourceMappingURL=Radar.d.ts.map
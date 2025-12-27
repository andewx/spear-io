/**
 * Radar system abstraction
 * Handles detection range calculations with path attenuation and pulse integration
 */
import * as itu from '../services/ituData.js';
import { SyntheticPrecipitationField } from '../synthetic/index.js';
import { Canvas, CanvasRenderingContext2D, createCanvas, Image, ImageData, loadImage } from 'canvas';
import { IITUData, IPosition2D, IScenario, IRadarModel } from '../types/index.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { dbToLinear, linearToDb } from '../services/radarCalculations.js';
import e from 'express';

export type TPulseIntegrationMode = 'coherent' | 'noncoherent';

export interface IRadarConfig {
  range: number; // Detection range for 1m² RCS target (km)
  frequency: number; // Operating frequency (GHz)
  radarModel?: IRadarModel; // Optional detailed radar model for power calculations
}

/**
 * Radar system for detection range calculations
 * Operates using relative range scaling from nominal 1m² RCS baseline
 * Now supports power-based detection with pulse integration
 */
export class Radar {
  private range: number;
  private frequency: number;
  private pulseIntegrationGain: number;
  private radarConfig: IRadarConfig;
  public ituData: IITUData;
  private radarModel: IRadarModel | null = null;

  //Canvas objects for precipitation image processing
  private ctx: CanvasRenderingContext2D | null = null;
  private imageData: ImageData | null = null;


  constructor(config: IRadarConfig) {
    this.range = config.range;
    this.frequency = config.frequency;
    this.radarConfig = config;
    this.radarModel = config.radarModel || null;
    this.pulseIntegrationGain = this.calculatePulseIntegrationGain(1);

    //Ensure numeric properties are numbers
    this.range = Number(this.range);
    this.frequency = Number(this.frequency);
  }

  /** Canvas context and image data for precipitation image processing */
  async loadImageDataFromScenario(scenario: IScenario): Promise<void> {

       // Construct file system path to precipitation image
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const imagePath = path.join(__dirname, '..', 'data', 'precipitation', scenario.precipitationFieldImage);
    
    console.log('\nLoading precipitation image from:', imagePath);

    //Replace load image with
    try{

      const image: Image = await loadImage(imagePath);

      //Create canvas matchin image dimensions
       // Create canvas matching image dimensions
      const canvas: Canvas = createCanvas(image.width, image.height);
      const ctx: CanvasRenderingContext2D = canvas.getContext('2d');
      
      // Draw image to canvas
      ctx.drawImage(image, 0, 0);
      
      // Extract pixel data
      this.imageData = ctx.getImageData(0, 0, image.width, image.height);

    }catch(error){
      console.error('Failed to load precipitation image:', error);
    }

  }

  /**
   * Calculate pulse integration gain
   * Coherent: sqrt(N)
   * Non-coherent: N^0.7
   */
  private calculatePulseIntegrationGain(pulses: number): number {

    return this.wattsToDecibels(Math.pow(pulses, 0.7));
    
  }

  /**
   * Calculate received power at a given range using radar equation
   * P_r = (P_t * G^2 * λ^2 * σ) / ((4π)^3 * R^4)
   * 
   * @param range - Range to target (km)
   * @param rcs - Target radar cross section (m²)
   * @param pathAttenuationDb - Two-way path attenuation in dB (default 0)
   * @returns Received power in watts
   */
  private calculateReceivedPower(wattsPower: number, range: number, rcs: number, pathAttenuationDb: number = 0): number {
    if (!this.radarModel) {
      throw new Error('Radar model required for power-based calculations');
    }

    const rangeMeters = range; // * 1000; // Convert km to meters

    // Scale watts power by range step,rcs wavelength etc
    const attenuationLinear = dbToLinear(pathAttenuationDb);
    const receivedPower = (wattsPower / (Math.pow(rangeMeters, 4)*attenuationLinear));
    return receivedPower;
  }

  /**
   * Calculate SNR for received power with pulse integration
   * SNR = (P_r * N^α) / P_noise
   * where α = 0.7 for non-coherent integration (Swerling 2)
   * 
   * @param receivedPower - Received power per pulse (watts)
   * @param numPulses - Number of integrated pulses
   * @returns SNR in dB
   */
  private calculateSNR(receivedPower: number, numPulses: number = 1): number {
    if (!this.radarModel) {
      throw new Error('Radar model required for SNR calculations');
    }

    const dbPower = receivedPower;

    // Noise power from minimum detectable signal
    const noisePower = dbToLinear(this.radarModel.noiseFloor);



    // SNR = (P_r * integration_gain) / P_noise in dB
    const snr = linearToDb(receivedPower / noisePower);
    return snr;
  }

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
  private isDetectable(range: number, rcs: number, pathAttenuationDb: number, numPulses: number): boolean {
    if (!this.radarModel) {
      // Fall back to legacy range-based calculation
      return true;
    }

    const receivedPower = this.calculateReceivedPower(range, rcs, pathAttenuationDb);
    const snr = this.calculateSNR(receivedPower, numPulses);
    
    return snr >= this.radarModel.min_snr;
  }


  /**
   * Load the ITU data for path attenuation calculations
   */
  async loadITUData(): Promise<IITUData> {
    if (!this.ituData) {
      this.ituData = await itu.loadITUData();
    }
    return this.ituData;
  }

  /**
   * Calculate detection range for a given RCS
   * Uses R₁/R₂ = (RCS₂/RCS₁)^0.25 from radar range equation
   * 
   * @param rcs - Target radar cross section (m²)
   * @returns Detection range (km)
   */
  calculateDetectionRange(rcs: number, pulses: number, range:number): number {
    const pulseGain = this.calculatePulseIntegrationGain(pulses);
    range = range * this.rangeDeltaFromDecibels(pulseGain);
    const rcsRatio = rcs / 1.0; // Nominal is 1m²
    const rangeRatio = Math.pow(rcsRatio, 0.25);
    return range * rangeRatio;
  }

  private decibelsToWatts(db: number): number {
    return Math.pow(10, db / 10);
  }

/**Given a decibel gain convert the resulting range increase/decrease */
  private rangeDeltaFromDecibels(dbGain: number): number {
    // Convert dB gain to linear scale
    const linearGain = this.decibelsToWatts(dbGain);
    // Range scales with the fourth root of power gain
    return Math.pow(linearGain, 0.25);
  }

  private wattsToDecibels(watts: number): number {  
    return 10 * Math.log10(watts);
  }


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
  public calculateDetectionRangeWithPrecipitationFieldSampling(
    rcs: number, 
    position: IPosition2D,
    azimuth: number, 
    scenario: IScenario,
    numPulses: number = 1
  ): number {
    // If no precipitation field image, return unattenuated range
    if (!scenario.precipitationFieldImage) {
      console.log("No precipitation field image defined, returning unattenuated range.");
      return this.calculateDetectionRange(rcs, numPulses, this.range);
    }

    try {
      const pixelsPerKm = scenario.grid.resolution; // pixels per km
      const kmPerPixel = 1 / pixelsPerKm;
      const maxRangeKm = this.range * 1.5; // Sample beyond nominal for margin
      const rangeStepKm = kmPerPixel * 0.1; // Sample at fine intervals
      const NRay = Math.ceil(maxRangeKm / rangeStepKm);

      //Scenario max precipitation rate
      const maxPrecipitationRate = scenario.environment.precipitation.maxRainRateCap || 35; // mm/hr

      // Total accumulated attenuation in dB (two-way path)
      let totalAttenuationDb = 0;
      let systemPowerWatts = this.radarModel ? dbToLinear(this.radarModel.emitterPower) * 1000 : 1000; // Convert kW to watts
      systemPowerWatts = systemPowerWatts * dbToLinear(this.calculatePulseIntegrationGain(numPulses)) * Math.pow(dbToLinear(this.radarModel.antennaGain),2) * rcs * Math.pow(this.radarModel.wavelength,2) / Math.pow(4*Math.PI,3);
      let stepAttenuationDb = 0;
      
      const azRad = this.degToRad(azimuth);
      let lastDetectableRange = 0;

      // Cast ray from radar position outward in azimuth direction
      // Calculate effective radar power at each step
      for (let iray = 0; iray < NRay; iray++) {
        const currentRangeKm = (iray + 1) * rangeStepKm;
        // Calculate world position along ray from radar position
        const offsetX = currentRangeKm * Math.cos(azRad);
        const offsetY = currentRangeKm * Math.sin(azRad);
        const worldPos = { 
          x: position.x + offsetX, 
          y: position.y + offsetY 
        };
        
        // Sample rain rate using bilinear interpolation for smooth values
        const rainRate = this.sampleRainRateBilinear(worldPos, scenario, maxPrecipitationRate);
        
        if (rainRate !== null && rainRate > 1.0) { // Threshold to avoid noise
          const specificAttenuation = this.getSpecificAttenuation(rainRate); // dB/km one-way
          // Two-way path: signal travels to target and back
          const stepAttenuationDb = 2.0 * specificAttenuation * rangeStepKm;
        }
        
        // Calculate received power at this range with accumulated path attenuation
        if (this.radarModel) {
          // Power-based calculation: compute received power and check SNR
          systemPowerWatts = this.calculateReceivedPower(systemPowerWatts,rangeStepKm, rcs, stepAttenuationDb);
          const snr = this.calculateSNR(systemPowerWatts, numPulses);
          
          // Check if SNR meets detection threshold
          if (snr >= this.radarModel.min_snr) {
            lastDetectableRange = currentRangeKm;
          } else {
            // Power has dropped below minimum SNR - this is our detection limit
            break;
          }
        } else {
          // Legacy: use range reduction formula
          const effectiveRange = this.range * Math.pow(10, -totalAttenuationDb / 40);
          const rcsScaledRange = effectiveRange * Math.pow(rcs, 0.25);
          
          if (currentRangeKm <= rcsScaledRange) {
            lastDetectableRange = currentRangeKm;
          } else {
            break;
          }
        }
      }
      
      return lastDetectableRange > 0 ? lastDetectableRange : this.calculateDetectionRange(rcs, numPulses, this.range);
      
    } catch (error) {
      console.error('Failed to sample precipitation field:', error);
      // Fall back to unattenuated range if sampling fails
      return this.calculateDetectionRange(rcs, numPulses, this.range);
    }
  }


  /**
   * Sample rain rate using bilinear interpolation for smooth values
   * Returns null if position is outside image bounds
   */
  private sampleRainRateBilinear(position: {x: number, y: number}, scenario: IScenario, maxPrecipitationRate: number): number | null {
    if (!this.imageData) return null;
    
    const resolution = scenario.grid.resolution;
    const gridWidthKm = scenario.grid.width;
    const gridHeightKm = scenario.grid.height;
    const widthPixels = gridWidthKm * resolution;
    const heightPixels = gridHeightKm * resolution;
    
    const originX = scenario.grid.origin?.x || 0;
    const originY = scenario.grid.origin?.y || 0;
    
    // Get continuous pixel coordinates (with fractional part)
    const centerPixelX = widthPixels / 2;
    const centerPixelY = heightPixels / 2;
    const px = centerPixelX + (position.x - originX) * resolution;
    const py = centerPixelY + (position.y - originY) * resolution; // Y axis is inverted in display visualization so we match here
    
    // Check bounds (need 1-pixel margin for interpolation)
    if (px < 0 || px >= widthPixels - 1 || py < 0 || py >= heightPixels - 1) {
      return null;
    }
    
    // Get the four surrounding pixel coordinates
    const x0 = Math.floor(px);
    const y0 = Math.floor(py);
    const x1 = x0 + 1;
    const y1 = y0 + 1;
    
    // Get fractional parts for interpolation weights
    const fx = px - x0;
    const fy = py - y0;
    
    // Sample four surrounding pixels
    const intensity00 = this.getPixelIntensity(x0, y0, widthPixels);
    const intensity10 = this.getPixelIntensity(x1, y0, widthPixels);
    const intensity01 = this.getPixelIntensity(x0, y1, widthPixels);
    const intensity11 = this.getPixelIntensity(x1, y1, widthPixels);
    
    // Bilinear interpolation
    const intensity0 = intensity00 * (1 - fx) + intensity10 * fx;
    const intensity1 = intensity01 * (1 - fx) + intensity11 * fx;
    const intensity = intensity0 * (1 - fy) + intensity1 * fy;
    
    // Map interpolated intensity to rain rate
    return (intensity / 255) * maxPrecipitationRate;
  }
  
  /**
   * Get pixel intensity (average of RGB) at given coordinates
   */
  private getPixelIntensity(x: number, y: number, width: number): number {
    if (!this.imageData) return 0;
    
    const pixelIndex = (y * width + x) * 4;
    if (pixelIndex + 2 >= this.imageData.data.length) return 0;
    
    const r = this.imageData.data[pixelIndex];
    const g = this.imageData.data[pixelIndex + 1];
    const b = this.imageData.data[pixelIndex + 2];
    
    return (r + g + b) / 3;
  }

  private degToRad(deg: number): number {
    return (deg * Math.PI) / 180;
  }



  /**
   * Given rain rate (mm/hr), get specific attenuation (dB/km) from ITU data
   */
  getSpecificAttenuation(rainRate: number): number {
    if (!this.ituData) {
      throw new Error('ITU data not loaded');
    }
    return itu.getAttenuation(this.frequency, rainRate);
  }
}

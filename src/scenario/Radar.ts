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
    const imagePath = path.join(__dirname, '..', '..', 'src', 'data', 'images', scenario.precipitationFieldImage);
    
    console.log('\nLoading precipitation image from:', imagePath);

    //Replace load image with
    try{

      const image: Image = await loadImage(imagePath);

      //Create canvas matchin image dimensions
       // Create canvas matching image dimensions
      const canvas: Canvas = createCanvas(image.width, image.height);
      const ctx: CanvasRenderingContext2D = canvas.getContext('2d');
      

      //Flip image vertically to match world coordinates
      ctx.translate(0, image.height);
      ctx.scale(1, -1);
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
   * For two-way radar path: Path Loss = 32.45 + 20*log10(f_MHz) + 40*log10(R_km)
   * Note: 40*log10(R) for radar (two-way), not 20*log10(R) which is one-way
   * @param totalRangeKm - Total cumulative range from radar to target (km)
   * @param frequency - Frequency in GHz
   * @param pathAttenuationDb - Two-way path attenuation in dB (default 0)
   * @returns Received power in dB relative to initial system power
   */
  private pathLoss(totalRangeKm: number, stepRangeKm: number, frequency: number, pathAttenuationDb: number = 0): number {
    if (!this.radarModel) {
      throw new Error('Radar model required for power-based calculations');
    }
    // Convert GHz to MHz for Friis formula
    const f = frequency * 1e9;
    const tRangeMeter = totalRangeKm * 1000;
    const sRangeMeter = stepRangeKm * 1000;
    // Two-way radar path loss: 32.45 + 20*log10(f_MHz) + 40*log10(R_km)
    const pathLossDb = 20 * Math.log10((tRangeMeter + sRangeMeter)/tRangeMeter);
    return pathLossDb + pathAttenuationDb;
  }

  /**
   * Calculate SNR for received power with pulse integration
   * SNR = (P_r + G_integration) - P_noise
   * Pulse integration gain already included in system power calculation
   * 
   * @param receivedPowerDb - Received power in dB
   * @param systemPowerDb - Initial system power (Pt + 2*G + RCS + λ² + integration gain) in dB
   * @returns SNR in dB
   */
  private calculateSNR(receivedPowerDb: number, systemPowerDb: number): number {
    if (!this.radarModel) {
      throw new Error('Radar model required for SNR calculations');
    }
    // SNR = System Power + Received Power (negative) - Noise Floor
    return systemPowerDb + receivedPowerDb - this.radarModel.noiseFloor;
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

    const receivedPower = this.pathLoss(range, rcs, pathAttenuationDb);
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
      return this.calculateDetectionRange(rcs, numPulses, this.range);
    }

    try {

      const pixelsPerKm = scenario.grid.resolution; // pixels per km
      const kmPerPixel = 1 / pixelsPerKm;
      const maxRangeKm = this.range * 1.5; // Sample beyond nominal for margin
      const rangeStepKm = kmPerPixel * 1.0; // Sample at fine intervals
      const NRay = Math.ceil(maxRangeKm / rangeStepKm);
      const frequency = this.radarModel.frequency;
      const fHz = frequency * 1e9;
      const wavelength = 3e8 / fHz;
      let totalAttenuationDb = 0; let stepAttenuationDb = 0;

      //Scenario max precipitation rate
      const maxPrecipitationRate = scenario.environment.precipitation.maxRainRateCap || 35; // mm/hr


      // System power: Pt + 2*G + σ + λ² + integration gain (all in dB)
      const sysPower = this.radarModel.emitterPower;
      let currentPowerDb = sysPower - 20*Math.log10((4*Math.PI)/wavelength);
      const azRad = this.degToRad(azimuth);
      let lastDetectableRange = rangeStepKm;

      // Cast ray from radar position outward in azimuth direction
      // Calculate effective radar power at each step
      for (let iray = 0; iray < NRay; iray++) {
        stepAttenuationDb = 0;
        const currentRangeKm = (iray + 1) * rangeStepKm;
        // Calculate world position along ray from radar position
        const offsetX = currentRangeKm * Math.cos(azRad);
        const offsetY = currentRangeKm * Math.sin(azRad);

        const worldPos = { 
          x: position.x + offsetX, 
          y: position.y + offsetY 
        };


        //Now take the worldPos offset and turn those into image pixel offsets according to kmPerPixel
        

        const imageCoords = this.worldToImageCoords(worldPos, scenario);
        
        // Sample rain rate using bilinear interpolation for smooth values
        const rainRate = this.sampleRainRateBilinear(imageCoords, scenario, maxPrecipitationRate);
        
    
        
        if (rainRate !== null && rainRate > 0.01) { // Threshold to avoid noise
          const specificAttenuation = this.getSpecificAttenuation(rainRate); // dB/km one-way
          // Two-way path: signal travels to target and back
          stepAttenuationDb = specificAttenuation * rangeStepKm;
          totalAttenuationDb += stepAttenuationDb;
         
        }
        
        // Calculate received power at this range with accumulated path attenuation
        if (this.radarModel) {
          // Power-based calculation: compute received power and check SNR
          // Use TOTAL range from radar, not step increment
          currentPowerDb = currentPowerDb - 2*this.pathLoss(currentRangeKm, rangeStepKm, frequency, stepAttenuationDb);
          const snr = currentPowerDb - this.radarModel.noiseFloor;
          
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


  private worldToImageCoords(position: IPosition2D, scenario: IScenario): {x: number, y: number} {
    if (!this.imageData) {
      throw new Error('Image data not loaded');
    }


    const pixelsPerKmWidth = this.imageData.width / scenario.grid.width;
    const pixelsPerKmHeight = this.imageData.height / scenario.grid.height;

    // We can assume origin is (0,0) for the wolrd coordinates and get our initial pixel offsets
    let pixelX = position.x * pixelsPerKmWidth;
    let pixelY = position.y * pixelsPerKmHeight;

    // Now subtract half the image dimensions to center the radar at the image center
    pixelX += this.imageData.width / 2;
    pixelY = -pixelY + this.imageData.height / 2;

    return {x: pixelX, y: pixelY};


  }

  /**
   * Sample rain rate using bilinear interpolation for smooth values
   * Returns null if position is outside image bounds
   */
  private sampleRainRateBilinear(position: {x: number, y: number}, scenario: IScenario, maxPrecipitationRate: number): number  {
    if (!this.imageData) return null;
    const px = position.x;
    const py = position.y;
    const widthPixels = this.imageData.width;
    const heightPixels = this.imageData.height;

    // Need a 1px border for bilinear sampling (x1/y1 must be in-bounds).
    if (!Number.isFinite(px) || !Number.isFinite(py)) return 0;
    if (px < 0 || py < 0 || px >= widthPixels - 1 || py >= heightPixels - 1) return 0;
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

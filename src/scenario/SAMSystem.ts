/**
 * SAM System platform model
 * Represents a Surface-to-Air Missile system with radar and missile characteristics
 */

import { Radar, TPulseIntegrationMode } from './Radar.js';
import type { IScenario, ISAMSystem, IPosition2D } from '../types/index.js';
import { SyntheticPrecipitationField } from '../synthetic/index.js';
import { Fighter } from './index.js';
import * as storage from '../services/fileStorage.js';


type SAMStatus = {
  missilesRemaining: number;
  launchedMissiles?: number;
  totalMissiles?: number;
  lastLaunchTime?: number;
}


type Track = {
  id: string;
  acquisitionTime: number;
  distance: number;
  azimuth: number;
  status: 'tracking' | 'not_tracking' | 'lost';
  timeElapsedTracking: number;
}

export class SAMSystem {
  public readonly id: string;
  public readonly name: string;
  public readonly properties: ISAMSystem;
  public trackedTargets: Map<string, Track> = new Map();
  public readonly radar: Radar;
  public state: 'active' | 'destroyed';
  public readonly range: number;
  public  ranges:Array<number>= []; // Precomputed ranges with precipitation attenuation
  public readonly numAzimuths = 360; // e.g., 1 degree increments over 360 degrees
  private scenario: IScenario; // Reference to scenario for precipitation field access

  //TODO: Move these properties and others to ISAMSystem interface and store with platform
  public launchIntervalSec: number = 5; // seconds between launches
  public position: IPosition2D = { x: 0, y: 0 }; // SAM position in km
  public status: SAMStatus = {
    missilesRemaining: 6,
    totalMissiles: 6,
    launchedMissiles: 0,
    lastLaunchTime: 0,
  };

  constructor(platform: ISAMSystem, scenario: IScenario) {
    this.id = platform.id;
    this.name = platform.name;
    this.properties = platform;
    this.state = 'active';
    this.scenario = scenario; // Store scenario reference
   
    // Create main search/track radar with detailed radar model if available
    this.radar = new Radar({
      range: platform.range,
      frequency: platform.frequency,
      radarModel: platform.radar, // Pass IRadarModel for power-based calculations
    });

    this.range = platform.range;


        //Ensure that all numeric properties are numbers
    this.properties.range = Number(this.properties.range);
    this.properties.memr = Number(this.properties.memr);
    this.properties.vel = Number(this.properties.vel);
    this.properties.frequency = Number(this.properties.frequency);


  }


  getRangeAtAzimuth(azimuthDeg:number):number {
    const azimuths = this.getDetectionRanges();
    const numAzimuths = azimuths.length;
    const azimuthIndex = Math.round(((azimuthDeg % 360) / 360) * numAzimuths) % numAzimuths;
    return azimuths[azimuthIndex];
  }


  getDetectionRanges():Array<number> {
      const adjustedRanges = this.ranges.map((nominalRange) => {
      const detectionRange = this.radar.calculateDetectionRange(1.0, 1.0, nominalRange);
      return detectionRange;
    });

    return adjustedRanges;
  }

  getAzimuthToTarget(targetPosition: IPosition2D): number {
    const deltaX = targetPosition.x - this.position.x;
    const deltaY = targetPosition.y - this.position.y;
    const azimuthRad = Math.atan2(deltaY, deltaX);
    let azimuthDeg = azimuthRad * (180 / Math.PI);
    if (azimuthDeg < 0) {
      azimuthDeg += 360;
    }
    return azimuthDeg;
  }

  async getPrecipitationRanges(numPulses: number): Promise<void> {
   

    if(this.scenario.environment.precipitation.enabled && this.scenario.precipitationFieldImage){
      console.log("[SAMSystem.getPrecipitationRanges] Loading image data from scenario...");
      await this.radar.loadImageDataFromScenario( this.scenario); 
      this.calculateDetectionRangesWithSampling(this.scenario, numPulses);
     
    } else {
      // No precipitation - populate with nominal ranges
     
      for (let i = 0; i < this.numAzimuths; i++) {
        const nominalRange = this.radar.calculateDetectionRange(1.0, numPulses, this.range);
        this.ranges.push(nominalRange);
      }
    
    }
  }


  getMissileProperties() {
    return {
      memr: this.properties.memr,
      velocity: this.properties.vel,
    };
  }


  getTrackings(): Map<string, Track> {
    return this.trackedTargets;
  }

  /**
   * Calculate detection range for a target with given RCS and path attenuation
   * 
   * @param rcs - Target RCS (m²)
   * @param pulses - Number of integrated pulses
   * @param range - Base range to scale from
   * @returns Detection range (km)
   */
  calculateDetectionRange(rcs: number, pulses: number, range: number): number {
    return this.radar.calculateDetectionRange(rcs, pulses, range);
  }



  /**
   * Calculate detection range with attenuation precipitation sampling method along azimuth
   * use radar.calculateDetectionRange(rcs, range) when applying a specific RCS
   * 
   * @param scenario - Scenario with precipitation field
   * @param numPulses - Number of pulses to integrate (default 1)
   */
  calculateDetectionRangesWithSampling(scenario: IScenario, numPulses: number = 1): number {
    const samPosition = this.position;
    const N = this.numAzimuths;
    this.ranges = []; // Clear existing ranges
    for (let i = 0; i < N; i++) {
      const azimuthDeg = ( 360/ N)*i;
      const range = this.radar.calculateDetectionRangeWithPrecipitationFieldSampling(
        1.0, // nominal RCS
        samPosition,
        azimuthDeg,
        scenario,
        numPulses
      );
      this.ranges.push(range);
    }
    return this.ranges.length;
  }


  /**
   * Calculate time for missile to reach target
   * 
   * @param distance - Distance to target (km)
   * @returns Flight time (seconds)
   */
  calculateMissileFlightTime(distance: number): number {
    const speedOfSound = 343; // m/s at sea level
    const velocityMs = this.properties.vel * speedOfSound;
    const velocityKmS = velocityMs / 1000;
    return distance / velocityKmS;
  }
}

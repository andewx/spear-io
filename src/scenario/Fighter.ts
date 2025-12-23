/**
 * Fighter platform model
 * Represents fighter aircraft with multi-aspect RCS and HARM capability
 */

import type { IFighterPlatform, IRCSProfile, IScenarioPlatform } from '../types/index.js';
import type { IPosition2D } from '../types/index.js';

type TFighterStatus = {
  state: 'active' | 'destroyed';
  maneuvers: 'none' | 'evasive';
}

export class Fighter {
  public id: string;
  public readonly type: IFighterPlatform['type'];
  public  position: IPosition2D;
  public  velocity: number;
  public readonly rcs: IRCSProfile;
  public readonly harmVelocity: number;
  public readonly harmRange: number;
  public readonly launchPreference: IFighterPlatform['harmParams']['launchPreference'];
  public readonly memrRatio?: number;
  public heading: number;
  public launchedHARM: boolean = false;
  public launchTime: number | null = null;
  public missilesRemaining: number = 2; // Assume 1 HARM for now
  public state: 'active' | 'destroyed';
  public maneuvers: 'none' | 'evasive';

  constructor(fighter: IScenarioPlatform, position: IPosition2D, heading: number) {
    const platform = fighter.platform as IFighterPlatform;

    if (!platform){
      throw new Error(`Invalid fighter platform data for fighter ID: ${fighter.id}`);
    }
    this.id = fighter.id;
    this.type = fighter.type;
    this.velocity = fighter.velocity;
    this.position = position;
    this.heading = heading;
    this.rcs = platform.rcs;
    this.harmVelocity = platform.harmParams.velocity;
    this.harmRange = platform.harmParams.range;
    this.launchPreference = platform.harmParams.launchPreference;
    this.launchTime = 0.0;
    this.memrRatio = 1.0;
    this.state = 'active';
    this.maneuvers = 'none';

    //Ensure that the  position velocity and heading are numbers and not strings
    this.position.x = Number(this.position.x);
    this.position.y = Number(this.position.y);
    this.velocity = Number(this.velocity);
    this.harmVelocity = Number(this.harmVelocity);
    this.harmRange = Number(this.harmRange);
  }

  getHarmProperties() {
    return {
      velocity: this.harmVelocity,
      range: this.harmRange,
      launchPreference: this.launchPreference,
      memrRatio: this.memrRatio,
    };
  }

  launchHARM(currentTime: number): void {
    this.launchedHARM = true;
    this.launchTime = currentTime;
  }

  getVelocityKms(): number {
    const speedOfSound = 343; // m/s
    const velocityMs = this.velocity * speedOfSound;
    return velocityMs / 1000; // km/s
  }


  getAzimuthToTarget(targetPos: IPosition2D): number {
    const deltaX = targetPos.x - this.position.x;
    const deltaY = targetPos.y - this.position.y;
    const azimuthRad = Math.atan2(deltaY, deltaX);
    let azimuthDeg = azimuthRad * (180 / Math.PI);
    if (azimuthDeg < 0) {
      azimuthDeg += 360;
    }
    return azimuthDeg;
  }

  /**
   * Get RCS based on aspect angle from observer
   * 
   * @param azimuthDeg - Azimuth angle from nose (degrees, 0 = nose-on, 180 = tail-on)
   * @returns RCS (m²)
   */
  getRCSAtAspect(azimuthDeg: number): number {
    // Normalize to 0-360
    const angle = ((azimuthDeg % 360) + 360) % 360;

    // Nose aspect: ±30° from 0° or 360°
    if (angle < 30 || angle > 330) {
      return this.rcs.nose;
    }
    // Tail aspect: ±30° from 180°
    else if (angle > 150 && angle < 210) {
      return this.rcs.tail;
    }
    // Side aspect: everything else
    else {
      return this.rcs.side;
    }
  }

  getAzimuthFromSAM(samPosition: IPosition2D): number {
    const dx = this.position.x - samPosition.x;
    const dy = this.position.y - samPosition.y;
    return (Math.atan2(dy, dx));
  }

  /**
   * Get RCS from position relative to observer
   * 
   * @param fighterPos - Fighter position {x, y}
   * @param observerPos - Observer position {x, y}
   * @param fighterHeadingDeg - Fighter heading in degrees (0 = +X axis)
   * @returns RCS (m²)
   */
  getRCSFromPosition(
    fighterPos: { x: number; y: number },
    observerPos: { x: number; y: number },
    fighterHeadingDeg: number
  ): number {
    // Vector from fighter to observer
    const dx = observerPos.x - fighterPos.x;
    const dy = observerPos.y - fighterPos.y;

    // Angle to observer (in radians)
    const angleToObserver = (Math.atan2(dy, dx));

    // Relative aspect (angle difference from heading)
    const relativeAspect = angleToObserver - fighterHeadingDeg;

    return this.getRCSAtAspect(relativeAspect);
  }

  /**
   * Calculate HARM flight time
   * 
   * @param distance - Distance to target (km)
   * @returns Flight time (seconds)
   */
  calculateHARMFlightTime(distance: number): number {
    const speedOfSound = 343; // m/s
    const velocityMs = this.harmVelocity * speedOfSound;
    const velocityKmS = velocityMs / 1000;
    return distance / velocityKmS;
  }

  /**
   * Determine if fighter should launch HARM based on strategy
   * 
   * @param distanceToSAM - Current distance to SAM (km)
   * @param samMEMR - SAM's maximum effective missile range (km)
   * @returns True if should launch
   */
  shouldLaunchHARM(distanceToSAM: number, samMEMR: number, samTracking: boolean): boolean {

    if (samTracking) {
      if (distanceToSAM <= samMEMR && this.harmRange < distanceToSAM) {
        return true;
      } else {
        return false;
      }
    }
     
  }
  
}

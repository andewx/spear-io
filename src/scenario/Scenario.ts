/**
 * Scenario environment
 * Defines simulation grid, platforms, and environmental conditions
 */

import { SAMSystem } from './SAMSystem.js';
import { Fighter} from './Fighter.js';
import { ISyntheticFieldConfig, SyntheticPrecipitationField } from '../synthetic/index.js';
import * as storage from '../services/fileStorage.js';
import { IFighterPlatform, ISAMSystem, IScenario, IPosition2D, IEngagementResult, IScenarioPlatform } from '../types/index.js';

//Simplified Missile without dynamics for tracking position during engagement we
// will assume the heading is always at the target unless target is lost

type TMissile = {
  position:IPosition2D;
  velocity:number; // km/s
  heading:number; // degrees
  status: 'active' | 'kill' | 'missed';
  launchedBy: 'sam' | 'fighter';
  timeOfLaunch: number; // seconds
  timeOfImpact:number; //seconds
  maxRange?:number; // km memr
  target: SAMSystem | Fighter;
}

// Factory Method for TMissile Creation
function createMissile(position:IPosition2D, velocity:number, heading:number, launchedBy:'sam' | 'fighter', timeOfLaunch:number, target: SAMSystem | Fighter, maxRange?:number): TMissile {
  return {
    position,
    velocity,
    heading,
    status: 'active',
    launchedBy,
    timeOfLaunch,
    timeOfImpact: 0,
    target,
    maxRange
  };
}

const MAX_SIMULATION_TIME = 600; // seconds

export class Scenario {
  public readonly id: string;
  public readonly timeStep: number;
  public timeElapsed: number = 0;
  public readonly scenario: IScenario;
  public readonly sams: IScenarioPlatform[];
  public readonly fighters: IScenarioPlatform[];
  private missiles: Array<TMissile> = [];
  private isEngagementComplete: boolean = false;
  public scenarioSams: SAMSystem[];
  public scenarioFighters: Fighter[];


  /**
   * Private constructor - use static create() method instead
   * This enforces async initialization through the factory pattern
   */
   constructor(
    scenario: IScenario,
    sams: SAMSystem[],
    fighters: Fighter[],
    timeStep: number
  ) {
    this.id = scenario.id;
    this.scenario = scenario;
    this.timeStep = timeStep ?? scenario.timeStep;
    this.sams = scenario.platforms.sams;
    this.fighters = scenario.platforms.fighters;
    this.scenarioSams = sams;
    this.scenarioFighters = fighters;
  }

  /**
   * Static factory method for async initialization
   * Use this instead of constructor: const scenario = await Scenario.create(...)
   * 
   * Supports both legacy single-platform format and new array format
   */
  static async create(scenario: IScenario, timeStep?: number): Promise<Scenario> {
    // Handle legacy format migration - convert old single platform format to new array format
  
    const samPlatforms: SAMSystem[] = [];
    const fighterPlatforms: Fighter[] = [];
    
    // For now, use first SAM and first fighter (multi-platform support coming later)
    if (scenario.platforms.sams.length === 0) {
      throw new Error('Scenario must have at least one SAM system');
    }
    if (scenario.platforms.fighters.length === 0) {
      throw new Error('Scenario must have at least one fighter');
    }

    for (const samPlatformData of scenario.platforms.sams) {
      const samPlatform = await storage.loadSAMPlatform(samPlatformData.id);
      if (!samPlatform) {
        console.log(`\nSAM Platforms in Scenario: ${JSON.stringify(scenario.platforms.sams)}`);
        console.log(`\nSAM Platform Data: ${JSON.stringify(samPlatformData)}`);
        throw new Error(`SAM platform not found: ${samPlatformData.id}`);
      }

      // create SAMSystem instance
      const samSystem = new SAMSystem(samPlatform, scenario);
      await samSystem.radar.loadITUData();
      await samSystem.initPrecipitationField(scenario);
      samSystem.position = samPlatformData.position;
      samPlatforms.push(samSystem);
    }
    let fighterIndex = 0;
    for (const fighterPlatformData of scenario.platforms.fighters) {
      
      const fighterPlatform = await storage.loadFighterPlatform(fighterPlatformData.id);
      if (!fighterPlatform) {
        throw new Error(`Fighter platform not found: ${fighterPlatformData.id}`);
      }

      const fighterId = `${fighterPlatformData.id}-${fighterIndex++}`;

      try{
        const fighter = new Fighter(fighterPlatformData, fighterPlatformData.position, fighterPlatformData.heading);
        fighter.id = fighterId;
        fighter.heading = fighterPlatformData.heading * (Math.PI / 180); // Convert to radians
        fighterPlatforms.push(fighter);
        console.log(`Created Fighter ID: ${fighter.id} at position (${fighter.position.x}, ${fighter.position.y}) with heading ${fighter.heading} radians`);
      }catch(e){
        console.log(`\nFighter Platforms in Scenario: ${JSON.stringify(scenario.platforms.fighters)}`);
        console.log(`\nFighter Platform Data: ${JSON.stringify(fighterPlatformData)}`);
        console.error(`Error creating Fighter instance: ${e}`);
      }
      fighterIndex++;
      
    }


    // Return fully initialized Scenario
    return new Scenario(scenario, samPlatforms, fighterPlatforms, timeStep);
  }


  engagementComplete(): boolean {
    return this.isEngagementComplete;
  }

  updateSAMTrackingStatus(): void {
    for (const samSystem of this.scenarioSams) {
      for (const fighter of this.scenarioFighters) {
        
        const distance = Math.sqrt(
          Math.pow(fighter.position.x - samSystem.position.x, 2) +
          Math.pow(fighter.position.y - samSystem.position.y, 2)
        );
        const azimuth = samSystem.getAzimuthToTarget(fighter.position);
        const rcs = fighter.getRCSFromPosition(fighter.position, samSystem.position, fighter.heading);
        const pulses = 1;
        const range = samSystem.getRangeAtAzimuth(azimuth);
        const detectionRange = samSystem.calculateDetectionRange(rcs, pulses, range);

        if (distance <= detectionRange) {
          // Check if target id is already tracked
          
          const retObj = samSystem.trackedTargets.get(fighter.id);
          if (retObj) {
            retObj.timeElapsedTracking += this.timeStep;
            retObj.distance = distance;
            retObj.azimuth = azimuth;
            retObj.status = 'tracking';
          }else{
            // New track
            samSystem.trackedTargets.set(fighter.id, {
              id: fighter.id,
              acquisitionTime: this.timeElapsed,
              distance: distance,
              azimuth: azimuth,
              status: 'tracking',
              timeElapsedTracking: this.timeStep,
            });
          }
        } else {
          samSystem.trackedTargets.delete(fighter.id);
        }

      }
    }
  }


 SAMDetectionAndEngagementLogic() {
    for (const samSystem of this.scenarioSams) {
      // Get tracked targets by SAM
      for (const [targetId, track] of samSystem.trackedTargets) {
        const targetFighter = this.scenarioFighters.find(f => f.id === targetId);
        if (targetFighter) {
          const distance = track.distance;

          if(distance <= samSystem.properties.memr){
            // Target within MEMR
            const timeSinceLastLaunch = this.timeElapsed - samSystem.status.lastLaunchTime;
            if (track.timeElapsedTracking >= samSystem.properties.autoAcquisitionTime && (timeSinceLastLaunch >= samSystem.launchIntervalSec)) {
              //Launch missile if not already launched
              if (samSystem.status.missilesRemaining > 0) {
                const speedOfSound = 343; // m/s
                const missileVelocityKmS = (samSystem.missileVelocity * speedOfSound) / 1000;
                const azimuth = samSystem.getAzimuthToTarget(targetFighter.position);
                const missilePosition = { x: samSystem.position.x, y: samSystem.position.y };
                this.missiles.push(createMissile(missilePosition, missileVelocityKmS, azimuth, 'sam', this.timeElapsed, targetFighter, samSystem.properties.memr));
                samSystem.status.missilesRemaining--;
                samSystem.status.lastLaunchTime = this.timeElapsed;
              }                // Launch missile logic here
            }
          }
          // ============================================================================
        }
      } 
    }
}


fighterLaunchHARMLogic() {
    for (const fighter of this.scenarioFighters) {
      // If the SAM is tracking any fighter, any fighter within range may launch HARM - ignore attenuation between fighter and SAM for now
      for (const samSystem of this.scenarioSams) {
        const distance = Math.sqrt(Math.pow(fighter.position.x - samSystem.position.x,2) + Math.pow(fighter.position.y - samSystem.position.y,2));
        if (distance <= fighter.harmRange){
          // Check if SAM is actively tracking any fighter
          if (samSystem.trackedTargets.size > 0 && fighter.missilesRemaining > 0) {
            // Fighter may launch HARM
            const speedOfSound = 343; // m/s
            const harmVelocityKmS = (fighter.harmVelocity * speedOfSound) / 1000;
            const azimuth = fighter.getAzimuthToTarget(samSystem.position);
            const missilePosition = { x: fighter.position.x, y: fighter.position.y };
            this.missiles.push(createMissile(missilePosition, harmVelocityKmS, azimuth, 'fighter', this.timeElapsed, samSystem));
            fighter.missilesRemaining--;
          }
        }
      }
    }
  }


  /**
   * Update missile tracking status and heading based on target tracking
   */
  private updateMissileTracking(): void {
    const anglePerturbationRad = (Math.PI / 180) * 5; // 5 degree max perturbation

    for (const missile of this.missiles) {
      if (missile.status !== 'active') continue;

      // Check if the launching platform is tracking
      let isTracking = false;
      if (missile.launchedBy === 'sam') {
        const launchingSAM = this.scenarioSams.find(sam => sam.trackedTargets.has((missile.target as Fighter).id));
        isTracking = launchingSAM !== undefined;
      } else {
        // HARM missiles don't need target tracking
        isTracking = true;
      }

      if (!isTracking) {
        // Add random perturbation when not tracking
        missile.heading += (Math.random() * 2 - 1) * anglePerturbationRad;
      } else {
        // Adjust heading toward target with 30G turn rate limit
        const dx = missile.target.position.x - missile.position.x;
        const dy = missile.target.position.y - missile.position.y;

        const currentHeading = Math.atan2(dy, dx);
        const prevHeading = missile.heading;
        const updateHeading = this.updateHeading(prevHeading, currentHeading);
        const headingDiff = updateHeading - prevHeading;

        // Derive turn rate limit based on velocity
        const velMetersPerSec = missile.velocity * 343; // km/s to m/s
        const maxGForce = 9.8 * 30; // 30G
        const maxTurnRate = maxGForce / velMetersPerSec; // radians per second

        if (Math.abs(headingDiff) > maxTurnRate * this.timeStep) {
          missile.heading += (maxTurnRate * this.timeStep) * (headingDiff > 0 ? 1 : -1);
        } else {
          missile.heading = updateHeading;
        }
      }
    }
  }

  /**
   * Update missile positions based on velocity and heading
   */
  private updateMissilePositions(): void {
    for (const missile of this.missiles) {
      if (missile.status === 'active') {
        const headingRad = missile.heading;
        missile.position.x += missile.velocity * Math.cos(headingRad) * this.timeStep;
        missile.position.y += missile.velocity * Math.sin(headingRad) * this.timeStep;
      }
    }
  }

  /**
   * Update fighter evasive maneuvers (6G max)
   */
  private updateFighterManeuvers(): void {
    for (const fighter of this.scenarioFighters) {
      if (fighter.maneuvers === 'evasive') {
        // Find nearest SAM to evade
        let nearestSAM: SAMSystem | null = null;
        let minDistance = Infinity;
        
        for (const sam of this.scenarioSams) {
          const dx = sam.position.x - fighter.position.x;
          const dy = sam.position.y - fighter.position.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance < minDistance) {
            minDistance = distance;
            nearestSAM = sam;
          }
        }

        if (nearestSAM) {
          const maxGForce = 9.8 * 6; // 6G
          const velMetersPerSec = fighter.velocity * 343; // km/s to m/s
          const maxTurnRate = maxGForce / velMetersPerSec; // radians per second
          
          const angleToSAMRad = Math.atan2(
            nearestSAM.position.y - fighter.position.y,
            nearestSAM.position.x - fighter.position.x
          );
          const desiredHeadingRad = angleToSAMRad + Math.PI; // Away from SAM
          const prevHeading = fighter.heading;
          const updateHeading = this.updateHeading(prevHeading, desiredHeadingRad);
          const headingDiffRad = updateHeading - prevHeading;

          if (Math.abs(headingDiffRad) > maxTurnRate * this.timeStep) {
            fighter.heading += (maxTurnRate * this.timeStep) * (headingDiffRad > 0 ? 1 : -1);
          } else {
            fighter.heading += headingDiffRad;
          }
        }
      }
    }
  }

  /**
   * Update fighter positions based on velocity and heading
   */
  private updateFighterPositions(): void {
    for (const fighter of this.scenarioFighters) {
      if (fighter.state === 'active') {
        const speedOfSound = 343; // m/s
        const velocityMs = fighter.velocity * speedOfSound;
        const velocityKmS = velocityMs / 1000;
        const distanceKm = velocityKmS * this.timeStep;
        const headingRad = fighter.heading;

        fighter.position.x += distanceKm * Math.cos(headingRad);
        fighter.position.y += distanceKm * Math.sin(headingRad);
      }
    }
  }

  /**
   * Evaluate missile kill criteria and update status
   */
  private evaluateKillCriteria(): void {
    for (const missile of this.missiles) {
      if (missile.status === 'active') {
        const previousPosition = { ...missile.position };
        const targetPosition = missile.target.position;
        const intercepted = this.checkMissileIntercept(missile, targetPosition, previousPosition);
        
        if (intercepted) {
          missile.status = 'kill';
          missile.timeOfImpact = this.timeElapsed;
          missile.target.state = 'destroyed';
        } else {
          // Check if missile has exceeded max range
          const distanceTraveled = missile.velocity * (this.timeElapsed - missile.timeOfLaunch);
          if (missile.maxRange && distanceTraveled >= missile.maxRange) {
            missile.status = 'missed';
          }
        }
      }
    }
  }

  /**
   * Check if simulation is complete
   */
  private checkSimulationComplete(): boolean {
    // Check if any platform is destroyed
    const anyPlatformDestroyed = 
      this.scenarioSams.some(sam => sam.state === 'destroyed') ||
      this.scenarioFighters.some(fighter => fighter.state === 'destroyed');
    
    if (anyPlatformDestroyed) {
      return true;
    }

    // Check if all missiles have resolved
    const allMissilesResolved = this.missiles.every(m => m.status !== 'active');
    if (this.missiles.length > 0 && allMissilesResolved) {
      return true;
    }

    // Cap simulation time
    if (this.timeElapsed >= MAX_SIMULATION_TIME) {
      return true;
    }

    return false;
  }

  /**
   * Advance scenario by time step and update platform states
   */
  advanceSimulationTimeStep(): boolean {
    this.timeElapsed += this.timeStep;
    
    // Update SAM tracking status for all SAMs and fighters
    this.updateSAMTrackingStatus();

    // SAM detection and missile launch logic
    this.SAMDetectionAndEngagementLogic();

    // Fighter HARM launch logic
    this.fighterLaunchHARMLogic();

    // Update missile tracking and heading
    this.updateMissileTracking();

    // Update missile positions
    this.updateMissilePositions();

    // Update fighter evasive maneuvers
    this.updateFighterManeuvers();

    // Update fighter positions
    this.updateFighterPositions();

    // Evaluate kill criteria
    this.evaluateKillCriteria();

    // Check if simulation is complete
    const simulationComplete = this.checkSimulationComplete();
    this.isEngagementComplete = simulationComplete;
    
    return simulationComplete;
  }


  resetScenario(): void {
    this.timeElapsed = 0;
    this.isEngagementComplete = false;
    this.missiles = [];
}

getTimeElapsed(): number {
    return this.timeElapsed; 
}

  getMissiles(): Array<TMissile> {
    return this.missiles;
  }

engagementResult(): IEngagementResult {
  
  let missileResultsArray = [];

  for (const missile of this.missiles) {
    missileResultsArray.push({
      id: missile.launchedBy === 'sam' ? `SAM-Missile-${missile.timeOfLaunch}` : `HARM-Missile-${missile.timeOfLaunch}`,
      launchedBy: missile.launchedBy,
      launchTime: missile.timeOfLaunch,
      timeOfImpact: missile.status === 'kill' ? missile.timeOfImpact : null,
      impactPosition: missile.status ==='kill' ? missile.target.position : null,
      status: missile.status,
    });
  }

  const missileResults = {
    missiles: missileResultsArray
  };

  // Success if all SAMs are destroyed
  const success = this.scenarioSams.every(sam => sam.state === 'destroyed');

  
  const result: IEngagementResult = {
    scenarioId: this.scenario.id,
    missileResults: missileResults,
    success,  
    timestamp: new Date(),
  };
  return result;
} 


 wrapToPi( a: number): number
{
    return Math.atan2(Math.sin(a), Math.cos(a));
}

 updateHeading( prev: number,  current: number): number
{
    const delta = this.wrapToPi(current - prev);
    return prev + delta;
}


  /**
   * Apply RCS and Pulse Integration to array and return array
   * @param azimuthDeg 
   * @param rcs 
   * @returns 
   */


  /**
   * Get fighter RCS as seen from SAM position
   */
  getFighterRCSFromSAM(fighter:Fighter, samSystem:SAMSystem): number {
    return fighter.getRCSFromPosition(
      fighter.position,
      samSystem.position,
      fighter.heading
    );
  }


  /**
   * Need to check between time steps if either missile intercepted its target
   * by raycast method
   */

  checkMissileIntercept(missile: TMissile, targetPos: IPosition2D, previousMissilePos: IPosition2D): boolean {
    
    // Define kill radius
    const killRadius = missile.launchedBy === 'sam' ?1.0:5.0;// 0.02 : 0.05; // km

    // Simple case test the distance at current position
    const dxCurrent = missile.position.x - targetPos.x;
    const dyCurrent = missile.position.y - targetPos.y;
    const distanceCurrent = Math.sqrt(dxCurrent * dxCurrent + dyCurrent * dyCurrent);
    if (distanceCurrent <= killRadius) {
      return true;
    }
    
    // Raycast method - calculate perpendicular distance from target to missile path
    const mx = missile.position.x - previousMissilePos.x;
    const my = missile.position.y - previousMissilePos.y;
    const tx = targetPos.x - previousMissilePos.x;
    const ty = targetPos.y - previousMissilePos.y;


    // Matrix expanded solution
    const x1 = missile.position.x;
    const y1 = missile.position.y;
    const x2 = targetPos.x;
    const y2 = targetPos.y

    // Magnitudes
    const magM = Math.sqrt(mx*mx + my*my);
    const magT = Math.sqrt(x2 * x2 + y2 * y2);

    // Target Perpendicular direction
    const theta = Math.acos((mx * x2 + my * y2)/(magM * magT));
    const thetaP = (Math.PI / 2) - theta;
    const ex = Math.cos(thetaP);
    const ey = Math.sin(thetaP);

    const t =  ((x2-x1)*ey + (y2 - y1)*ex)/(mx*ey - my*ex);
    const u = ((x2 - x1)*my - (y2 - y1)*mx)/(mx*ey - my*ex);

    // Intersection point
    const ix = (x1 + t*mx);
    const iy = (y1 + t*my);

    // Intersection distance
    const intersectionDistance = Math.sqrt((ix - targetPos.x)*(ix - targetPos.x) + (iy - targetPos.y)*(iy - targetPos.y));

    // Check if intersection point is within missile segment
    if (t < 0 || t > 1) {
      return false;
    }

    // Check if within kill radius
    const perpDist = intersectionDistance;

    return perpDist <= killRadius;
  }


  /**
   * Get current scenario state snapshot
   */
  async getState() {
    return {
      sams: this.scenarioSams,
      fighters: this.scenarioFighters,
      missiles: this.missiles,
      timeElapsed: this.timeElapsed,
      isEngagementComplete: this.isEngagementComplete,
    };
  }
}

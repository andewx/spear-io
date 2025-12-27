/**
 * File storage service for JSON persistence
 * Handles reading/writing platform, scenario, and session data
 */

import { promises as fs } from 'fs';
import path from 'path';
import type { ISAMSystem, IFighterPlatform, IScenario, ISession } from '../types/index.js';

const DATA_DIR = path.join(process.cwd(), 'src', 'data');
const PLATFORMS_DIR = path.join(DATA_DIR, 'platforms');
const SCENARIOS_DIR = path.join(DATA_DIR, 'scenarios');
const SESSIONS_DIR = path.join(DATA_DIR, 'session');

/**
 * Ensure directory exists, create if not
 */
async function ensureDir(dirPath: string): Promise<void> {
  try {
    await fs.access(dirPath);
  } catch {
    await fs.mkdir(dirPath, { recursive: true });
  }
}

/**
 * Initialize all data directories
 */
export async function initializeDataDirectories(): Promise<void> {
  await Promise.all([
    ensureDir(PLATFORMS_DIR),
    ensureDir(SCENARIOS_DIR),
    ensureDir(SESSIONS_DIR),
  ]);
}

// ============================================================================
// Generic File Operations
// ============================================================================

async function readJSON<T>(filePath: string): Promise<T> {
  const content = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(content) as T;
}

async function writeJSON<T>(filePath: string, data: T): Promise<void> {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

async function listJSONFiles(dirPath: string): Promise<string[]> {
  const files = await fs.readdir(dirPath);
  return files.filter(f => f.endsWith('.json'));
}

async function deleteFile(filePath: string): Promise<void> {
  await fs.unlink(filePath);
}

// ============================================================================
// Platform Operations
// ============================================================================

export async function saveSAMPlatform(platform: ISAMSystem): Promise<void> {
  const filePath = path.join(PLATFORMS_DIR, `sam_${platform.id}.json`);
  await writeJSON(filePath, platform);
}

export async function saveFighterPlatform(platform: IFighterPlatform): Promise<void> {
  const filePath = path.join(PLATFORMS_DIR, `fighter_${platform.id}.json`);
  await writeJSON(filePath, platform);
}

export async function loadSAMPlatform(id: string): Promise<ISAMSystem | null> {
  const filePath = path.join(PLATFORMS_DIR, `sam_${id}.json`);
  try {
    const data = await readJSON<any>(filePath);
    
    // Handle legacy format (pre-refactor) - check if it has the old structure
    const isLegacyFormat = data.radar && data.radar.nominalRange !== undefined && !data.radar.range;
    
    if (isLegacyFormat) {
      // Legacy format - migrate to new structure
      // Create radar model from legacy data using createRadar if available
      // For now, return null to force re-creation or manual migration
      console.warn(`Platform ${id} uses legacy format and needs migration`);
      return null;
    }
    
    // Coerce string numbers to actual numbers for new format
    return {
      id: data.id,
      name: data.name,
      range: Number(data.range),
      frequency: Number(data.frequency),
      radar: {
        range: Number(data.radar.range),
        antennaGain: Number(data.radar.antennaGain),
        frequency: Number(data.radar.frequency),
        wavelength: Number(data.radar.wavelength),
        noiseFloor: Number(data.radar.noiseFloor),
        pd: Number(data.radar.pd),
        min_dbm: Number(data.radar.min_dbm),
        min_watts: Number(data.radar.min_watts),
        min_snr: Number(data.radar.min_snr),
        emitterPower: Number(data.radar.emitterPower),
      },
      memr: Number(data.memr),
      vel: Number(data.vel),
    } as ISAMSystem;
  } catch (error) {
    console.error(`Error loading SAM platform ${id}:`, error);
    return null;
  }
}

export async function loadFighterPlatform(id: string): Promise<IFighterPlatform | null> {
  const filePath = path.join(PLATFORMS_DIR, `fighter_${id}.json`);
  try {
    const data = await readJSON<any>(filePath);
    // Coerce string numbers to actual numbers
    return {
      id: data.id,
      type: data.type,
      velocity: Number(data.velocity),
      rcs: {
        nose: Number(data.rcs.nose),
        tail: Number(data.rcs.tail),
        side: Number(data.rcs.side),
        top: Number(data.rcs.top ?? data.rcs.side),
        bottom: Number(data.rcs.bottom ?? data.rcs.side),
      },
      harmParams: {
        velocity: Number(data.harmParams.velocity),
        range: Number(data.harmParams.range),
        launchPreference: data.harmParams.launchPreference,
        memrRatio: data.harmParams.memrRatio ? Number(data.harmParams.memrRatio) : undefined,
      },
    } as IFighterPlatform;
  } catch {
    return null;
  }
}

export async function listAllPlatforms(): Promise<{ sams: ISAMSystem[]; fighters: IFighterPlatform[] }> {
  const files = await listJSONFiles(PLATFORMS_DIR);
  const sams: ISAMSystem[] = [];
  const fighters: IFighterPlatform[] = [];

  for (const file of files) {
    const filePath = path.join(PLATFORMS_DIR, file);
    if (file.startsWith('sam')) {
      const sam = await readJSON<ISAMSystem>(filePath);
      sams.push(sam);
    } else if (file.startsWith('fighter')) {
      const fighter = await readJSON<IFighterPlatform>(filePath);
      fighters.push(fighter);
    }
  }

  return { sams, fighters };
}


export async function deletePlatform(id: string, type: 'sam' | 'fighter'): Promise<boolean> {
  const prefix = type === 'sam' ? 'sam' : 'fighter';
  const filePath = path.join(PLATFORMS_DIR, `${prefix}${id}.json`);
  try {
    await deleteFile(filePath);
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// Scenario Operations
// ============================================================================

export async function saveScenario(scenario: IScenario): Promise<void> {
  const filePath = path.join(SCENARIOS_DIR, `${scenario.id}.json`);
  await writeJSON(filePath, scenario);
}

export async function loadScenario(id: string): Promise<IScenario | null> {
  const filePath = path.join(SCENARIOS_DIR, `${id}.json`);
  try {
    const data = await readJSON<any>(filePath);
    
    // Handle both legacy format (sam/fighter objects) and new format (sams/fighters arrays)
    let platforms: any;
    if (data.platforms.sams && data.platforms.fighters) {
      // New format - load platform configs for each
      const sams = await Promise.all(
        data.platforms.sams.map(async (sam: any) => {
          const config = await loadSAMPlatform(sam.configId);
          return {
            id: sam.id,
            type: 'sam' as const,
            platform: config,
            position: {
              x: Number(sam.position.x),
              y: Number(sam.position.y),
            },
            velocity: Number(sam.velocity || 0),
            heading: Number(sam.heading || 0),
          };
        })
      );
      
      const fighters = await Promise.all(
        data.platforms.fighters.map(async (fighter: any) => {
          const config = await loadFighterPlatform(fighter.configId);
          return {
            id: fighter.id,
            type: 'fighter' as const,
            platform: config,
            position: {
              x: Number(fighter.position.x),
              y: Number(fighter.position.y),
            },
            velocity: Number(fighter.velocity || 0.8),
            heading: Number(fighter.heading || 0),
            data: fighter.data || (fighter.flightPath ? { flightPath: fighter.flightPath } : {}),
          };
        })
      );
      
      platforms = { sams, fighters };
    } else {
      // Legacy format - convert to new format
      const samConfig = await loadSAMPlatform(data.platforms.sam.configId);
      const fighterConfig = await loadFighterPlatform(data.platforms.fighter.configId);
      
      platforms = {
        sams: [{
          id: 'sam-1',
          type: 'sam' as const,
          platform: samConfig,
          position: {
            x: Number(data.platforms.sam.position.x),
            y: Number(data.platforms.sam.position.y),
          },
          velocity: 0,
          heading: Number(data.platforms.sam.heading),
        }],
        fighters: [{
          id: 'fighter-1',
          type: 'fighter' as const,
          platform: fighterConfig,
          position: {
            x: Number(data.platforms.fighter.position.x),
            y: Number(data.platforms.fighter.position.y),
          },
          velocity: Number(data.platforms.fighter.velocity || 0.8),
          heading: Number(data.platforms.fighter.heading),
          data: data.platforms.fighter.flightPath ? { flightPath: data.platforms.fighter.flightPath.type } : {},
        }],
      };
    }
    
    return {
      id: data.id,
      name: data.name,
      description: data.description,
      timeStep: Number(data.timeStep),
      grid: {
        width: Number(data.grid.width),
        height: Number(data.grid.height),
        resolution: Number(data.grid.resolution),
      },
      platforms,
      environment: {
        precipitation: {
          enabled: Boolean(data.environment.precipitation.enabled),
          nominalRainRate: Number(data.environment.precipitation.nominalRainRate),
          nominalCellSize: Number(data.environment.precipitation.nominalCellSize),
          nominalCoverage: Number(data.environment.precipitation.nominalCoverage),
          alpha: Number(data.environment.precipitation.alpha),
          maxRainRateCap: Number(data.environment.precipitation.maxRainRateCap),
          sigmoidK: Number(data.environment.precipitation.sigmoidK),
          seed: data.environment.precipitation.seed ? Number(data.environment.precipitation.seed) : undefined,
        },
      },
      precipitationFieldImage: data.precipitationFieldImage,
      createdAt: data.createdAt ? new Date(data.createdAt) : undefined,
      updatedAt: data.updatedAt ? new Date(data.updatedAt) : undefined,
    } as IScenario;
  } catch (error) {
    console.error(`Error loading scenario ${id}:`, error);
    return null;
  }
}

export async function listAllScenarios(): Promise<IScenario[]> {
  const files = await listJSONFiles(SCENARIOS_DIR);
  const scenarios: IScenario[] = [];

  for (const file of files) {
    const filePath = path.join(SCENARIOS_DIR, file);
    const scenario = await readJSON<IScenario>(filePath);
    scenarios.push(scenario);
  }

  return scenarios;
}

export async function deleteScenario(id: string): Promise<boolean> {
  const filePath = path.join(SCENARIOS_DIR, `${id}.json`);
  try {
    await deleteFile(filePath);
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// Session Operations
// ============================================================================

export async function saveSession(session: ISession): Promise<void> {
  const filePath = path.join(SESSIONS_DIR, `${session.id}.json`);
  await writeJSON(filePath, session);
}

export async function loadSession(id: string): Promise<ISession | null> {
  const filePath = path.join(SESSIONS_DIR, `${id}.json`);
  try {
    return await readJSON<ISession>(filePath);
  } catch {
    return null;
  }
}

export async function deleteSession(id: string): Promise<boolean> {
  const filePath = path.join(SESSIONS_DIR, `${id}.json`);
  try {
    await deleteFile(filePath);
    return true;
  } catch {
    return false;
  }
}

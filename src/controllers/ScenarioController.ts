/**
 * Scenario Controller
 * Handles scenario CRUD operations
 */

import type { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import * as storage from '../services/fileStorage.js';
import { sendView, sendViewOrJSON } from '../services/templateRenderer.js';
import type { IScenario, IScenarioPlatform, TAPIResponse } from '../types/index.js';

export class ScenarioController {
  /**
   * GET /api/scenarios or /scenarios
   * List all scenarios
   */
  async listAll(req: Request, res: Response): Promise<void> {
    try {
      const scenarios = await storage.listAllScenarios();
      
      // Check if this is a web request (not an API request)
      const isAPIRequest = req.originalUrl.startsWith('/api/');
      if (!isAPIRequest) {
        await sendView(res, 'scenarios', {
          scenarios,
        }, {
          title: 'Scenarios',
          page: 'scenarios',
        });
        return;
      }
      
      const response: TAPIResponse<typeof scenarios> = {
        success: true,
        data: scenarios,
      };
      res.json(response);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  /**
   * GET /api/scenarios/:id
   * Get specific scenario by ID
   */
  async getById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const scenario = await storage.loadScenario(id);

      if (!scenario) {
        const response: TAPIResponse<never> = {
          success: false,
          error: 'Scenario not found',
        };
        res.status(404).json(response);
        return;
      }

      const response: TAPIResponse<typeof scenario> = {
        success: true,
        data: scenario,
      };
      res.json(response);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  /**
   * POST /api/scenarios
   * Create new scenario
   */
  async create(req: Request, res: Response): Promise<void> {
    try {
      const data = req.body as any;
      
      // Parse platform arrays from form data
      const scenario = await this.parseScenarioFromFormData(data);

      //Load platforms for each platform entry and attach the object to the platform
      for (const sam of scenario.platforms.sams) {
        const samConfig = await storage.loadSAMPlatform(sam.configId);
        if (!samConfig) {
          throw new Error(`SAM platform not found: ${sam.configId}`);
        }
        sam.platform = samConfig;
      }
      for (const fighter of scenario.platforms.fighters) {
        const fighterConfig = await storage.loadFighterPlatform(fighter.configId);
        if (!fighterConfig) {
          throw new Error(`Fighter platform not found: ${fighter.configId}`);
        }
        fighter.platform = fighterConfig;
      }



      // Generate ID and timestamps if not provided
      if (!scenario.id) {
        scenario.id = randomUUID();
      }
      scenario.createdAt = new Date();
      scenario.updatedAt = new Date();


      await storage.saveScenario(scenario);

      const response: TAPIResponse<typeof scenario> = {
        success: true,
        data: scenario,
      };
      res.status(201).json(response);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  /**
   * PUT /api/scenarios/:id
   * Update existing scenario
   */
  async update(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const data = req.body as any;

      // Parse platform arrays from form data
      const scenario = await this.parseScenarioFromFormData(data);


      //Load platforms for each platform entry and attach the object to the platform
      for (const sam of scenario.platforms.sams) {
        const samConfig = await storage.loadSAMPlatform(sam.configId);
        if (!samConfig) {
          throw new Error(`SAM platform not found: ${sam.configId}`);
        }
        sam.platform = samConfig;
      }
      for (const fighter of scenario.platforms.fighters) {
        const fighterConfig = await storage.loadFighterPlatform(fighter.configId);
        if (!fighterConfig) {
          throw new Error(`Fighter platform not found: ${fighter.configId}`);
        }
        fighter.platform = fighterConfig;
      }

      // Ensure ID matches and update timestamp
      scenario.id = id;
      scenario.updatedAt = new Date();

      console.log('Updated scenario:', JSON.stringify(scenario, null, 2));

      await storage.saveScenario(scenario);

      const response: TAPIResponse<typeof scenario> = {
        success: true,
        data: scenario,
      };
      res.json(response);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  /**
   * DELETE /api/scenarios/:id
   * Delete scenario
   */
  async delete(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteScenario(id);

      if (!deleted) {
        const response: TAPIResponse<never> = {
          success: false,
          error: 'Scenario not found',
        };
        res.status(404).json(response);
        return;
      }

      const response: TAPIResponse<{ deleted: boolean }> = {
        success: true,
        data: { deleted: true },
      };
      res.json(response);
    } catch (error) {
      this.handleError(res, error);
    }
  }



  /**
   * Error handler
   */
  private handleError(res: Response, error: unknown): void {
    const response: TAPIResponse<never> = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    res.status(500).json(response);
  }



  /**
   * Parse scenario data from form submission
   * Handles array-based platform structure from form fields
   */
  private async parseScenarioFromFormData(data: any): Promise<IScenario> {
    // Parse SAM platforms
    const sams: IScenarioPlatform[] = [];
    if (data.platforms?.sams) {
      for (const [indexStr, samData] of Object.entries(data.platforms.sams)) {
        if (typeof samData === 'object' && samData !== null) {
          const configId = (samData as any).id as string;
          const samConfig = await storage.loadSAMPlatform(configId);
          if (!samConfig) {
            throw new Error(`SAM platform not found: ${configId}`);
          }
          
          sams.push({
            id: (samData as any).id || `sam-${indexStr}`,
            configId: configId,
            type: 'sam',
            platform: samConfig,
            position: {
              x: parseFloat((samData as any).position?.x || 0),
              y: parseFloat((samData as any).position?.y || 0),
            },
            velocity: parseFloat((samData as any).velocity || 0),
            heading: parseFloat((samData as any).heading || 0),
          });
        }
      }
    }

    // Parse Fighter platforms
    const fighters: IScenarioPlatform[] = [];
    if (data.platforms?.fighters) {
      for (const [indexStr, fighterData] of Object.entries(data.platforms.fighters)) {
        if (typeof fighterData === 'object' && fighterData !== null) {
          const configId = (fighterData as any).id as string;
          const fighterConfig = await storage.loadFighterPlatform(configId);
          if (!fighterConfig) {
            throw new Error(`Fighter platform not found: ${configId}`);
          }
          
          fighters.push({
            id: (fighterData as any).id || `fighter-${indexStr}`,
            configId: configId,
            type: 'fighter',
            platform: fighterConfig,
            position: {
              x: parseFloat((fighterData as any).position?.x || 0),
              y: parseFloat((fighterData as any).position?.y || 0),
            },
            velocity: parseFloat((fighterData as any).velocity || 0.8),
            heading: parseFloat((fighterData as any).heading || 0),
            flightPath: (fighterData as any).flightPath || 'straight',
          });
        }
      }
    }

    // Parse precipitation config
    const precipitationEnabled = data.environment?.precipitation?.enabled === 'on' 
      || data.environment?.precipitation?.enabled === true;

    const scenario: IScenario = {
      id: data.id,
      name: data.name,
      precipitationFieldImage: data.precipitationFieldImage || undefined,
      precipitationFieldOverlay: data.precipitationFieldOverlay || undefined,
      description: data.description,
      grid: {
        width: parseFloat(data.grid?.width || 800),
        height: parseFloat(data.grid?.height || 450),
        resolution: parseFloat(data.grid?.resolution || 2),
      },
      timeStep: parseFloat(data.timeStep || 0.5),
      platforms: {
        sams,
        fighters,
      },
      environment: {
        precipitation: {
          enabled: precipitationEnabled,
          nominalRainRate: parseFloat(data.environment?.precipitation?.nominalRainRate || 10),
          nominalCellSize: parseFloat(data.environment?.precipitation?.nominalCellSize || 12),
          nominalCoverage: parseFloat(data.environment?.precipitation?.nominalCoverage || 0.35),
          alpha: parseFloat(data.environment?.precipitation?.alpha || 0.1),
          maxRainRateCap: parseFloat(data.environment?.precipitation?.maxRainRateCap || 35),
          sigmoidK: parseFloat(data.environment?.precipitation?.sigmoidK || 10),
        },
      },
    };

    return scenario;
  }
}

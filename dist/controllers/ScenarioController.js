/**
 * Scenario Controller
 * Handles scenario CRUD operations
 */
import { randomUUID } from 'crypto';
import * as storage from '../services/fileStorage.js';
import { sendView } from '../services/templateRenderer.js';
export class ScenarioController {
    /**
     * GET /api/scenarios or /scenarios
     * List all scenarios
     */
    async listAll(req, res) {
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
            const response = {
                success: true,
                data: scenarios,
            };
            res.json(response);
        }
        catch (error) {
            this.handleError(res, error);
        }
    }
    /**
     * GET /api/scenarios/:id
     * Get specific scenario by ID
     */
    async getById(req, res) {
        try {
            const { id } = req.params;
            const scenario = await storage.loadScenario(id);
            if (!scenario) {
                const response = {
                    success: false,
                    error: 'Scenario not found',
                };
                res.status(404).json(response);
                return;
            }
            const response = {
                success: true,
                data: scenario,
            };
            res.json(response);
        }
        catch (error) {
            this.handleError(res, error);
        }
    }
    /**
     * POST /api/scenarios
     * Create new scenario
     */
    async create(req, res) {
        try {
            const data = req.body;
            // Parse platform arrays from form data
            const scenario = await this.parseScenarioFromFormData(data);
            //Load platforms for each platform entry and attach the object to the platform
            for (const sam of scenario.platforms.sams) {
                const samConfig = await storage.loadSAMPlatform(sam.id);
                if (!samConfig) {
                    throw new Error(`SAM platform not found: ${sam.id}`);
                }
                sam.platform = samConfig;
            }
            for (const fighter of scenario.platforms.fighters) {
                fighter.heading = Math.PI / 180 * fighter.heading; // Convert to radians
                const fighterConfig = await storage.loadFighterPlatform(fighter.id);
                if (!fighterConfig) {
                    throw new Error(`Fighter platform not found: ${fighter.id}`);
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
            const response = {
                success: true,
                data: scenario,
            };
            res.status(201).json(response);
        }
        catch (error) {
            this.handleError(res, error);
        }
    }
    /**
     * PUT /api/scenarios/:id
     * Update existing scenario
     */
    async update(req, res) {
        try {
            const { id } = req.params;
            const data = req.body;
            // Parse platform arrays from form data
            const scenario = await this.parseScenarioFromFormData(data);
            //Load platforms for each platform entry and attach the object to the platform
            for (const sam of scenario.platforms.sams) {
                const samConfig = await storage.loadSAMPlatform(sam.id);
                if (!samConfig) {
                    throw new Error(`SAM platform not found: ${sam.id}`);
                }
                sam.platform = samConfig;
            }
            for (const fighter of scenario.platforms.fighters) {
                const fighterConfig = await storage.loadFighterPlatform(fighter.id);
                if (!fighterConfig) {
                    throw new Error(`Fighter platform not found: ${fighter.id}`);
                }
                fighter.platform = fighterConfig;
            }
            // Ensure ID matches and update timestamp
            scenario.updatedAt = new Date();
            await storage.saveScenario(scenario);
            const response = {
                success: true,
                data: scenario,
            };
            res.json(response);
        }
        catch (error) {
            this.handleError(res, error);
        }
    }
    /**
     * DELETE /api/scenarios/:id
     * Delete scenario
     */
    async delete(req, res) {
        try {
            const { id } = req.params;
            const deleted = await storage.deleteScenario(id);
            if (!deleted) {
                const response = {
                    success: false,
                    error: 'Scenario not found',
                };
                res.status(404).json(response);
                return;
            }
            const response = {
                success: true,
                data: { deleted: true },
            };
            res.json(response);
        }
        catch (error) {
            this.handleError(res, error);
        }
    }
    /**
     * Error handler
     */
    handleError(res, error) {
        const response = {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
        res.status(500).json(response);
    }
    /**
     * Parse scenario data from form submission
     * Handles array-based platform structure from form fields
     */
    async parseScenarioFromFormData(data) {
        // Parse SAM platforms
        const sams = [];
        if (data.platforms?.sams) {
            for (const [indexStr, samData] of Object.entries(data.platforms.sams)) {
                if (typeof samData === 'object' && samData !== null) {
                    const configId = samData.id;
                    const samConfig = await storage.loadSAMPlatform(configId);
                    if (!samConfig) {
                        throw new Error(`SAM platform not found: ${configId}`);
                    }
                    sams.push({
                        id: samData.id || `sam-${indexStr}`,
                        configId: configId,
                        type: 'sam',
                        platform: samConfig,
                        position: {
                            x: parseFloat(samData.position?.x || 0),
                            y: parseFloat(samData.position?.y || 0),
                        },
                        velocity: parseFloat(samData.velocity || 0),
                        heading: parseFloat(samData.heading || 0),
                    });
                }
            }
        }
        // Parse Fighter platforms
        const fighters = [];
        if (data.platforms?.fighters) {
            for (const [indexStr, fighterData] of Object.entries(data.platforms.fighters)) {
                if (typeof fighterData === 'object' && fighterData !== null) {
                    const configId = fighterData.id;
                    const fighterConfig = await storage.loadFighterPlatform(configId);
                    if (!fighterConfig) {
                        throw new Error(`Fighter platform not found: ${configId}`);
                    }
                    fighters.push({
                        id: fighterData.id || `fighter-${indexStr}`,
                        configId: configId,
                        type: 'fighter',
                        platform: fighterConfig,
                        position: {
                            x: parseFloat(fighterData.position?.x || 0),
                            y: parseFloat(fighterData.position?.y || 0),
                        },
                        velocity: parseFloat(fighterData.velocity || 0.8),
                        heading: parseFloat(fighterData.heading || 180),
                        flightPath: fighterData.flightPath || 'straight',
                    });
                }
            }
        }
        // Parse precipitation config
        const precipitationEnabled = data.environment?.precipitation?.enabled === 'on'
            || data.environment?.precipitation?.enabled === true;
        const scenario = {
            id: data.id,
            name: data.name,
            precipitationFieldImage: data.precipitationFieldImage || undefined,
            precipitationFieldOverlay: data.precipitationFieldOverlay || undefined,
            precipitationFieldJet: data.precipitationFieldJet || undefined,
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
//# sourceMappingURL=ScenarioController.js.map
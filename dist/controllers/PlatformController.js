/**
 * Platform Controller
 * Handles SAM and Fighter platform operations
 */
import { randomUUID } from 'crypto';
import * as storage from '../services/fileStorage.js';
import { sendView } from '../services/templateRenderer.js';
import { createRadar } from '../services/radarCalculations.js';
export class PlatformController {
    /**
     * GET /api/platforms or /platforms
     * List all platforms (SAMs and Fighters)
     */
    async listAll(req, res) {
        try {
            const platforms = await storage.listAllPlatforms();
            // Check if this is a web request (not an API request)
            const isAPIRequest = req.originalUrl.startsWith('/api/');
            if (!isAPIRequest) {
                await sendView(res, 'platforms', {
                    samSystems: platforms.sams,
                    fighters: platforms.fighters,
                }, {
                    title: 'Platforms',
                    page: 'platforms',
                });
                return;
            }
            const response = {
                success: true,
                data: platforms,
            };
            res.json(response);
        }
        catch (error) {
            this.handleError(res, error);
        }
    }
    /**
     * GET /api/platforms/:type/:id
     * Get specific platform by type and ID
     */
    async getById(req, res) {
        try {
            const { type, id } = req.params;
            if (type !== 'sam' && type !== 'fighter') {
                const response = {
                    success: false,
                    error: 'Invalid platform type. Must be "sam" or "fighter"',
                };
                res.status(400).json(response);
                return;
            }
            const platform = type === 'sam'
                ? await storage.loadSAMPlatform(id)
                : await storage.loadFighterPlatform(id);
            if (!platform) {
                const response = {
                    success: false,
                    error: 'Platform not found',
                };
                res.status(404).json(response);
                return;
            }
            const response = {
                success: true,
                data: platform,
            };
            res.json(response);
        }
        catch (error) {
            this.handleError(res, error);
        }
    }
    /**
     * POST /api/platforms
     * Create new platform
     */
    async create(req, res) {
        try {
            const { type } = req.body;
            let data = req.body.data;
            //Log request data for debugging
            console.log('Create platform request data:', req.body);
            if (type !== 'sam' && type !== 'fighter') {
                const response = {
                    success: false,
                    error: 'Invalid platform type. Must be "sam" or "fighter"',
                };
                res.status(400).json(response);
                return;
            }
            // Map incoming fields from collated platform form element
            if (type === 'sam') {
                let newSam = {
                    id: '',
                    name: '',
                    range: 0,
                    frequency: 0,
                    radar: {},
                    memr: 0,
                    vel: 0
                };
                const samData = data;
                // Map form field names to interface field names
                newSam.id = samData.sam_id || randomUUID();
                newSam.name = samData.sam_name;
                newSam.range = samData.radar?.range;
                newSam.frequency = samData.radar?.frequency;
                newSam.memr = samData.missile?.memr;
                newSam.vel = samData.missile?.vel;
                newSam.radar = createRadar(newSam, samData.radar.antennaGain);
                // Clean up form-specific fields
                delete samData.sam_id;
                delete samData.sam_name;
                delete samData.radar;
                delete samData.acquisition;
                delete samData.missile;
                data = newSam;
            }
            else if (type === 'fighter') {
                const fighterData = data;
                // Map form field names to interface field names
                fighterData.id = fighterData.fighter_id || randomUUID();
                fighterData.type = fighterData.fighter_type;
                fighterData.velocity = fighterData.fighter_velocity;
                fighterData.harmParams = {
                    velocity: fighterData.harm?.velocity,
                    range: fighterData.harm?.range,
                    launchPreference: fighterData.harm?.launchStrategy?.type || 'maxRange',
                    memrRatio: fighterData.harm?.launchStrategy?.memrRatio
                };
                // Clean up form-specific fields
                delete fighterData.fighter_id;
                delete fighterData.fighter_type;
                delete fighterData.fighter_velocity;
                delete fighterData.harm;
                data = fighterData;
            }
            // Ensure ID exists
            if (!data.id) {
                data.id = randomUUID();
            }
            if (type === 'sam') {
                await storage.saveSAMPlatform(data);
            }
            else {
                await storage.saveFighterPlatform(data);
            }
            const response = {
                success: true,
                data,
            };
            res.status(201).json(response);
        }
        catch (error) {
            this.handleError(res, error);
        }
    }
    /**
     * PUT /api/platforms/:type/:id
     * Update existing platform
     */
    async update(req, res) {
        try {
            const { type, id } = req.params;
            let data = req.body.data;
            if (type !== 'sam' && type !== 'fighter') {
                const response = {
                    success: false,
                    error: 'Invalid platform type. Must be "sam" or "fighter"',
                };
                res.status(400).json(response);
                return;
            }
            // Map incoming fields from form element (same as create)
            if (type === 'sam') {
                let newSam = {
                    id: '',
                    name: '',
                    range: 0,
                    frequency: 0,
                    radar: {},
                    memr: 0,
                    vel: 0
                };
                const samData = data;
                // Map form field names to interface field names
                newSam.id = id; // Use ID from URL
                newSam.name = samData.sam_name;
                newSam.range = samData.radar?.range;
                newSam.frequency = samData.radar?.frequency;
                newSam.memr = samData.missile?.memr;
                newSam.vel = samData.missile?.vel;
                newSam.radar = createRadar(newSam, samData.radar.antennaGain);
                data = newSam;
            }
            else if (type === 'fighter') {
                const fighterData = data;
                // Map form field names to interface field names
                fighterData.id = id; // Use ID from URL
                fighterData.type = fighterData.fighter_type;
                fighterData.velocity = fighterData.fighter_velocity;
                fighterData.harmParams = {
                    velocity: fighterData.harm?.velocity,
                    range: fighterData.harm?.range,
                    launchPreference: fighterData.harm?.launchStrategy?.type || 'maxRange',
                    memrRatio: fighterData.harm?.launchStrategy?.memrRatio
                };
                // Clean up form-specific fields
                delete fighterData.fighter_id;
                delete fighterData.fighter_type;
                delete fighterData.fighter_velocity;
                delete fighterData.harm;
                data = fighterData;
            }
            if (type === 'sam') {
                await storage.saveSAMPlatform(data);
            }
            else {
                await storage.saveFighterPlatform(data);
            }
            const response = {
                success: true,
                data,
            };
            res.json(response);
        }
        catch (error) {
            this.handleError(res, error);
        }
    }
    /**
     * DELETE /api/platforms/:type/:id
     * Delete platform
     */
    async delete(req, res) {
        try {
            const { type, id } = req.params;
            if (type !== 'sam' && type !== 'fighter') {
                const response = {
                    success: false,
                    error: 'Invalid platform type. Must be "sam" or "fighter"',
                };
                res.status(400).json(response);
                return;
            }
            const deleted = await storage.deletePlatform(id, type);
            if (!deleted) {
                const response = {
                    success: false,
                    error: 'Platform not found',
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
}
//# sourceMappingURL=PlatformController.js.map
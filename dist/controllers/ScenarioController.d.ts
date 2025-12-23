/**
 * Scenario Controller
 * Handles scenario CRUD operations
 */
import type { Request, Response } from 'express';
export declare class ScenarioController {
    /**
     * GET /api/scenarios or /scenarios
     * List all scenarios
     */
    listAll(req: Request, res: Response): Promise<void>;
    /**
     * GET /api/scenarios/:id
     * Get specific scenario by ID
     */
    getById(req: Request, res: Response): Promise<void>;
    /**
     * POST /api/scenarios
     * Create new scenario
     */
    create(req: Request, res: Response): Promise<void>;
    /**
     * PUT /api/scenarios/:id
     * Update existing scenario
     */
    update(req: Request, res: Response): Promise<void>;
    /**
     * DELETE /api/scenarios/:id
     * Delete scenario
     */
    delete(req: Request, res: Response): Promise<void>;
    /**
     * Error handler
     */
    private handleError;
    /**
     * Parse scenario data from form submission
     * Handles array-based platform structure from form fields
     */
    private parseScenarioFromFormData;
}
//# sourceMappingURL=ScenarioController.d.ts.map
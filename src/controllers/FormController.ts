/**
 * Form Controller
 * Handles dynamic form rendering for overlays
 */

import type { Request, Response } from 'express';
import { sendView } from '../services/templateRenderer.js';
import * as storage from '../services/fileStorage.js';

export class FormController {
  /**
   * GET /forms/platform/create
   * Render platform creation form
   */
  async platformCreate(_req: Request, res: Response): Promise<void> {
    try {
      // Render just the form content (no layout)
      const typePlatform = _req.query.type as string;
      await sendView(res, 'forms/platform-create', { typePlatform }, { layout: false });
    } catch (error) {
      process.stderr.write(`Error rendering platform create form: ${error}\n`);
      res.status(500).send('<div class="alert alert-danger">Error loading form</div>');
    }
  }

  /**
   * GET /forms/scenario/create
   * Render scenario creation form
   */
  async scenarioCreate(_req: Request, res: Response): Promise<void> {
    try {
    
      //Log that we hit the endpoint
      console.log('Rendering scenario creation form');
      // Load platforms for dropdowns
      const platforms = await storage.listAllPlatforms();
      
      // Render form content without layout
      await sendView(res, 'forms/scenario-create', {
        samSystems: platforms.sams,
        fighters: platforms.fighters,
      }, { layout: false });
    } catch (error) {
      process.stderr.write(`Error rendering scenario create form: ${error}\n`);
      res.status(500).send('<div class="alert alert-danger">Error loading form</div>');
    }
  }

  /**
   * GET /forms/scenario/edit/:id
   * Render scenario edit form
   */
  async scenarioEdit(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      // Load scenario and platforms
      const [scenario, platforms] = await Promise.all([
        storage.loadScenario(id),
        storage.listAllPlatforms(),
      ]);

      if (!scenario) {
        res.status(404).send('<div class="alert alert-danger">Scenario not found</div>');
        return;
      }

      // Render edit form (similar to create, but pre-populated)
      await sendView(res, 'forms/scenario-edit', {
        scenario,
        samSystems: platforms.sams,
        fighters: platforms.fighters,
      }, { layout: false });
    } catch (error) {
      process.stderr.write(`Error rendering scenario edit form: ${error}\n`);
      res.status(500).send('<div class="alert alert-danger">Error loading form</div>');
    }
  }

  /**
   * GET /forms/platform/edit/:type/:id
   * Render platform edit form
   */
  async platformEdit(req: Request, res: Response): Promise<void> {
    try {
      const { type, id } = req.params;

      if (type !== 'sam' && type !== 'fighter') {
        res.status(400).send('<div class="alert alert-danger">Invalid platform type</div>');
        return;
      }

      const platform = type === 'sam'
        ? await storage.loadSAMPlatform(id)
        : await storage.loadFighterPlatform(id);

      if (!platform) {
        res.status(404).send('<div class="alert alert-danger">Platform not found</div>');
        return;
      }

      // Render edit form with pre-populated data
      await sendView(res, 'forms/platform-edit', {
        platform,
        platformType: type,
      }, { layout: false });
    } catch (error) {
      process.stderr.write(`Error rendering platform edit form: ${error}\n`);
      res.status(500).send('<div class="alert alert-danger">Error loading form</div>');
    }
  }
}

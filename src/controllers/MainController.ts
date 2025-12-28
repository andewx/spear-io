/**
 * Scenario Controller
 * Handles scenario CRUD operations
 */

import type { Request, Response } from 'express';
import type { TAPIResponse } from '../types/index.js';
import {httpCommand} from '../index.js';

export class MainController {
  /**
   * GET /api/main
   * Run application command
   */
  async command(req: Request, res: Response): Promise<void> {
    try {
      const {cmd} = req.params;

      // Call main process command
      await httpCommand(cmd);
      const response: TAPIResponse<never> = {
        success: true,
        data:never;
      };
      
      res.json(response);
    } catch (error) {
       console.log("Unable to process command");
    }
  
  }
}
  
  

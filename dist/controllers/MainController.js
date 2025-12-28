/**
 * Scenario Controller
 * Handles scenario CRUD operations
 */
import { httpCommand } from '../index.js';
export class MainController {
    /**
     * GET /api/main
     * Run application command
     */
    async command(req, res) {
        try {
            const { cmd } = req.params;
            // Call main process command
            await httpCommand(cmd);
            const response = {
                success: true,
                data: undefined,
            };
            res.json(response);
        }
        catch (error) {
            console.log("Unable to process command");
        }
    }
}
//# sourceMappingURL=MainController.js.map
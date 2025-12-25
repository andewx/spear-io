/**
 * Synthetic Controller
 * Handles generation of synthetic precipitation fields
 */
import type { Request, Response } from 'express';
export declare class SyntheticController {
    /**
     * POST /api/synthetic/precipitation
     * Generate precipitation field JPEG for a scenario
     */
    generatePrecipitationField(req: Request, res: Response): Promise<void>;
    /**
     * Generate precipitation field image as JPEG
     * Pixel luminance represents rain rate (0-100 mm/hr mapped to 0-255)
     */
    private generateFieldImage;
    private generateJETColormap;
    /**
     * Generate high-pass filtered version of precipitation field for overlay
     * High-pass filter enhances edges and removes smooth gradients
     */
    private generateHighPassOverlay;
    /**
     * GET /api/synthetic/precipitation/:filename
     * Serve precipitation field image
     */
    servePrecipitationImage(req: Request, res: Response): Promise<void>;
    /**
     * Error handler
     */
    private handleError;
}
//# sourceMappingURL=SyntheticController.d.ts.map
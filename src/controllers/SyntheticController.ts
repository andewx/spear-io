/**
 * Synthetic Controller
 * Handles generation of synthetic precipitation fields
 */

import type { Request, Response } from 'express';
import { createCanvas } from 'canvas';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import { SyntheticPrecipitationField } from '../synthetic/SyntheticPrecipitationField.js';
import type { IScenario, TAPIResponse } from '../types/index.js';
import * as storage from '../services/fileStorage.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PRECIPITATION_DIR = path.join(process.cwd(),'src', 'data', 'images');

export class SyntheticController {
  /**
   * POST /api/synthetic/precipitation
   * Generate precipitation field JPEG for a scenario
   */
  async generatePrecipitationField(req: Request, res: Response): Promise<void> {
    try {
      const { scenarioId } = req.body as { scenarioId: string };
      console.log('Received request to generate precipitation field for scenario ID:', scenarioId);
      if (!scenarioId) {
        const response: TAPIResponse<never> = {
          success: false,
          error: 'Scenario ID is required',
        };
        res.status(400).json(response);
        return;
      }

      // Load scenario
      const scenario = await storage.loadScenario(scenarioId);
      if (!scenario) {
        const response: TAPIResponse<never> = {
          success: false,
          error: 'Scenario not found',
        };
        res.status(404).json(response);
        return;
      }

      // Check if precipitation is enabled
      if (!scenario.environment.precipitation.enabled) {
        const response: TAPIResponse<never> = {
          success: false,
          error: 'Precipitation is not enabled for this scenario',
        };
        res.status(400).json(response);
        return;
      }

      // Generate precipitation field
      const { imageFilename, overlayFilename, jetFilename } = await this.generateFieldImage(scenario);

      //Delete the previous stored images if they exist
      if(scenario.precipitationFieldImage){
        const oldImagePath = path.join(PRECIPITATION_DIR, scenario.precipitationFieldImage);
        fs.unlink(oldImagePath).catch(() => {});
      }
      if(scenario.precipitationFieldOverlay){
        const oldOverlayPath = path.join(PRECIPITATION_DIR, scenario.precipitationFieldOverlay);
        fs.unlink(oldOverlayPath).catch(() => {});
      }
      if(scenario.precipitationFieldJet){
        const oldJetPath = path.join(PRECIPITATION_DIR, scenario.precipitationFieldJet);
        fs.unlink(oldJetPath).catch(() => {});
      }

      // Update scenario with image filename
      scenario.precipitationFieldImage = imageFilename;
      scenario.precipitationFieldOverlay = overlayFilename;
      scenario.precipitationFieldJet = jetFilename;
      await storage.saveScenario(scenario);

      const response: TAPIResponse<{ imageFilename: string }> = {
        success: true,
        data: { imageFilename },
      };
      res.json(response);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  /**
   * Generate precipitation field image as JPEG
   * Pixel luminance represents rain rate (0-100 mm/hr mapped to 0-255)
   */
  private async generateFieldImage(scenario: IScenario): Promise<any> {
    const { grid, environment } = scenario;
    const { precipitation } = environment;

    // Ensure precipitation directory exists
    await fs.mkdir(PRECIPITATION_DIR, { recursive: true });

    // Calculate image dimensions based on grid resolution
    const imageWidth = Math.floor(grid.width * grid.resolution);
    const imageHeight = Math.floor(grid.height * grid.resolution);

    // Generate synthetic precipitation field
    const field = new SyntheticPrecipitationField({
      gridBounds: grid,
      numCells: Math.floor((grid.width * grid.height * precipitation.nominalCoverage) / (precipitation.nominalCellSize * precipitation.nominalCellSize)), // Approximate number of cells based on coverage
      nominalRainRate: precipitation.nominalRainRate,
      nominalCellSize: precipitation.nominalCellSize,
      alpha: precipitation.alpha,
      maxRainRateCap: precipitation.maxRainRateCap,
    });

    // Create canvas for image generation
    const canvas = createCanvas(imageWidth, imageHeight);
    const ctx = canvas.getContext('2d');
    const imageData = ctx.createImageData(imageWidth, imageHeight);

    // Step 1: Sample precipitation field into 2D array
    const rainRateField: number[][] = [];
    let maxRate = 0;
    
    for (let y = 0; y < imageHeight; y++) {
      rainRateField[y] = [];
      for (let x = 0; x < imageWidth; x++) {
        const posX = x / grid.resolution;
        const posY = y / grid.resolution;
        const rainRate = field.sampleRainRate(posX, posY);
        rainRateField[y][x] = rainRate;
        maxRate = Math.max(maxRate, rainRate);
      }
    }

    
    // Step 2: Apply sigmoid normalization to compress dynamic range
    const sigmoidK = precipitation.sigmoidK || 0.0; // Controls steepness (higher = more compression of high values)

    if(sigmoidK > 0) {
    const sigmoidX0 = maxRate / 2; // Midpoint
    for (let y = 0; y < imageHeight; y++) {
      for (let x = 0; x < imageWidth; x++) {
        const rate = rainRateField[y][x];
        // Sigmoid: 1 / (1 + exp(-k*(x-x0)/x0))
        const normalized = 1.0 / (1.0 + Math.exp(-sigmoidK * (rate - sigmoidX0) / sigmoidX0));
        rainRateField[y][x] = normalized * maxRate;
      }
    }
  }

    // Step 3: Apply Gaussian blur to smooth artifacts
    const blurRadius = 2; // Kernel radius
    const blurredField: number[][] = [];
    const sigma = blurRadius / 2.0;
    
    for (let y = 0; y < imageHeight; y++) {
      blurredField[y] = [];
      for (let x = 0; x < imageWidth; x++) {
        let sum = 0;
        let weightSum = 0;
        
        for (let dy = -blurRadius; dy <= blurRadius; dy++) {
          for (let dx = -blurRadius; dx <= blurRadius; dx++) {
            const ny = y + dy;
            const nx = x + dx;
            
            if (ny >= 0 && ny < imageHeight && nx >= 0 && nx < imageWidth) {
              const dist2 = dx * dx + dy * dy;
              const weight = Math.exp(-dist2 / (2 * sigma * sigma));
              sum += rainRateField[ny][nx] * weight;
              weightSum += weight;
            }
          }
        }
        
        blurredField[y][x] = sum / weightSum;
      }
    }


    // Step 4: Convert to grayscale pixels
    const MAX_RAIN_RATE = scenario.environment.precipitation.maxRainRateCap || 35; // mm/hr
    for (let y = 0; y < imageHeight; y++) {
      for (let x = 0; x < imageWidth; x++) {
        const rainRate = blurredField[y][x];
        const luminance = Math.min(255, Math.floor((rainRate / MAX_RAIN_RATE) * 255));

        const idx = (y * imageWidth + x) * 4;
        imageData.data[idx] = luminance;     // R
        imageData.data[idx + 1] = luminance; // G
        imageData.data[idx + 2] = luminance; // B
        imageData.data[idx + 3] = 255;       // A
      }
    }

    // Put image data on canvas
    ctx.putImageData(imageData, 0, 0);

    // Generate filename
    const imageFilename = `precip_${scenario.id}_${Date.now()}.png`;
    const imagePath = path.join(PRECIPITATION_DIR, imageFilename);
    
    // Save as PNG
    const buffer = canvas.toBuffer('image/png');
    await fs.writeFile(imagePath, buffer);

    process.stdout.write(`Generated precipitation field: ${imageFilename} (${imageWidth}×${imageHeight})\n`);

    // Generate high-pass filtered version for overlay visualization
    const overlayFilename = await this.generateHighPassOverlay(blurredField, imageWidth, imageHeight, scenario.id);
        process.stdout.write(`Generated high-pass overlay: ${overlayFilename}\n`);
    const jetFilename = await this.generateJETColormap(imageData, imageFilename);
        process.stdout.write(`Generated JET colormap: ${jetFilename}\n`);


    const filenames = { imageFilename, overlayFilename, jetFilename };
    return filenames;
  }


  private async generateJETColormap(originalImageData: any, imageFilename: string): Promise<string> {
    const width = originalImageData.width;
    const height = originalImageData.height;

    // Create canvas for JET colormap
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    const imageData = ctx.createImageData(width, height);

    // Apply JET colormap
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const luminance = originalImageData.data[idx]; // Grayscale value

        // Map luminance to JET colormap
        let r = 0, g = 0, b = 0;
        const value = luminance / 255.0;

        if (value < 0.25) {
          r = 0;
          g = Math.floor(4 * value * 255);
          b = 255;
        } else if (value < 0.5) {
          r = 0;
          g = 255;
          b = Math.floor((1 - 4 * (value - 0.25)) * 255);
        } else if (value < 0.75) {
          r = Math.floor(4 * (value - 0.5) * 255);
          g = 255;
          b = 0;
        } else {
          r = 255;
          g = Math.floor((1 - 4 * (value - 0.75)) * 255);
          b = 0;
        }

        imageData.data[idx] = r;
        imageData.data[idx + 1] = g;
        imageData.data[idx + 2] = b;
        imageData.data[idx + 3] = 255; // A
      }
    }

    ctx.putImageData(imageData, 0, 0);

    // Save JET colormap image
    const jetFilename = `precip_jet_${imageFilename}`;
    const jetPath = path.join(PRECIPITATION_DIR, jetFilename);
    const buffer = canvas.toBuffer('image/png');
    await fs.writeFile(jetPath, buffer);

    return jetFilename;
  }

  /**
   * Generate high-pass filtered version of precipitation field for overlay
   * High-pass filter enhances edges and removes smooth gradients
   */
  private async generateHighPassOverlay(
    rainRateField: number[][],
    width: number,
    height: number,
    scenarioId: string
  ): Promise<string> {
    // Compute spatial gradient magnitude at each pixel
    const gradientField: number[][] = [];
    
    for (let y = 0; y < height; y++) {
      gradientField[y] = [];
      for (let x = 0; x < width; x++) {
        // Compute gradient using simple finite differences
        let gradX = 0;
        let gradY = 0;
        
        // Horizontal gradient (central difference)
        if (x > 0 && x < width - 1) {
          gradX = (rainRateField[y][x + 1] - rainRateField[y][x - 1]) / 2.0;
        }
        
        // Vertical gradient (central difference)
        if (y > 0 && y < height - 1) {
          gradY = (rainRateField[y + 1][x] - rainRateField[y - 1][x]) / 2.0;
        }
        
        // Gradient magnitude
        const gradMag = Math.sqrt(gradX * gradX + gradY * gradY);
        
        // Scale pixel intensity by gradient strength
        gradientField[y][x] = rainRateField[y][x] * gradMag;
      }
    }

    // Create canvas for gradient-emphasized overlay
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    const imageData = ctx.createImageData(width, height);

    // Convert gradient-weighted values to grayscale
    // Strong gradients (edges) will be bright, flat areas will be dark
    const scaleFactor = 2.0; // Amplify for visibility
    const MAX_RAIN_RATE = 100;
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const gradValue = gradientField[y][x] * scaleFactor;
        const luminance = Math.min(255, Math.floor((gradValue / MAX_RAIN_RATE) * 255));

        const idx = (y * width + x) * 4;
        imageData.data[idx] = luminance;     // R
        imageData.data[idx + 1] = luminance; // G
        imageData.data[idx + 2] = luminance; // B
        imageData.data[idx + 3] = 255;       // A
      }
    }

    ctx.putImageData(imageData, 0, 0);

    // Save high-pass overlay
    const overlayFilename = `precip_overlay_${scenarioId}_${Date.now()}.png`;
    const overlayPath = path.join(PRECIPITATION_DIR, overlayFilename);
    const buffer = canvas.toBuffer('image/png');
    await fs.writeFile(overlayPath, buffer);

    return overlayFilename;
  }

  /**
   * GET /api/synthetic/precipitation/:filename
   * Serve precipitation field image
   */
  async servePrecipitationImage(req: Request, res: Response): Promise<void> {
    try {
      const { filename } = req.params;

      // Validate filename (security) - allow both regular and overlay filenames
      if (!filename || !/^precip_(overlay_)?[\w-]+_\d+\.png$/.test(filename)) {
        res.status(400).send('Invalid filename');
        return;
      }

      const imagePath = path.join(PRECIPITATION_DIR, filename);

      console.log(`[SyntheticController.servePrecipitationImage] Serving image: ${imagePath}`);

      // Check if file exists
      try {
        await fs.access(imagePath);
      } catch {
        res.status(404).send('Image not found');
        return;
      }

      // Serve image
      res.sendFile(imagePath);
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
}

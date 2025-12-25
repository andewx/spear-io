/**
 * Radar system abstraction
 * Handles detection range calculations with path attenuation and pulse integration
 */
import * as itu from '../services/ituData.js';
import { createCanvas, loadImage } from 'canvas';
import path from 'path';
import { fileURLToPath } from 'url';
/**
 * Radar system for detection range calculations
 * Operates using relative range scaling from nominal 1m² RCS baseline
 */
export class Radar {
    nominalRange;
    frequency;
    pulseIntegrationGain;
    radarConfig;
    ituData;
    //Canvas objects for precipitation image processing
    ctx = null;
    imageData = null;
    constructor(config) {
        this.nominalRange = config.nominalRange;
        this.frequency = config.frequency;
        this.radarConfig = config;
        this.pulseIntegrationGain = this.calculatePulseIntegrationGain(this.radarConfig.pulseIntegration.numPulses);
        //Ensure numeric properties are numbers
        this.nominalRange = Number(this.nominalRange);
        this.frequency = Number(this.frequency);
    }
    /** Canvas context and image data for precipitation image processing */
    async loadImageDataFromScenario(scenario) {
        // Construct file system path to precipitation image
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = path.dirname(__filename);
        const imagePath = path.join(__dirname, '..', 'data', 'precipitation', scenario.precipitationFieldImage);
        console.log('\nLoading precipitation image from:', imagePath);
        //Replace load image with
        try {
            const image = await loadImage(imagePath);
            //Create canvas matchin image dimensions
            // Create canvas matching image dimensions
            const canvas = createCanvas(image.width, image.height);
            const ctx = canvas.getContext('2d');
            // Draw image to canvas
            ctx.drawImage(image, 0, 0);
            // Extract pixel data
            this.imageData = ctx.getImageData(0, 0, image.width, image.height);
        }
        catch (error) {
            console.error('Failed to load precipitation image:', error);
        }
    }
    /**
     * Calculate pulse integration gain
     * Coherent: sqrt(N)
     * Non-coherent: N^0.7
     */
    calculatePulseIntegrationGain(pulses) {
        const N = pulses;
        if (this.radarConfig.pulseIntegration.mode === 'coherent') {
            return this.wattsToDecibels(Math.sqrt(pulses));
        }
        else {
            return this.wattsToDecibels(Math.pow(pulses, 0.7));
        }
    }
    /**
     * Load the ITU data for path attenuation calculations
     */
    async loadITUData() {
        if (!this.ituData) {
            this.ituData = await itu.loadITUData();
        }
        return this.ituData;
    }
    /**
     * Calculate detection range for a given RCS
     * Uses R₁/R₂ = (RCS₂/RCS₁)^0.25 from radar range equation
     *
     * @param rcs - Target radar cross section (m²)
     * @returns Detection range (km)
     */
    calculateDetectionRange(rcs, pulses, range) {
        const pulseGain = this.calculatePulseIntegrationGain(pulses);
        range = range * this.rangeDeltaFromDecibels(pulseGain);
        const rcsRatio = rcs / 1.0; // Nominal is 1m²
        const rangeRatio = Math.pow(rcsRatio, 0.25);
        return range * rangeRatio;
    }
    decibelsToWatts(db) {
        return Math.pow(10, db / 10);
    }
    /**Given a decibel gain convert the resulting range increase/decrease */
    rangeDeltaFromDecibels(dbGain) {
        // Convert dB gain to linear scale
        const linearGain = this.decibelsToWatts(dbGain);
        // Range scales with the fourth root of power gain
        return Math.pow(linearGain, 0.25);
    }
    wattsToDecibels(watts) {
        return 10 * Math.log10(watts);
    }
    /**
     * Calculate detection range with precipitation field attenuation sampling
     * @param rcs fighter RCS (m²)
     * @param azimuth
     * @returns
     */
    calculateDetectionRangeWithPrecipitationFieldSampling(rcs, position, azimuth, scenario) {
        // If no precipitation field image, return unattenuated range
        if (!scenario.precipitationFieldImage) {
            console.log("No precipitation field image defined, returning unattenuated range.");
            return this.calculateDetectionRange(rcs, 1.0, this.nominalRange);
        }
        try {
            const pixelsPerKm = scenario.grid.resolution; // pixels per km
            const kmPerPixel = 1 / pixelsPerKm;
            const maxRangeKm = this.nominalRange; // Sample out to nominal range
            const rangeStepKm = kmPerPixel * 0.1; // Sample at approx 1.5 pixel intervals
            const NRay = Math.ceil(maxRangeKm / rangeStepKm);
            //Scenario max precipitation rate
            const maxPrecipitationRate = scenario.environment.precipitation.maxRainRateCap || 35; // mm/hr
            // Total accumulated attenuation in dB (two-way path)
            let totalAttenuationDb = 0;
            // Calculate base detection range for this RCS (without attenuation)
            const baseDetectionRange = this.nominalRange;
            const azRad = this.degToRad(azimuth);
            let detectionRange = baseDetectionRange;
            // Cast ray from radar position outward in azimuth direction
            for (let iray = 0; iray < NRay; iray++) {
                const currentRangeKm = (iray + 1) * rangeStepKm;
                // Calculate what the adjusted detection range is with attenuation accumulated so far
                // Range reduction: R_attenuated = R_base * 10^(-attenuation_dB / 40)
                // totalAttenuationDb is POSITIVE, so we need the negative sign in the exponent
                const adjustedDetectionRange = baseDetectionRange * Math.pow(10, -totalAttenuationDb / 40);
                // If we've propagated beyond where we can detect, stop here
                if (currentRangeKm > adjustedDetectionRange) {
                    detectionRange = adjustedDetectionRange;
                    break;
                }
                // Calculate world position along ray from radar position
                const offsetX = currentRangeKm * Math.cos(azRad);
                const offsetY = currentRangeKm * Math.sin(azRad);
                const worldPos = {
                    x: position.x + offsetX,
                    y: position.y + offsetY
                };
                // Sample rain rate using bilinear interpolation for smooth values
                const rainRate = this.sampleRainRateBilinear(worldPos, scenario, maxPrecipitationRate);
                if (rainRate !== null) {
                    // Accumulate attenuation only if there's significant rain
                    if (rainRate > 1.0) { // Threshold to avoid noise
                        const specificAttenuation = this.getSpecificAttenuation(rainRate); // dB/km
                        // Two-way path: signal travels to target and back
                        const stepAttenuationDb = (specificAttenuation * rangeStepKm);
                        totalAttenuationDb += stepAttenuationDb;
                    }
                }
                // Update detection range for next iteration
                detectionRange = adjustedDetectionRange;
            }
            return detectionRange;
        }
        catch (error) {
            console.error('Failed to sample precipitation field:', error);
            // Fall back to unattenuated range if sampling fails
            return this.calculateDetectionRange(rcs, 1.0, this.nominalRange);
        }
    }
    /**
     * Sample rain rate using bilinear interpolation for smooth values
     * Returns null if position is outside image bounds
     */
    sampleRainRateBilinear(position, scenario, maxPrecipitationRate) {
        if (!this.imageData)
            return null;
        const resolution = scenario.grid.resolution;
        const gridWidthKm = scenario.grid.width;
        const gridHeightKm = scenario.grid.height;
        const widthPixels = gridWidthKm * resolution;
        const heightPixels = gridHeightKm * resolution;
        const originX = scenario.grid.origin?.x || 0;
        const originY = scenario.grid.origin?.y || 0;
        // Get continuous pixel coordinates (with fractional part)
        const centerPixelX = widthPixels / 2;
        const centerPixelY = heightPixels / 2;
        const px = centerPixelX + (position.x - originX) * resolution;
        const py = centerPixelY + (position.y - originY) * resolution; // Y axis is inverted in display visualization so we match here
        // Check bounds (need 1-pixel margin for interpolation)
        if (px < 0 || px >= widthPixels - 1 || py < 0 || py >= heightPixels - 1) {
            return null;
        }
        // Get the four surrounding pixel coordinates
        const x0 = Math.floor(px);
        const y0 = Math.floor(py);
        const x1 = x0 + 1;
        const y1 = y0 + 1;
        // Get fractional parts for interpolation weights
        const fx = px - x0;
        const fy = py - y0;
        // Sample four surrounding pixels
        const intensity00 = this.getPixelIntensity(x0, y0, widthPixels);
        const intensity10 = this.getPixelIntensity(x1, y0, widthPixels);
        const intensity01 = this.getPixelIntensity(x0, y1, widthPixels);
        const intensity11 = this.getPixelIntensity(x1, y1, widthPixels);
        // Bilinear interpolation
        const intensity0 = intensity00 * (1 - fx) + intensity10 * fx;
        const intensity1 = intensity01 * (1 - fx) + intensity11 * fx;
        const intensity = intensity0 * (1 - fy) + intensity1 * fy;
        // Map interpolated intensity to rain rate
        return (intensity / 255) * maxPrecipitationRate;
    }
    /**
     * Get pixel intensity (average of RGB) at given coordinates
     */
    getPixelIntensity(x, y, width) {
        if (!this.imageData)
            return 0;
        const pixelIndex = (y * width + x) * 4;
        if (pixelIndex + 2 >= this.imageData.data.length)
            return 0;
        const r = this.imageData.data[pixelIndex];
        const g = this.imageData.data[pixelIndex + 1];
        const b = this.imageData.data[pixelIndex + 2];
        return (r + g + b) / 3;
    }
    /**
     * Position to image coordinates
     */
    worldToImageCoordinates(position, scenario) {
        // World coordinates: origin at center, Y increases upward
        // Image coordinates: origin at top-left, Y increases downward
        let originX = 0;
        let originY = 0;
        if (scenario.grid.origin !== undefined) {
            originX = scenario.grid.origin.x;
            originY = scenario.grid.origin.y;
        }
        const resolution = scenario.grid.resolution; // pixels per km
        const gridWidthKm = scenario.grid.width; // grid width in km
        const gridHeightKm = scenario.grid.height; // grid height in km
        const widthPixels = gridWidthKm * resolution;
        const heightPixels = gridHeightKm * resolution;
        // Center of image in pixel coordinates
        const centerPixelX = Math.floor(widthPixels / 2);
        const centerPixelY = Math.floor(heightPixels / 2);
        // Transform world position relative to origin, then to pixel coordinates
        // X: positive world X = positive pixel offset from center
        // Y: positive world Y = positive pixel offset from center (flip Y axis)
        let ix = centerPixelX + Math.floor((position.x - originX) * resolution);
        let iy = centerPixelY + Math.floor((position.y - originY) * resolution); //image is flipped vertically in visualization so we match here
        // Clamp to image bounds
        if (ix < 0 || ix >= widthPixels || iy < 0 || iy >= heightPixels) {
            console.warn(`Position (${position.x.toFixed(1)}, ${position.y.toFixed(1)}) km maps outside image bounds to pixel (${ix}, ${iy})`);
            ix = Math.max(0, Math.min(widthPixels - 1, ix));
            iy = Math.max(0, Math.min(heightPixels - 1, iy));
        }
        return { ix, iy };
    }
    imageToWorldCoordinates(ix, iy, scenario) {
        // Image coordinates: origin at top-left, Y increases downward  
        // World coordinates: origin at center, Y increases upward
        let originX = 0;
        let originY = 0;
        if (scenario.grid.origin !== undefined) {
            originX = scenario.grid.origin.x;
            originY = scenario.grid.origin.y;
        }
        const resolution = scenario.grid.resolution; // pixels per km
        const gridWidthKm = scenario.grid.width; // grid width in km
        const gridHeightKm = scenario.grid.height; // grid height in km
        const widthPixels = gridWidthKm * resolution;
        const heightPixels = gridHeightKm * resolution;
        // Center of image in pixel coordinates
        const centerPixelX = Math.floor(widthPixels / 2);
        const centerPixelY = Math.floor(heightPixels / 2);
        // Convert pixel offset from center to world coordinates
        // X: positive pixel offset = positive world X
        // Y: positive pixel offset = negative world Y (flip Y axis)
        const x = originX + (ix - centerPixelX) / resolution;
        const y = originY - (iy - centerPixelY) / resolution;
        return { x, y };
    }
    degToRad(deg) {
        return (deg * Math.PI) / 180;
    }
    radToDeg(rad) {
        return (rad * 180) / Math.PI;
    }
    polarToCartesian(radius, angleDeg) {
        const angleRad = this.degToRad(angleDeg);
        return {
            x: radius * Math.cos(angleRad),
            y: radius * Math.sin(angleRad),
        };
    }
    /**
     * Apply path attenuation to detection range
     * Attenuation reduces received power, affects range by R ∝ P^0.25
     * Since R^4 ∝ P, and attenuation is in dB: 10*log10(P1/P2) = attenuation
     * Therefore: R2/R1 = (P2/P1)^0.25 = 10^(-attenuation/40)
     *
     * @param baseRange - Original detection range (km)
     * @param attenuationDb - Total path attenuation (dB)
     * @returns Attenuated detection range (km)
     */
    applyPathAttenuation(baseRange, attenuationDb) {
        // Range reduction factor from attenuation
        // dB = 10*log10(P1/P2), so P2/P1 = 10^(-dB/10)
        // Range scales with power^0.25, so R2/R1 = (P2/P1)^0.25 = 10^(-dB/40)
        const rangeReductionFactor = Math.pow(10, -attenuationDb / 40);
        return baseRange * rangeReductionFactor;
    }
    /**
     * Given rain rate (mm/hr), get specific attenuation (dB/km) from ITU data
     */
    getSpecificAttenuation(rainRate) {
        if (!this.ituData) {
            throw new Error('ITU data not loaded');
        }
        return itu.getAttenuation(this.frequency, rainRate);
    }
    /**
     * Get radar operating frequency
     */
    getFrequency() {
        return this.frequency;
    }
    /**
     * Get nominal range
     */
    getNominalRange() {
        return this.nominalRange;
    }
}
//# sourceMappingURL=Radar.js.map
/**
 * SAM System platform model
 * Represents a Surface-to-Air Missile system with radar and missile characteristics
 */
import { Radar } from './Radar.js';
/**
 * Pulse integration configurations for different pulse models
 */
const PULSE_INTEGRATION_CONFIGS = {
    short: { numPulses: 4, mode: 'noncoherent' },
    medium: { numPulses: 10, mode: 'noncoherent' },
    long: { numPulses: 20, mode: 'coherent' },
};
export class SAMSystem {
    id;
    name;
    properties;
    pulseMode;
    trackedTargets = new Map();
    radar;
    state;
    trackingRadar;
    missileVelocity;
    nominalRange;
    nominalRangesAzimuth = []; // Precomputed nominal ranges over azimuth
    precipRangesAzimuth = []; // Precomputed ranges with precipitation attenuation
    numAzimuths = 216; // e.g., 2.5 degree increments over 360 degrees
    //TODO: Move these properties and others to ISAMSystem interface and store with platform
    launchIntervalSec = 5; // seconds between launches
    position = { x: 0, y: 0 }; // SAM position in km
    status = {
        missilesRemaining: 6,
        totalMissiles: 6,
        launchedMissiles: 0,
        lastLaunchTime: 0,
    };
    constructor(platform, scenario) {
        this.id = platform.id;
        this.name = platform.name;
        this.properties = platform;
        this.state = 'active';
        // Create main search/track radar
        const pulseStruct = PULSE_INTEGRATION_CONFIGS[platform.pulseModel];
        this.pulseMode = { numPulses: pulseStruct.numPulses, mode: pulseStruct.mode };
        this.radar = new Radar({
            nominalRange: platform.nominalRange,
            frequency: platform.systemFrequency,
            pulseIntegration: { numPulses: pulseStruct.numPulses, mode: pulseStruct.mode },
        });
        this.nominalRange = platform.nominalRange;
        //We assume nominal ranges are at 1.0 RCS target AND without pulse integration gain
        this.nominalRangesAzimuth = [];
        //Ensure that all numeric properties are numbers
        this.properties.nominalRange = Number(this.properties.nominalRange);
        this.properties.manualAcquisitionTime = Number(this.properties.manualAcquisitionTime);
        this.properties.autoAcquisitionTime = Number(this.properties.autoAcquisitionTime);
        this.properties.memr = Number(this.properties.memr);
        this.properties.missileVelocity = Number(this.properties.missileVelocity);
        this.properties.systemFrequency = Number(this.properties.systemFrequency);
        this.properties.missileTrackingFrequency = Number(this.properties.missileTrackingFrequency);
        for (let i = 0; i < this.numAzimuths; i++) {
            this.nominalRangesAzimuth.push(platform.nominalRange);
        }
        //Missile tracking radar has no pulse integration
        const missileTrackingPulseStruct = { numPulses: 1, mode: 'noncoherent' };
        // Create missile terminal tracking radar (no pulse integration)
        this.trackingRadar = new Radar({
            nominalRange: platform.nominalRange * 0.1, // Terminal radar typically shorter range
            frequency: platform.missileTrackingFrequency,
            pulseIntegration: { numPulses: missileTrackingPulseStruct.numPulses, mode: missileTrackingPulseStruct.mode },
        });
        this.missileVelocity = platform.missileVelocity;
    }
    getRangeAtAzimuth(azimuthDeg) {
        const azimuths = this.getDetectionRanges();
        const numAzimuths = azimuths.length;
        const azimuthIndex = Math.round(((azimuthDeg % 360) / 360) * numAzimuths) % numAzimuths;
        return azimuths[azimuthIndex];
    }
    getDetectionRanges() {
        const adjustedRanges = this.precipRangesAzimuth.map((nominalRange) => {
            const detectionRange = this.radar.calculateDetectionRange(1.0, 1.0, nominalRange);
            return detectionRange;
        });
        return adjustedRanges;
    }
    getAzimuthToTarget(targetPosition) {
        const deltaX = targetPosition.x - this.position.x;
        const deltaY = targetPosition.y - this.position.y;
        const azimuthRad = Math.atan2(deltaY, deltaX);
        let azimuthDeg = azimuthRad * (180 / Math.PI);
        if (azimuthDeg < 0) {
            azimuthDeg += 360;
        }
        return azimuthDeg;
    }
    async initPrecipitationField(scenario) {
        if (scenario.environment.precipitation.enabled && scenario.precipitationFieldImage) {
            await this.radar.loadImageDataFromScenario(scenario);
            this.calculateDetectionRangesWithSampling(scenario);
        }
    }
    getMissileProperties() {
        return {
            memr: this.properties.memr,
            velocity: this.missileVelocity,
        };
    }
    getTrackings() {
        return this.trackedTargets;
    }
    /**
     * Calculate detection range for a target with given RCS and path attenuation
     *
     * @param rcs - Target RCS (m²)
     * @param pathAttenuationDb - Path attenuation (dB)
     * @returns Detection range (km)
     */
    calculateDetectionRange(rcs, pulses, range) {
        return this.radar.calculateDetectionRange(rcs, pulses, range);
    }
    // Calculates nominal detection ranges over azimuth without precipitation attenuation
    calculateDetectionRanges(scenario) {
        const samPosition = this.position;
        for (let i = 0; i < this.numAzimuths; i++) {
            const azimuthDeg = (i * 360) / this.numAzimuths;
            const range = this.radar.calculateDetectionRange(1.0, // nominal RCS
            this.pulseMode.numPulses, this.nominalRange);
            this.nominalRangesAzimuth.push(range);
        }
        return this.nominalRangesAzimuth.length;
    }
    /**
     * Calculate detection range with attenuation precipitation sampling method along azimuth
     * use radar.calculateDetectionRange(rcs, range) when applying a specific RCS
     */
    calculateDetectionRangesWithSampling(scenario) {
        const samPosition = this.position;
        for (let i = 0; i < this.numAzimuths; i++) {
            const azimuthDeg = (360 / this.numAzimuths) * i;
            const range = this.radar.calculateDetectionRangeWithPrecipitationFieldSampling(1.0, // nominal RCS
            samPosition, azimuthDeg, scenario);
            this.precipRangesAzimuth.push(range);
        }
        return this.precipRangesAzimuth.length;
    }
    /**
     * Get Ranges Azimuth Array for nominal range adjustment without RCS recalulation
     */
    getRangesAzimuth() {
        return this.nominalRangesAzimuth;
    }
    /**
     * Calculate time for missile to reach target
     *
     * @param distance - Distance to target (km)
     * @returns Flight time (seconds)
     */
    calculateMissileFlightTime(distance) {
        const speedOfSound = 343; // m/s at sea level
        const velocityMs = this.missileVelocity * speedOfSound;
        const velocityKmS = velocityMs / 1000;
        return distance / velocityKmS;
    }
    /**
     * Calculate total kill time (acquisition + missile flight)
     *
     * @param distance - Distance to target (km)
     * @param autoAcquisition - Use automatic acquisition time
     * @returns Total kill time (seconds)
     */
    calculateKillTime(distance, autoAcquisition = true) {
        const acquisitionTime = autoAcquisition ? this.properties.autoAcquisitionTime : this.properties.manualAcquisitionTime;
        const flightTime = this.calculateMissileFlightTime(distance);
        return acquisitionTime + flightTime;
    }
    /**
     * Check if target is within MEMR
     */
    isWithinMEMR(distance) {
        return distance <= this.properties.memr;
    }
}
//# sourceMappingURL=SAMSystem.js.map
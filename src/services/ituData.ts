/**
 * ITU attenuation data loader and interpolation service
 * Loads CSV data from src/data/itu/ and provides bilinear interpolation
 * 
 * CSV Data Structure:
 * - Each ROW represents a frequency (5.0 GHz + rowIndex * 0.2 GHz)
 * - Each COLUMN represents a rain rate from ITU_RAIN_RATES array
 * - Each cell contains only the attenuation value in dB/km
 * - No header row, pure data matrix
 * 
 * Example:
 * atten_5.0GHz_0.01mm, atten_5.0GHz_0.1mm, ..., atten_5.0GHz_60mm
 * atten_5.2GHz_0.01mm, atten_5.2GHz_0.1mm, ..., atten_5.2GHz_60mm
 * ...
 */

import { promises as fs } from 'fs';
import path from 'path';
import { ITU_RAIN_RATES } from '../types/index.js';
import type { IITUData } from '../types/index.js';
import { dataPath } from './projectPaths.js';

let cachedITUData: IITUData | null = null;

const FREQUENCY_START = 5.0; // GHz
const FREQUENCY_STEP = 0.2; // GHz

/**
 * Load ITU attenuation CSV data (5.0-15.0 GHz, dB/km format)
 * Expected format: Tabular data where each row = frequency, each column = rain rate
 */
export async function loadITUData(): Promise<IITUData> {
  if (cachedITUData) {
    return cachedITUData;
  }

  const ituDir = dataPath('itu');
  const files = await fs.readdir(ituDir);
  const csvFile = files.find(f => f.endsWith('.csv'));

  if (!csvFile) {
    console.warn('No ITU CSV file found, using empty dataset');
    cachedITUData = {
      attenuationMatrix: [],
      frequencies: [],
      rainRates: ITU_RAIN_RATES,
      frequencyStart: FREQUENCY_START,
      frequencyStep: FREQUENCY_STEP,
      frequencyRange: [FREQUENCY_START, FREQUENCY_START],
      rainRateRange: [ITU_RAIN_RATES[0], ITU_RAIN_RATES[ITU_RAIN_RATES.length - 1]],
    };
    return cachedITUData;
  }

  const csvPath = path.join(ituDir, csvFile);
  const content = await fs.readFile(csvPath, 'utf-8');
  const lines = content.trim().split('\n');

  const attenuationMatrix: number[][] = [];
  const frequencies: number[] = [];

  // Parse CSV: each row = frequency, each column = rain rate
  let rowIndex = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    // Calculate frequency for this row
    const frequency = FREQUENCY_START + (rowIndex * FREQUENCY_STEP);
    frequencies.push(frequency);

    // Parse attenuation values (one per rain rate column)
    const attenuationRow = trimmed.split(',').map(v => parseFloat(v.trim()));
    attenuationMatrix.push(attenuationRow);

    rowIndex++;
  }

  const minFreq = frequencies[0] || FREQUENCY_START;
  const maxFreq = frequencies[frequencies.length - 1] || FREQUENCY_START;

  cachedITUData = {
    attenuationMatrix,
    frequencies,
    rainRates: ITU_RAIN_RATES,
    frequencyStart: FREQUENCY_START,
    frequencyStep: FREQUENCY_STEP,
    frequencyRange: [minFreq, maxFreq],
    rainRateRange: [ITU_RAIN_RATES[0], ITU_RAIN_RATES[ITU_RAIN_RATES.length - 1]],
  };

  console.log(`Loaded ITU attenuation data from ${csvFile}`);
  console.log(`  Matrix: ${attenuationMatrix.length} × ${ITU_RAIN_RATES.length}`);
  console.log(`  Frequencies: ${minFreq}-${maxFreq} GHz (${frequencies.length} rows, step=${FREQUENCY_STEP} GHz)`);
  console.log(`  Rain rates: ${ITU_RAIN_RATES.length} columns`);
  return cachedITUData;
}

/**
 * Linear interpolation helper
 */
function lerp(x: number, x0: number, x1: number, y0: number, y1: number): number {
  return y0 + (x - x0) * (y1 - y0) / (x1 - x0);
}

/**
 * Get attenuation (dB/km) for given frequency and rain rate using bilinear interpolation
 * 
 * @param frequency - Frequency in GHz
 * @param rainRate - Rain rate in mm/hr
 * @returns Attenuation in dB/km
 */
export function getAttenuation(frequency: number, rainRate: number): number {
  if (!cachedITUData) {
    throw new Error('ITU data not loaded. Call loadITUData() first.');
  }

  if (cachedITUData.attenuationMatrix.length === 0) {
    return 0; // No data available
  }

  const { attenuationMatrix, frequencies, rainRates, frequencyRange, rainRateRange } = cachedITUData;

  // Clamp to available ranges
  frequency = Math.max(frequencyRange[0], Math.min(frequencyRange[1], frequency));
  rainRate = Math.max(rainRateRange[0], Math.min(rainRateRange[1], rainRate));

  // Find bounding frequency indices
  let freqIdx0 = 0, freqIdx1 = 0;
  for (let i = 0; i < frequencies.length - 1; i++) {
    if (frequency >= frequencies[i] && frequency <= frequencies[i + 1]) {
      freqIdx0 = i;
      freqIdx1 = i + 1;
      break;
    }
  }
  if (frequency >= frequencies[frequencies.length - 1]) {
    freqIdx0 = freqIdx1 = frequencies.length - 1;
  }

  // Find bounding rain rate indices
  let rainIdx0 = 0, rainIdx1 = 0;
  for (let i = 0; i < rainRates.length - 1; i++) {
    if (rainRate >= rainRates[i] && rainRate <= rainRates[i + 1]) {
      rainIdx0 = i;
      rainIdx1 = i + 1;
      break;
    }
  }
  if (rainRate >= rainRates[rainRates.length - 1]) {
    rainIdx0 = rainIdx1 = rainRates.length - 1;
  }

  // Get corner values from matrix
  const q00 = attenuationMatrix[freqIdx0]?.[rainIdx0] ?? 0;
  const q01 = attenuationMatrix[freqIdx0]?.[rainIdx1] ?? 0;
  const q10 = attenuationMatrix[freqIdx1]?.[rainIdx0] ?? 0;
  const q11 = attenuationMatrix[freqIdx1]?.[rainIdx1] ?? 0;

  const f0 = frequencies[freqIdx0];
  const f1 = frequencies[freqIdx1];
  const r0 = rainRates[rainIdx0];
  const r1 = rainRates[rainIdx1];

  // Bilinear interpolation
  if (freqIdx0 === freqIdx1 && rainIdx0 === rainIdx1) {
    return q00;
  } else if (freqIdx0 === freqIdx1) {
    return lerp(rainRate, r0, r1, q00, q01);
  } else if (rainIdx0 === rainIdx1) {
    return lerp(frequency, f0, f1, q00, q10);
  } else {
    const r0Interp = lerp(frequency, f0, f1, q00, q10);
    const r1Interp = lerp(frequency, f0, f1, q01, q11);
    return lerp(rainRate, r0, r1, r0Interp, r1Interp);
  }
}

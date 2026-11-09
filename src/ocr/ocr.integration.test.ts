import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createWorker, OEM } from 'tesseract.js';
import { describe, expect, it } from 'vitest';
import { parseMeterOcr } from '../domain/ocrParse.ts';
import { OCR_PARAMETERS } from './constants.ts';

const langPath = fileURLToPath(new URL('../../public/ocr/tessdata', import.meta.url));

async function readImage(name: string): Promise<string> {
  const worker = await createWorker('eng', OEM.LSTM_ONLY, {
    langPath,
    gzip: true,
    cacheMethod: 'none',
  });
  try {
    await worker.setParameters(OCR_PARAMETERS);
    const buffer = readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)));
    const result = await worker.recognize(buffer, {}, { text: true, blocks: true });
    return result.data.text;
  } finally {
    await worker.terminate();
  }
}

describe('on-device OCR of synthetic meter images', () => {
  it('maps a rendered glucose screen', async () => {
    const text = await readImage('glucose-meter.png');
    const parsed = parseMeterOcr({ text, intent: 'glucose' });
    expect(text.trim().length).toBeGreaterThan(0);
    expect(parsed.glucose?.value, text).toBe(126);
    expect(parsed.glucoseUnit).toBe('mg/dL');
    expect(parsed.requiresManualConfirmation).toBe(true);
    expect(parsed.discarded.some((item) => item.reason === 'memory' || item.reason === 'date' || item.reason === 'date-line' || item.reason === 'time')).toBe(true);
  });

  it('maps a rendered blood-pressure screen', async () => {
    const text = await readImage('bp-monitor.png');
    const parsed = parseMeterOcr({ text, intent: 'bp' });
    expect(parsed.systolic?.value, text).toBe(148);
    expect(parsed.diastolic?.value, text).toBe(92);
    expect(parsed.pulse?.value, text).toBe(76);
    expect(parsed.requiresManualConfirmation).toBe(true);
  });
});

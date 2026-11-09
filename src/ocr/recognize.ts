import { createWorker, OEM } from 'tesseract.js';
import type { OcrWordInput } from '../domain/ocrParse.ts';
import { OCR_CORE_PATH, OCR_LANG_PATH, OCR_PARAMETERS, OCR_WORKER_PATH } from './constants.ts';

type OcrWorker = Awaited<ReturnType<typeof createWorker>>;

export interface OcrRecognition {
  text: string;
  words: OcrWordInput[];
  confidence: number;
}

const STATUS: Record<string, string> = {
  'loading tesseract core': 'OCR အင်ဂျင် ဖွင့်နေသည်',
  'initializing tesseract': 'OCR အင်ဂျင် ပြင်ဆင်နေသည်',
  'loading language traineddata': 'အင်္ဂလိပ်စာ အချက်အလက် ဖွင့်နေသည်',
  'initializing api': 'ဖတ်ရှုမှု ပြင်ဆင်နေသည်',
  'recognizing text': 'ပုံထဲက စာကို ဖတ်နေသည်',
};

let workerPromise: Promise<OcrWorker> | null = null;
let statusListener: ((message: string) => void) | null = null;

export function setOcrStatusListener(listener: ((message: string) => void) | null): void {
  statusListener = listener;
}

function report(status: string, progress?: number): void {
  const label = STATUS[status] ?? 'OCR လုပ်နေသည်';
  const percent = progress != null && progress > 0 && progress < 1 ? ` ${Math.round(progress * 100)}%` : '';
  statusListener?.(`${label}${percent}`);
}

async function getWorker(): Promise<OcrWorker> {
  if (!workerPromise) {
    const pending = createWorker('eng', OEM.LSTM_ONLY, {
      workerPath: OCR_WORKER_PATH,
      corePath: OCR_CORE_PATH,
      langPath: OCR_LANG_PATH,
      gzip: true,
      cacheMethod: 'none',
      logger: (message) => report(message.status, message.progress),
    });
    workerPromise = pending
      .then(async (worker) => {
        await worker.setParameters(OCR_PARAMETERS);
        return worker;
      })
      .catch((error: unknown) => {
        workerPromise = null;
        throw error;
      });
  }
  return workerPromise;
}

export async function recognizeCanvas(canvas: HTMLCanvasElement): Promise<OcrRecognition> {
  const worker = await getWorker();
  const result = await worker.recognize(canvas, {}, { text: true, blocks: true });
  return {
    text: result.data.text ?? '',
    confidence: typeof result.data.confidence === 'number' ? result.data.confidence : 0,
    words: wordsFromBlocks(result.data.blocks),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function wordsFromBlocks(blocks: unknown): OcrWordInput[] {
  if (!Array.isArray(blocks)) return [];
  const words: OcrWordInput[] = [];
  for (const block of blocks) {
    const paragraphs = isRecord(block) && Array.isArray(block.paragraphs) ? block.paragraphs : [];
    for (const paragraph of paragraphs) {
      const lines = isRecord(paragraph) && Array.isArray(paragraph.lines) ? paragraph.lines : [];
      for (const line of lines) {
        const lineWords = isRecord(line) && Array.isArray(line.words) ? line.words : [];
        for (const word of lineWords) {
          if (!isRecord(word) || typeof word.text !== 'string') continue;
          const bbox = isRecord(word.bbox) ? word.bbox : null;
          words.push({
            text: word.text,
            confidence: typeof word.confidence === 'number' ? word.confidence : 0,
            bbox:
              bbox &&
              typeof bbox.x0 === 'number' &&
              typeof bbox.y0 === 'number' &&
              typeof bbox.x1 === 'number' &&
              typeof bbox.y1 === 'number'
                ? { x0: bbox.x0, y0: bbox.y0, x1: bbox.x1, y1: bbox.y1 }
                : undefined,
          });
        }
      }
    }
  }
  return words;
}

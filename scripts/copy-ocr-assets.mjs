import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const coreDir = join(root, 'public/ocr/core');
mkdirSync(coreDir, { recursive: true });
mkdirSync(join(root, 'public/ocr/tessdata'), { recursive: true });

copyFileSync(
  join(root, 'node_modules/tesseract.js/dist/worker.min.js'),
  join(root, 'public/ocr/worker.min.js'),
);
copyFileSync(
  join(root, 'node_modules/tesseract.js-core/tesseract-core-lstm.wasm.js'),
  join(coreDir, 'tesseract-core-lstm.wasm.js'),
);

console.log('Copied local Tesseract worker and LSTM core into public/ocr');

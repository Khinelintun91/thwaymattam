import { PSM, type WorkerParams } from 'tesseract.js';

const publicBase = import.meta.env.BASE_URL;

export const OCR_WORKER_PATH = `${publicBase}ocr/worker.min.js`;
export const OCR_CORE_PATH = `${publicBase}ocr/core/tesseract-core-lstm.wasm.js`;
export const OCR_LANG_PATH = `${publicBase}ocr/tessdata`;

export const OCR_PARAMETERS: Partial<WorkerParams> = {
  tessedit_pageseg_mode: PSM.SPARSE_TEXT,
  tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz./:-#%',
  user_defined_dpi: '300',
};

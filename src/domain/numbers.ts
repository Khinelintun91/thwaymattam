/**
 * Number normalization utility.
 * Supports converting Burmese digits (၀-၉) and fullwidth digits (０-９)
 * to Western digits (0-9), keeping digits and a single decimal point.
 */
const DIGIT_MAP: Record<string, string> = {
  // Burmese digits (U+1040 to U+1049)
  '၀': '0', '၁': '1', '၂': '2', '၃': '3', '၄': '4',
  '၅': '5', '၆': '6', '၇': '7', '၈': '8', '၉': '9',
  // Shan digits (U+1090 to U+1099)
  '႐': '0', '႑': '1', '႒': '2', '႓': '3', '႔': '4',
  '႕': '5', '႖': '6', '႗': '7', '႘': '8', '႙': '9',
  // Fullwidth digits (U+FF10 to U+FF19)
  '０': '0', '１': '1', '２': '2', '３': '3', '４': '4',
  '５': '5', '６': '6', '７': '7', '８': '8', '９': '9',
};

export function normalizeNumericInput(input: string): string {
  let out = '';
  let dot = false;
  for (const ch of input) {
    if (ch in DIGIT_MAP) {
      out += DIGIT_MAP[ch];
    } else if (ch >= '0' && ch <= '9') {
      out += ch;
    } else if (ch === '.' && !dot) {
      out += '.';
      dot = true;
    }
  }
  return out;
}

export function parseLooseNumber(input: string): number | null {
  const normalized = normalizeNumericInput(input);
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

const BURMESE = '၀၁၂၃၄၅၆၇၈၉';

export function burmeseDigitsToAscii(input: string): string {
  return input
    .replace(/[၀-၉]/g, (ch) => String(ch.charCodeAt(0) - 0x1040))
    .replace(/[０-９]/g, (ch) => String(ch.charCodeAt(0) - 0xff10));
}

export function asciiDigitsToBurmese(input: string): string {
  return input.replace(/[0-9]/g, (ch) => BURMESE[Number(ch)] ?? ch);
}

/** Keep digits and a single decimal point. Burmese digits become ASCII. */
export function normalizeNumericInput(input: string): string {
  const ascii = burmeseDigitsToAscii(input).replace(/[၊,။]/g, '.');
  let out = '';
  let dot = false;
  for (const ch of ascii) {
    if (ch >= '0' && ch <= '9') out += ch;
    else if (ch === '.' && !dot) {
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

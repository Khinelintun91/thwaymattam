/**
 * Number input is English (ASCII) digits only.
 * Burmese digits, fullwidth digits and any other characters are dropped,
 * not converted — the user asked for English numbers only.
 * Keep digits and a single decimal point.
 */
export function normalizeNumericInput(input: string): string {
  let out = '';
  let dot = false;
  for (const ch of input) {
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

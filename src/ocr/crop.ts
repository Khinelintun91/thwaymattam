export interface Crop {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const FULL_CROP: Crop = { x: 0, y: 0, w: 1, h: 1 };

export function clampCrop(crop: Crop): Crop {
  const w = Math.min(1, Math.max(0.15, crop.w));
  const h = Math.min(1, Math.max(0.15, crop.h));
  const x = Math.min(1 - w, Math.max(0, crop.x));
  const y = Math.min(1 - h, Math.max(0, crop.y));
  return { x, y, w, h };
}

export function nudgeCrop(crop: Crop, dx: number, dy: number): Crop {
  return clampCrop({ ...crop, x: crop.x + dx, y: crop.y + dy });
}

export function resizeCrop(crop: Crop, factor: number): Crop {
  const w = crop.w * factor;
  const h = crop.h * factor;
  const cx = crop.x + crop.w / 2;
  const cy = crop.y + crop.h / 2;
  return clampCrop({ x: cx - w / 2, y: cy - h / 2, w, h });
}

export type QuarterTurn = 0 | 90 | 180 | 270;

export function nextTurn(rotation: QuarterTurn, direction: 1 | -1): QuarterTurn {
  return (((rotation + direction * 90 + 360) % 360) as QuarterTurn);
}

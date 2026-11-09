import { buildBackup } from './backup.ts';
import { dateKey } from './time.ts';
import type { Medication, Reading } from './types.ts';

export interface ShareTarget<T> {
  canShare?: (data: { files?: T[] }) => boolean;
  share?: (data: { files?: T[]; title?: string; text?: string }) => Promise<void>;
}

export type ShareOutcome = 'shared' | 'downloaded' | 'cancelled';

export function backupFileName(now = new Date()): string {
  return `thwaymattam-backup-${dateKey(now)}.json`;
}

export function backupPayload(readings: Reading[], medications: Medication[] = [], now = new Date()): { name: string; json: string } {
  return {
    name: backupFileName(now),
    json: JSON.stringify(buildBackup(readings, medications, now), null, 2),
  };
}

function isAbort(error: unknown): boolean {
  return !!error && typeof error === 'object' && 'name' in error && (error as { name: string }).name === 'AbortError';
}

function canShareFile<T extends { name: string }>(target: ShareTarget<T> | undefined, file: T): boolean {
  if (!target?.canShare || !target.share) return false;
  try {
    return target.canShare({ files: [file] });
  } catch {
    return false;
  }
}

/**
 * Opens the device share sheet when it can send a file.
 * Otherwise the caller downloads the same file.
 * Cancelling the sheet does not also download.
 */
export async function shareBackupFile<T extends { name: string }>(
  file: T,
  options: { target?: ShareTarget<T>; download: (file: T) => void },
): Promise<ShareOutcome> {
  if (!canShareFile(options.target, file) || !options.target?.share) {
    options.download(file);
    return 'downloaded';
  }
  try {
    await options.target.share({
      files: [file],
      title: 'သွေးမှတ်တမ်း',
      text: 'ဖုန်းတစ်လုံးဆီ ပို့ရန် ဘက်အပ်',
    });
    return 'shared';
  } catch (error) {
    if (isAbort(error)) return 'cancelled';
    options.download(file);
    return 'downloaded';
  }
}

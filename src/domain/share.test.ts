import { describe, expect, it, vi } from 'vitest';
import { backupFileName, shareBackupFile } from './share.ts';

const file = { name: 'thwaymattam-backup-2026-11-09.json' };

describe('phone-to-phone share', () => {
  it('names the backup with the Rangoon date', () => {
    expect(backupFileName(new Date('2026-11-08T18:30:00Z'))).toBe('thwaymattam-backup-2026-11-09.json');
    expect(backupFileName(new Date('2026-11-09T02:00:00Z'))).toBe('thwaymattam-backup-2026-11-09.json');
  });

  it('downloads when the device cannot share files', async () => {
    const download = vi.fn();
    const share = vi.fn();
    await expect(shareBackupFile(file, { download })).resolves.toBe('downloaded');
    await expect(
      shareBackupFile(file, { target: { canShare: () => false, share }, download }),
    ).resolves.toBe('downloaded');
    await expect(
      shareBackupFile(file, {
        target: {
          canShare: () => {
            throw new Error('unsupported');
          },
          share,
        },
        download,
      }),
    ).resolves.toBe('downloaded');
    expect(download).toHaveBeenCalledTimes(3);
    expect(share).not.toHaveBeenCalled();
  });

  it('uses the share sheet when a file can be shared, and does not download a cancellation', async () => {
    const download = vi.fn();
    const share = vi.fn().mockResolvedValue(undefined);
    await expect(
      shareBackupFile(file, { target: { canShare: () => true, share }, download }),
    ).resolves.toBe('shared');
    expect(share).toHaveBeenCalledWith({
      files: [file],
      title: 'သွေးမှတ်တမ်း',
      text: 'ဖုန်းတစ်လုံးဆီ ပို့ရန် ဘက်အပ်',
    });
    expect(download).not.toHaveBeenCalled();

    const abort = Object.assign(new Error('dismissed'), { name: 'AbortError' });
    const cancel = vi.fn().mockRejectedValue(abort);
    await expect(
      shareBackupFile(file, { target: { canShare: () => true, share: cancel }, download }),
    ).resolves.toBe('cancelled');
    expect(download).not.toHaveBeenCalled();

    const broken = vi.fn().mockRejectedValue(Object.assign(new Error('no'), { name: 'NotAllowedError' }));
    await expect(
      shareBackupFile(file, { target: { canShare: () => true, share: broken }, download }),
    ).resolves.toBe('downloaded');
    expect(download).toHaveBeenCalledTimes(1);
  });
});

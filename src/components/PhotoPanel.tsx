import { useEffect, useRef, useState, type PointerEvent } from 'react';
import type { OcrWordInput } from '../domain/ocrParse.ts';
import { clampCrop, FULL_CROP, nextTurn, nudgeCrop, resizeCrop, type Crop, type QuarterTurn } from '../ocr/crop.ts';
import { recognizeCanvas, setOcrStatusListener } from '../ocr/recognize.ts';

export function PhotoPanel({
  onRecognized,
  onCleared,
}: {
  onRecognized: (result: { text: string; words: OcrWordInput[]; previewUrl: string }) => void;
  onCleared?: () => void;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [rotation, setRotation] = useState<QuarterTurn>(0);
  const [crop, setCrop] = useState<Crop>(FULL_CROP);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ mode: 'move' | 'resize'; x: number; y: number; crop: Crop } | null>(null);
  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;
    const swap = rotation === 90 || rotation === 270;
    const orientedWidth = swap ? image.naturalHeight : image.naturalWidth;
    const orientedHeight = swap ? image.naturalWidth : image.naturalHeight;
    const parentWidth = canvas.parentElement?.clientWidth ?? 320;
    const scale = Math.min(1, parentWidth / orientedWidth);
    canvas.width = Math.max(1, Math.round(orientedWidth * scale));
    canvas.height = Math.max(1, Math.round(orientedHeight * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawRotated(ctx, image, rotation, canvas.width, canvas.height);
    ctx.strokeStyle = '#0e5c56';
    ctx.lineWidth = 3;
    ctx.strokeRect(crop.x * canvas.width, crop.y * canvas.height, crop.w * canvas.width, crop.h * canvas.height);
    ctx.fillStyle = 'rgba(14, 92, 86, 0.85)';
    const handle = 14;
    ctx.fillRect((crop.x + crop.w) * canvas.width - handle, (crop.y + crop.h) * canvas.height - handle, handle, handle);
  }, [image, rotation, crop]);

  function replaceUrl(next: string | null) {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = next;
    setPreviewUrl(next);
  }

  function loadFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('ပုံဖိုင်ကိုသာ ရွေးပါ။');
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      replaceUrl(url);
      setImage(img);
      setCrop(FULL_CROP);
      setRotation(0);
      setError(null);
      setStatus(null);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      setError('ဤပုံဖော်မတ်ကို ဖွင့်မရပါ။ JPG သို့မဟုတ် PNG သုံးပါ။');
    };
    img.src = url;
  }

  function point(event: PointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: (event.clientX - rect.left) / rect.width, y: (event.clientY - rect.top) / rect.height };
  }

  async function runOcr() {
    if (!image || !previewUrl) return;
    setBusy(true);
    setError(null);
    setOcrStatusListener(setStatus);
    try {
      const canvas = renderScan(image, rotation, crop);
      const recognized = await recognizeCanvas(canvas);
      onRecognized({ text: recognized.text, words: recognized.words, previewUrl });
      setStatus(recognized.text.trim() ? 'ဖတ်ပြီးပါပြီ။ အောက်တွင် စစ်ပြီးမှ သိမ်းပါ။ အလိုအလျောက် မသိမ်းပါ။' : 'ပုံထဲတွင် စာမတွေ့ပါ။ လက်ဖြင့်ထည့်ပါ။');
    } catch {
      setError('OCR ကို ဖွင့်၍မရပါ သို့မဟုတ် ဖတ်၍မရပါ။ လက်ဖြင့်ထည့်ပါ။ ပုံကို မသိမ်းပါ။');
    } finally {
      setOcrStatusListener(null);
      setBusy(false);
    }
  }

  return (
    <section className="card stack">
      <h2>ဓာတ်ပုံမှ ဖတ်မည်</h2>
      <p className="hint">ပုံကို ဤစက်ထဲတွင်သာ ဖတ်သည်။ ဆာဗာသို့ မပို့ပါ။ မှတ်တမ်းနှင့် ဓာတ်ပုံကို မသိမ်းပါ။ မသေချာသော ကိန်းကို အလိုအလျောက်မသိမ်းပါ။</p>
      <div className="row">
        <label className="btn btn-primary">
          ကင်မရာ
          <input className="sr-only" type="file" accept="image/*" capture="environment" onChange={(event) => {
            loadFile(event.target.files?.[0]);
            event.target.value = '';
          }} />
        </label>
        <label className="btn btn-quiet">
          ပြခန်း
          <input className="sr-only" type="file" accept="image/*" onChange={(event) => {
            loadFile(event.target.files?.[0]);
            event.target.value = '';
          }} />
        </label>
      </div>
      {previewUrl ? (
        <div className="stack">
          <figure>
            <figcaption>မူရင်းဓာတ်ပုံ</figcaption>
            <img className="preview-frame" src={previewUrl} alt="မူရင်းဓာတ်ပုံ" style={{ transform: `rotate(${rotation}deg)` }} />
          </figure>
          <p>ဖတ်မည့်အပိုင်းကို ဆွဲရွှေ့ပါ၊ သို့မဟုတ် ခလုတ်ဖြင့် ချိန်ပါ။</p>
          <canvas
            ref={canvasRef}
            className="cropper"
            aria-label="ဖတ်မည့်အပိုင်း"
            onPointerDown={(event) => {
              const here = point(event);
              const nearHandle = Math.abs(here.x - (crop.x + crop.w)) < 0.08 && Math.abs(here.y - (crop.y + crop.h)) < 0.08;
              const inside = here.x >= crop.x && here.x <= crop.x + crop.w && here.y >= crop.y && here.y <= crop.y + crop.h;
              if (!nearHandle && !inside) return;
              drag.current = { mode: nearHandle ? 'resize' : 'move', x: here.x, y: here.y, crop };
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={(event) => {
              const active = drag.current;
              if (!active) return;
              const here = point(event);
              const dx = here.x - active.x;
              const dy = here.y - active.y;
              if (active.mode === 'move') setCrop(nudgeCrop(active.crop, dx, dy));
              else setCrop(clampCrop({ ...active.crop, w: active.crop.w + dx, h: active.crop.h + dy }));
            }}
            onPointerUp={() => {
              drag.current = null;
            }}
          />
          <div className="row">
            <button type="button" className="btn btn-quiet btn-small" onClick={() => setRotation((value) => nextTurn(value, -1))}>ဘယ်လှည့်</button>
            <button type="button" className="btn btn-quiet btn-small" onClick={() => setRotation((value) => nextTurn(value, 1))}>ညာလှည့်</button>
            <button type="button" className="btn btn-quiet btn-small" onClick={() => setCrop((value) => nudgeCrop(value, -0.04, 0))}>ဘယ်</button>
            <button type="button" className="btn btn-quiet btn-small" onClick={() => setCrop((value) => nudgeCrop(value, 0.04, 0))}>ညာ</button>
            <button type="button" className="btn btn-quiet btn-small" onClick={() => setCrop((value) => nudgeCrop(value, 0, -0.04))}>အပေါ်</button>
            <button type="button" className="btn btn-quiet btn-small" onClick={() => setCrop((value) => nudgeCrop(value, 0, 0.04))}>အောက်</button>
            <button type="button" className="btn btn-quiet btn-small" onClick={() => setCrop((value) => resizeCrop(value, 0.9))}>ချုံ့</button>
            <button type="button" className="btn btn-quiet btn-small" onClick={() => setCrop((value) => resizeCrop(value, 1.1))}>ချဲ့</button>
            <button type="button" className="btn btn-quiet btn-small" onClick={() => setCrop(FULL_CROP)}>အပြည့်</button>
          </div>
          <button type="button" className="btn btn-primary btn-block" disabled={busy} onClick={() => void runOcr()}>
            {busy ? 'ဖတ်နေသည်…' : 'ဤပုံကို ဖတ်မည်'}
          </button>
          <button type="button" className="btn btn-quiet btn-block" onClick={() => { replaceUrl(null); setImage(null); onCleared?.(); }}>
            ဓာတ်ပုံဖယ်မည်
          </button>
        </div>
      ) : null}
      {status ? <p role="status">{status}</p> : null}
      {error ? <p className="error" role="alert">{error}</p> : null}
    </section>
  );
}

function drawRotated(
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource,
  rotation: QuarterTurn,
  width: number,
  height: number,
) {
  ctx.save();
  if (rotation === 90) {
    ctx.translate(width, 0);
    ctx.rotate(Math.PI / 2);
    ctx.drawImage(image, 0, 0, height, width);
  } else if (rotation === 180) {
    ctx.translate(width, height);
    ctx.rotate(Math.PI);
    ctx.drawImage(image, 0, 0, width, height);
  } else if (rotation === 270) {
    ctx.translate(0, height);
    ctx.rotate(-Math.PI / 2);
    ctx.drawImage(image, 0, 0, height, width);
  } else {
    ctx.drawImage(image, 0, 0, width, height);
  }
  ctx.restore();
}

function renderScan(image: HTMLImageElement, rotation: QuarterTurn, crop: Crop): HTMLCanvasElement {
  const swap = rotation === 90 || rotation === 270;
  const oriented = document.createElement('canvas');
  oriented.width = swap ? image.naturalHeight : image.naturalWidth;
  oriented.height = swap ? image.naturalWidth : image.naturalHeight;
  const ctx = oriented.getContext('2d');
  if (!ctx) throw new Error('canvas');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, oriented.width, oriented.height);
  drawRotated(ctx, image, rotation, oriented.width, oriented.height);
  const sx = Math.round(crop.x * oriented.width);
  const sy = Math.round(crop.y * oriented.height);
  const sw = Math.max(1, Math.round(crop.w * oriented.width));
  const sh = Math.max(1, Math.round(crop.h * oriented.height));
  const scale = Math.min(1, 1600 / Math.max(sw, sh));
  const out = document.createElement('canvas');
  out.width = Math.max(1, Math.round(sw * scale));
  out.height = Math.max(1, Math.round(sh * scale));
  const outCtx = out.getContext('2d');
  if (!outCtx) throw new Error('canvas');
  outCtx.fillStyle = '#ffffff';
  outCtx.fillRect(0, 0, out.width, out.height);
  outCtx.drawImage(oriented, sx, sy, sw, sh, 0, 0, out.width, out.height);
  return out;
}

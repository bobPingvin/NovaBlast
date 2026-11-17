import { GIFEncoder, quantize, applyPalette } from 'gifenc';
import JSZip from 'jszip';
import { GridState } from '../../types';

export interface ExportGifOptions {
  frames: GridState[];
  width: number;
  height: number;
  fps: number;
  scale: number;
  transparent: boolean;
  backgroundColor?: string;
}

export interface ExportSpriteSheetOptions {
  frames: GridState[];
  width: number;
  height: number;
  scale: number;
  layout: 'horizontal' | 'vertical' | 'grid';
  columns?: number;
  backgroundColor?: string;
}

/**
 * Renders a pixel grid into an HTMLCanvasElement with nearest-neighbor sharp scaling.
 */
export function renderGridToCanvas(
  grid: GridState,
  width: number,
  height: number,
  scale: number = 1,
  backgroundColor?: string | null
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, width * scale);
  canvas.height = Math.max(1, height * scale);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return canvas;

  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (backgroundColor && backgroundColor !== 'transparent') {
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const color = grid[y]?.[x];
      if (color && color !== 'transparent') {
        ctx.fillStyle = color;
        ctx.fillRect(x * scale, y * scale, scale, scale);
      }
    }
  }

  return canvas;
}

/**
 * Generates an animated GIF Blob from a sequence of frames.
 */
export async function generateGifBlob(options: ExportGifOptions): Promise<Blob> {
  const { frames, width, height, fps, scale, transparent, backgroundColor } = options;
  const frameWidth = Math.max(1, width * scale);
  const frameHeight = Math.max(1, height * scale);
  const delay = Math.max(20, Math.round(1000 / (fps || 8)));

  const gif = GIFEncoder();

  for (const frame of frames) {
    const canvas = renderGridToCanvas(
      frame,
      width,
      height,
      scale,
      transparent ? null : (backgroundColor || '#0f172a')
    );
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) continue;

    const imgData = ctx.getImageData(0, 0, frameWidth, frameHeight);
    const data = imgData.data;

    // Use quantize with appropriate format for transparency or solid colors
    const format = transparent ? 'rgba4444' : 'rgb565';
    const palette = quantize(data, 256, {
      format,
      oneBitAlpha: transparent
    });

    const index = applyPalette(data, palette, format);

    // Identify transparent index in palette if transparency is requested
    let transparentIndex: number | undefined = undefined;
    if (transparent) {
      for (let i = 0; i < palette.length; i++) {
        const item = palette[i];
        if (Array.isArray(item) && item.length >= 4 && item[3] === 0) {
          transparentIndex = i;
          break;
        }
      }
    }

    gif.writeFrame(index, frameWidth, frameHeight, {
      palette,
      delay,
      transparent: transparentIndex !== undefined,
      transparentIndex: transparentIndex !== undefined ? transparentIndex : undefined
    });
  }

  gif.finish();
  const bytes = gif.bytes();
  return new Blob([bytes], { type: 'image/gif' });
}

/**
 * Generates a Sprite Sheet PNG Canvas from frames.
 */
export function generateSpriteSheetCanvas(options: ExportSpriteSheetOptions): HTMLCanvasElement {
  const { frames, width, height, scale, layout, columns = 4, backgroundColor } = options;
  const totalFrames = Math.max(1, frames.length);
  const fWidth = width * scale;
  const fHeight = height * scale;

  let cols = totalFrames;
  let rows = 1;

  if (layout === 'horizontal') {
    cols = totalFrames;
    rows = 1;
  } else if (layout === 'vertical') {
    cols = 1;
    rows = totalFrames;
  } else if (layout === 'grid') {
    cols = Math.min(totalFrames, Math.max(1, columns));
    rows = Math.ceil(totalFrames / cols);
  }

  const sheetCanvas = document.createElement('canvas');
  sheetCanvas.width = cols * fWidth;
  sheetCanvas.height = rows * fHeight;
  const ctx = sheetCanvas.getContext('2d');
  if (!ctx) return sheetCanvas;

  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, sheetCanvas.width, sheetCanvas.height);

  if (backgroundColor && backgroundColor !== 'transparent') {
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, sheetCanvas.width, sheetCanvas.height);
  }

  frames.forEach((frame, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const destX = col * fWidth;
    const destY = row * fHeight;

    const frameCanvas = renderGridToCanvas(frame, width, height, scale, null);
    ctx.drawImage(frameCanvas, destX, destY);
  });

  return sheetCanvas;
}

/**
 * Generates a ZIP archive containing every frame as a numbered .png file.
 */
export async function generateFramesZip(
  frames: GridState[],
  width: number,
  height: number,
  scale: number,
  baseName: string = 'frame'
): Promise<Blob> {
  const zip = new JSZip();

  for (let i = 0; i < frames.length; i++) {
    const canvas = renderGridToCanvas(frames[i], width, height, scale, null);
    const dataUrl = canvas.toDataURL('image/png');
    const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');
    const paddedIndex = String(i + 1).padStart(3, '0');
    zip.file(`${baseName}_${paddedIndex}.png`, base64Data, { base64: true });
  }

  return await zip.generateAsync({ type: 'blob' });
}

/**
 * Triggers a client-side file download from a Blob or data URL.
 */
export function triggerDownload(blobOrUrl: Blob | string, filename: string): void {
  const link = document.createElement('a');
  link.download = filename;
  if (typeof blobOrUrl === 'string') {
    link.href = blobOrUrl;
  } else {
    link.href = URL.createObjectURL(blobOrUrl);
  }
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  if (typeof blobOrUrl !== 'string') {
    setTimeout(() => {
      URL.revokeObjectURL(link.href);
    }, 5000);
  }
}

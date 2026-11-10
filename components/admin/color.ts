// Samples an accent colour from a cover image in the browser: from the copy on this computer right after an upload,
// otherwise through the admin's same-origin address for the file, since reading pixels needs the same origin.

import { readableUrl } from '@/lib/admin-api/client';
import { localCopyOf } from '@/lib/upload-client';

const SAMPLE_SIZE = 48;

/**
 * The cover's average colour, weighted towards saturated pixels so the subject wins over grey backgrounds,
 * then brightened so it reads as light on the site's near-black pages. Resolves to "#RRGGBB".
 */
export async function sampleAccent(src: string): Promise<string> {
  const image = new Image();
  image.src = localCopyOf(src) ?? readableUrl(src);
  await image.decode();

  const canvas = document.createElement('canvas');
  canvas.width = SAMPLE_SIZE;
  canvas.height = SAMPLE_SIZE;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Canvas unavailable');
  context.drawImage(image, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
  const { data } = context.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE);

  let red = 0;
  let green = 0;
  let blue = 0;
  let total = 0;
  for (let i = 0; i < data.length; i += 4) {
    const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]];
    const chroma = (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
    // A small floor keeps a black-and-white cover from dividing by zero; it then averages to a grey.
    const weight = (chroma * chroma + 0.004) * (a / 255);
    red += r * weight;
    green += g * weight;
    blue += b * weight;
    total += weight;
  }
  if (total === 0) throw new Error('Transparent image');

  const [h, s, l] = rgbToHsl(red / total, green / total, blue / total);
  return hslToHex(h, s, Math.min(0.74, Math.max(0.5, l)));
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h / 6, s, l];
}

function hslToHex(h: number, s: number, l: number): string {
  const channel = (n: number) => {
    const k = (n + h * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    const value = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(value * 255)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${channel(0)}${channel(8)}${channel(4)}`.toUpperCase();
}

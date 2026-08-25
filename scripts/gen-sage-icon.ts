/**
 * Generates the Sage tab icon: an alpha-only silhouette mask of the pixel
 * character — squircle body outline + two dot eyes. White shape on transparent.
 *
 * Native tabs template-tint any image source (the tab bar color / accent), so
 * the mask's alpha is what renders — it reads as "the character" in outline,
 * tinted exactly like Home/Circle/You. Sized at 24px to match the VectorIcon
 * glyphs used by the other tabs.
 *
 * Run: npx tsx scripts/gen-sage-icon.ts
 */
import fs from 'node:fs';
import path from 'node:path';

import { PNG } from 'pngjs';

const SIZE = 24;

function makeMask(): PNG {
  const png = new PNG({ width: SIZE, height: SIZE });

  const cx = SIZE / 2;
  const bodyHalf = 10.5; // squircle half-size in px
  const cornerR = 5; // squircle corner radius

  // Squircle body: rounded-square SDF. Alpha ramp for a soft-but-crisp edge.
  function bodyAlpha(x: number, y: number): number {
    const qx = Math.abs(x - cx) - (bodyHalf - cornerR);
    const qy = Math.abs(y - cx) - (bodyHalf - cornerR);
    const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - cornerR;
    // Anti-aliased edge: 1px ramp.
    return Math.max(0, Math.min(1, 0.5 - outside));
  }

  // Two dot eyes, positioned to read as the character's face (upper area).
  const eyeY = cx - 3;
  const eyeDx = 4.5;
  const eyeR = 2.0;

  function eyeAlpha(x: number, y: number, ex: number): number {
    const d = Math.hypot(x - (cx - ex), y - eyeY);
    return Math.max(0, Math.min(1, 0.5 - (d - eyeR)));
  }

  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      const body = bodyAlpha(x + 0.5, y + 0.5);
      // Eyes are CUTOUTS: transparent holes so the tinted silhouette reads as
      // a face (two dark eye gaps), not a solid blob.
      const eyeL = eyeAlpha(x + 0.5, y + 0.5, eyeDx);
      const eyeR_ = eyeAlpha(x + 0.5, y + 0.5, -eyeDx);
      const a = Math.max(0, body - eyeL - eyeR_);
      const i = (y * SIZE + x) << 2;
      png.data[i] = 255;
      png.data[i + 1] = 255;
      png.data[i + 2] = 255;
      png.data[i + 3] = Math.round(a * 255);
    }
  }

  return png;
}

const outPath = path.resolve(__dirname, '../assets/kenney/shape/tab/sage-mask.png');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, PNG.sync.write(makeMask()));
console.log(`Wrote ${outPath}`);

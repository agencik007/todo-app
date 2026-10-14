// Generates the favicon and app icons from the two master SVGs.
// Run after changing either SVG: `npm run generate-icons` (in frontend/).
//
//   public/icons/icon.svg           -> icon-192/512.png (purpose "any"), favicon.ico
//   scripts/icons/icon-maskable.svg -> icon-maskable-192/512.png, apple-touch-icon.png
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const iconsDir = join(root, 'public', 'icons');
const iconSvg = await readFile(join(iconsDir, 'icon.svg'));
const maskableSvg = await readFile(
  join(root, 'scripts', 'icons', 'icon-maskable.svg'),
);

function png(svg, size, { opaque = false } = {}) {
  // Render at the target size (density scales the 512 viewBox) instead of
  // downscaling a bitmap, so small sizes stay sharp.
  const image = sharp(svg, { density: (72 * size) / 512 }).resize(size, size);
  // Maskable and Apple touch icons must have no transparency.
  return (opaque ? image.removeAlpha() : image)
    .png({ compressionLevel: 9 })
    .toBuffer();
}

// ICO with embedded PNG images (supported by every browser that still asks
// for /favicon.ico): 6-byte header, one 16-byte entry per image, then the data.
function ico(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(images.length, 4);
  let offset = 6 + 16 * images.length;
  const entries = images.map(({ size, data }) => {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size % 256, 0); // 0 means 256
    entry.writeUInt8(size % 256, 1);
    entry.writeUInt16LE(1, 4); // color planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += data.length;
    return entry;
  });
  return Buffer.concat([
    header,
    ...entries,
    ...images.map((image) => image.data),
  ]);
}

const outputs = {
  'icon-192.png': png(iconSvg, 192),
  'icon-512.png': png(iconSvg, 512),
  'icon-maskable-192.png': png(maskableSvg, 192, { opaque: true }),
  'icon-maskable-512.png': png(maskableSvg, 512, { opaque: true }),
  'apple-touch-icon.png': png(maskableSvg, 180, { opaque: true }),
};
for (const [name, buffer] of Object.entries(outputs)) {
  await writeFile(join(iconsDir, name), await buffer);
}

const faviconSizes = [16, 32, 48];
const favicon = ico(
  await Promise.all(
    faviconSizes.map(async (size) => ({
      size,
      data: await png(iconSvg, size),
    })),
  ),
);
await writeFile(join(root, 'public', 'favicon.ico'), favicon);

console.log(
  `Wrote ${Object.keys(outputs).join(', ')} and favicon.ico (${faviconSizes.join('/')} px)`,
);

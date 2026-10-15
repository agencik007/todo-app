// Generates the favicon, app icons and iOS splash screens from the master SVGs.
// Run after changing an SVG: `npm run generate-icons` (in frontend/).
//
//   public/icons/icon.svg           -> icon-192/512.png (purpose "any"), favicon.ico,
//                                      splash/*.png (iOS launch screens)
//   scripts/icons/icon-maskable.svg -> icon-maskable-192/512.png, apple-touch-icon.png
//   scripts/icons/shortcut-new.svg  -> shortcut-new-96/192.png ("New task" shortcut)
//
// The splash screens' <link> tags in src/index.html are rewritten too.
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const iconsDir = join(root, 'public', 'icons');
const iconSvg = await readFile(join(iconsDir, 'icon.svg'));
const maskableSvg = await readFile(
  join(root, 'scripts', 'icons', 'icon-maskable.svg'),
);
const shortcutSvg = await readFile(
  join(root, 'scripts', 'icons', 'shortcut-new.svg'),
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
  'shortcut-new-96.png': png(shortcutSvg, 96),
  'shortcut-new-192.png': png(shortcutSvg, 192),
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

// iOS ignores the manifest's background_color and shows a white screen while an
// installed app starts, unless a launch image matches the exact screen size.
// One per screen (CSS size in portrait and pixel ratio) and orientation: the
// icon centred on the manifest's background_color.
const SPLASH_BACKGROUND = '#ffffff';
const SPLASH_ICON_CSS_PX = 128;
const splashScreens = [
  // iPhones
  { width: 440, height: 956, ratio: 3 }, // 16 Pro Max
  { width: 402, height: 874, ratio: 3 }, // 16 Pro
  { width: 430, height: 932, ratio: 3 }, // 14 Pro Max, 15/16 Plus, 15 Pro Max
  { width: 393, height: 852, ratio: 3 }, // 14 Pro, 15, 15 Pro, 16
  { width: 428, height: 926, ratio: 3 }, // 12/13 Pro Max, 14 Plus
  { width: 390, height: 844, ratio: 3 }, // 12, 13, 14, 12/13 Pro
  { width: 375, height: 812, ratio: 3 }, // X, XS, 11 Pro, 12/13 mini
  { width: 414, height: 896, ratio: 3 }, // XS Max, 11 Pro Max
  { width: 414, height: 896, ratio: 2 }, // XR, 11
  { width: 375, height: 667, ratio: 2 }, // 8, SE (2nd/3rd gen)
  // iPads
  { width: 1032, height: 1376, ratio: 2 }, // Pro 13" (M4)
  { width: 1024, height: 1366, ratio: 2 }, // Pro 12.9"
  { width: 834, height: 1210, ratio: 2 }, // Pro 11" (M4)
  { width: 834, height: 1194, ratio: 2 }, // Pro 11"
  { width: 820, height: 1180, ratio: 2 }, // Air 10.9", 10th gen
  { width: 810, height: 1080, ratio: 2 }, // 9th gen 10.2"
  { width: 768, height: 1024, ratio: 2 }, // mini 7.9", 9.7"
  { width: 744, height: 1133, ratio: 2 }, // mini 8.3"
];

const splashDir = join(iconsDir, 'splash');
await rm(splashDir, { recursive: true, force: true });
await mkdir(splashDir);

const splashIcon = await png(iconSvg, SPLASH_ICON_CSS_PX * 3);
const splashLinks = [];
for (const { width, height, ratio } of splashScreens) {
  for (const orientation of ['portrait', 'landscape']) {
    const [w, h] =
      orientation === 'portrait'
        ? [width * ratio, height * ratio]
        : [height * ratio, width * ratio];
    const name = `splash-${w}x${h}.png`;
    const icon = await sharp(splashIcon)
      .resize(SPLASH_ICON_CSS_PX * ratio)
      .toBuffer();
    const image = await sharp({
      create: {
        width: w,
        height: h,
        channels: 3,
        background: SPLASH_BACKGROUND,
      },
    })
      .composite([{ input: icon, gravity: 'center' }])
      .png({ compressionLevel: 9, palette: true })
      .toBuffer();
    await writeFile(join(splashDir, name), image);
    splashLinks.push(
      `    <link\n` +
        `      rel="apple-touch-startup-image"\n` +
        `      media="(device-width: ${width}px) and (device-height: ${height}px) and (-webkit-device-pixel-ratio: ${ratio}) and (orientation: ${orientation})"\n` +
        `      href="icons/splash/${name}"\n` +
        `    />`,
    );
  }
}

// Replace the generated block in index.html, between its two markers.
const indexPath = join(root, 'src', 'index.html');
const index = await readFile(indexPath, 'utf8');
const start = '<!-- apple-touch-startup-image:start -->';
const end = '<!-- apple-touch-startup-image:end -->';
const before = index.slice(0, index.indexOf(start) + start.length);
const after = index.slice(index.indexOf(end));
if (!index.includes(start) || !index.includes(end)) {
  throw new Error(`src/index.html needs the ${start} and ${end} markers`);
}
await writeFile(
  indexPath,
  `${before}\n${splashLinks.join('\n')}\n    ${after}`,
);

console.log(
  `Wrote ${splashLinks.length} iOS splash screens to public/icons/splash/ and their links to src/index.html`,
);

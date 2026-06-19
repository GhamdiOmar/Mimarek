// Regenerate app icons / favicons from the Mimarek icon mark (navy card variant).
// Usage: node scripts/gen-favicons.mjs   (run from repo root)
import sharp from "sharp";
import { readFileSync, writeFileSync } from "node:fs";

const svg = readFileSync("apps/web/public/assets/brand/mimarek-icon-dark.svg");
const navy = { r: 3, g: 22, b: 48, alpha: 1 }; // #031630 — matches the icon card background

const targets = [
  ["apps/web/public/icons/icon-32.png", 32],
  ["apps/web/public/icons/icon-192.png", 192],
  ["apps/web/public/icons/icon-512.png", 512],
  ["apps/web/public/icons/icon-maskable-512.png", 512],
  ["apps/web/public/apple-touch-icon.png", 180],
];

for (const [file, size] of targets) {
  await sharp(svg, { density: 512 })
    .resize(size, size, { fit: "contain", background: navy })
    .flatten({ background: navy })
    .png()
    .toFile(file);
  console.log("wrote", file, `${size}x${size}`);
}

// favicon.ico — wrap a 32x32 PNG in a single-image ICO container (PNG-in-ICO, widely supported)
// Next.js decodes favicon.ico at build and requires RGBA — keep the alpha channel (no flatten)
const png32 = await sharp(svg, { density: 512 })
  .resize(32, 32, { fit: "contain", background: navy })
  .ensureAlpha()
  .png()
  .toBuffer();
const header = Buffer.alloc(6);
header.writeUInt16LE(1, 2); // type 1 = icon
header.writeUInt16LE(1, 4); // image count
const dir = Buffer.alloc(16);
dir.writeUInt8(32, 0); // width
dir.writeUInt8(32, 1); // height
dir.writeUInt16LE(1, 4); // color planes
dir.writeUInt16LE(32, 6); // bits per pixel
dir.writeUInt32LE(png32.length, 8); // image size
dir.writeUInt32LE(22, 12); // offset = 6 + 16
writeFileSync("apps/web/app/favicon.ico", Buffer.concat([header, dir, png32]));
console.log("wrote apps/web/app/favicon.ico 32x32");

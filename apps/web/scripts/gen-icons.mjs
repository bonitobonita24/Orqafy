// gen-icons.mjs — regenerate the raster favicon/app-icon set from icon.svg [ORQ-47]
//
// Source of truth: src/app/icon.svg (do NOT edit the design here — edit the SVG,
// then re-run this script to regenerate every raster).
//
// Re-run from the apps/web directory:
//     node scripts/gen-icons.mjs
// (requires the devDependencies `sharp` and `png-to-ico`)
//
// Outputs:
//   src/app/favicon.ico        multi-size ICO (16 + 32 + 48) — for clients that hit /favicon.ico
//   src/app/apple-icon.png     180x180  — apple-touch-icon
//   src/app/icon.png           512x512  — raster <link rel=icon> fallback (icon.svg still preferred)
//   public/icons/icon-192.png  192x192  — web app manifest
//   public/icons/icon-512.png  512x512  — web app manifest
//
// The SVG is rendered at a high density so downscales stay crisp and the 512 upscale
// (SVG intrinsic size is 328) is clean.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import pngToIco from "png-to-ico";

const __dirname = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(__dirname, "..");
const svgPath = join(webRoot, "src", "app", "icon.svg");
const appDir = join(webRoot, "src", "app");
const publicIconsDir = join(webRoot, "public", "icons");

// High render density -> crisp rasters at every target size.
const DENSITY = 512;

/** Render the SVG to a square PNG buffer of the given pixel size. */
async function renderPng(svg, size) {
  return sharp(svg, { density: DENSITY })
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
}

async function main() {
  const svg = await readFile(svgPath);
  await mkdir(publicIconsDir, { recursive: true });

  // Buffers bundled into favicon.ico
  const [png16, png32, png48] = await Promise.all([16, 32, 48].map((s) => renderPng(svg, s)));
  const ico = await pngToIco([png16, png32, png48]);
  await writeFile(join(appDir, "favicon.ico"), ico);

  // apple-touch-icon (180) + raster fallback icon (512)
  const [png180, png192, png512] = await Promise.all([180, 192, 512].map((s) => renderPng(svg, s)));
  await writeFile(join(appDir, "apple-icon.png"), png180);
  await writeFile(join(appDir, "icon.png"), png512);

  // Manifest icons (stable public URLs)
  await writeFile(join(publicIconsDir, "icon-192.png"), png192);
  await writeFile(join(publicIconsDir, "icon-512.png"), png512);

  console.log("Generated:");
  console.log("  src/app/favicon.ico        (16+32+48)");
  console.log("  src/app/apple-icon.png     180x180");
  console.log("  src/app/icon.png           512x512");
  console.log("  public/icons/icon-192.png  192x192");
  console.log("  public/icons/icon-512.png  512x512");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

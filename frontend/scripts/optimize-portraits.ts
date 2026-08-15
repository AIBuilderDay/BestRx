/**
 * Converts the source patient portraits in `public/images/patients/` into the two WebP sizes the
 * app actually renders: 400px for the patient grid card, 800px for the detail rail. Source PNGs
 * were 1254px and up to 2.4MB each, which is ~6x more pixels than any view uses.
 *
 * Run after adding or replacing a portrait:  pnpm images:portraits
 * Sources live in `assets/patients/` (outside `public/`, so Vite never ships them).
 */
import { mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceDir = path.join(root, 'assets/patients');
const outputDir = path.join(root, 'public/images/patients');

/** Rendered at ~300px in the grid and ~600px in the detail rail; 2x each for retina. */
const SIZES = [
  { width: 400, suffix: '' },
  { width: 800, suffix: '@2x' },
];

async function main() {
  await mkdir(outputDir, { recursive: true });
  const files = (await readdir(sourceDir)).filter((f) => /\.(png|jpe?g)$/i.test(f));

  for (const file of files) {
    const id = path.parse(file).name;
    for (const { width, suffix } of SIZES) {
      const out = path.join(outputDir, `${id}${suffix}.webp`);
      const { size } = await sharp(path.join(sourceDir, file))
        .resize(width, width, { fit: 'cover' })
        .webp({ quality: 78 })
        .toFile(out);
      console.log(`${path.basename(out)}  ${(size / 1024).toFixed(1)}KB`);
    }
  }
  console.log(`\n${files.length} portraits → ${files.length * SIZES.length} files`);
}

main();

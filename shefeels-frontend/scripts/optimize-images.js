// Image optimization script (node + sharp)
// Usage: node scripts/optimize-images.js <source-dir> <dest-dir>
// Requires: npm i -D sharp glob

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const glob = require('glob');

const src = process.argv[2] || 'src/assets';
const dest = process.argv[3] || 'src/assets-optimized';

if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });

const exts = ['jpg', 'jpeg', 'png', 'gif'];
// responsive widths to generate (will create files like name-480.avif, name-480.webp)
const widths = [480, 768, 1280, 1920];

glob(`${src}/**/*.{${exts.join(',')}}`, {}, async (err, files) => {
  if (err) throw err;
  console.log('Found', files.length, 'images to process');
  for (const f of files) {
    const rel = path.relative(src, f);
    const outDir = path.join(dest, path.dirname(rel));
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    const base = path.basename(f, path.extname(f));
    // generate full-size AVIF/WebP as before
    const outAvif = path.join(outDir, base + '.avif');
    const outWebp = path.join(outDir, base + '.webp');

    try {
      await sharp(f)
        .avif({ quality: 60 })
        .toFile(outAvif);
      await sharp(f)
        .webp({ quality: 70 })
        .toFile(outWebp);
      console.log('Optimized (full):', f, '->', outAvif, outWebp);
    } catch (e) {
      console.error('Failed to optimize full-size', f, e);
    }

    // generate responsive variants
    for (const w of widths) {
      const outAvifW = path.join(outDir, `${base}-${w}.avif`);
      const outWebpW = path.join(outDir, `${base}-${w}.webp`);
      const outRasterW = path.join(outDir, `${base}-${w}${path.extname(f)}`);
      try {
        await sharp(f)
          .resize({ width: w, withoutEnlargement: true })
          .avif({ quality: 60 })
          .toFile(outAvifW);
        await sharp(f)
          .resize({ width: w, withoutEnlargement: true })
          .webp({ quality: 70 })
          .toFile(outWebpW);
        // also write a raster fallback (jpg/png) for older browsers
        await sharp(f)
          .resize({ width: w, withoutEnlargement: true })
          .toFile(outRasterW);
        console.log('Optimized (w=' + w + '):', f, '->', outAvifW, outWebpW, outRasterW);
      } catch (e) {
        console.error('Failed to optimize width', w, f, e);
      }
    }
  }
});

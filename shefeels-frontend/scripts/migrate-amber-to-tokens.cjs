#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = process.cwd();
const exts = new Set(['.tsx', '.ts', '.jsx', '.js', '.css', '.cjs', '.html']);

let changedFiles = [];
let totalFiles = 0;

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (['node_modules', '.git', 'dist', 'build', 'out'].includes(e.name)) continue;
      walk(full);
    } else if (e.isFile()) {
      const ext = path.extname(e.name).toLowerCase();
      if (exts.has(ext)) processFile(full);
    }
  }
}

function processFile(file) {
  totalFiles++;
  let src = fs.readFileSync(file, 'utf8');
  let out = src;

  // Replace hex codes first
  out = out.replace(/var(--hl-gold)/gi, 'var(--hl-gold)');
  out = out.replace(/var(--hl-gold-strong)/gi, 'var(--hl-gold-strong)');

  // Replace text-[var(--hl-gold)]-XXX with token while preserving optional opacity (/90)
  out = out.replace(/text-\[var\(--hl-gold\)\]-(?:\d+)(\/\d+)?/g, 'text-[var(--hl-gold)]$1');
  out = out.replace(/bg-\[var\(--hl-gold\)\]-(?:\d+)(\/\d+)?/g, 'bg-[var(--hl-gold)]$1');
  out = out.replace(/ring-\[var\(--hl-gold\)\]-(?:\d+)(\/\d+)?/g, 'ring-[var(--hl-gold)]$1');
  out = out.replace(/focus:ring-\[var\(--hl-gold\)\]-(?:\d+)(\/\d+)?/g, 'focus:ring-[var(--hl-gold)]$1');
  out = out.replace(/hover:bg-\[var\(--hl-gold\)\]-(?:\d+)(\/\d+)?/g, 'hover:bg-[var(--hl-gold)]$1');
  out = out.replace(/hover:text-\[var\(--hl-gold\)\]-(?:\d+)(\/\d+)?/g, 'hover:text-[var(--hl-gold)]$1');
  out = out.replace(/accent-amber-(?:\d+)(\/\d+)?/g, 'accent-[var(--hl-gold)]$1');

  // gradients
  out = out.replace(/from-amber-(?:\d+)(\/\d+)?/g, 'from-[var(--hl-gold)]$1');
  out = out.replace(/to-amber-(?:\d+)(\/\d+)?/g, 'to-[var(--hl-gold-strong)]$1');

  // general amber-* (catch-all) -> use token (best-effort)
  out = out.replace(/\bamber-(?:\d+)\b/g, 'var(--hl-gold)');

  // Replace common named classes like text-[var(--hl-gold)], bg-[var(--hl-gold)] etc (without numeric suffix)
  out = out.replace(/text-\[var\(--hl-gold\)\]\b/g, 'text-[var(--hl-gold)]');
  out = out.replace(/bg-\[var\(--hl-gold\)\]\b/g, 'bg-[var(--hl-gold)]');
  out = out.replace(/ring-\[var\(--hl-gold\)\]\b/g, 'ring-[var(--hl-gold)]');
  out = out.replace(/hover:text-\[var\(--hl-gold\)\]\b/g, 'hover:text-[var(--hl-gold)]');
  out = out.replace(/hover:bg-\[var\(--hl-gold\)\]\b/g, 'hover:bg-[var(--hl-gold)]');

  // Replace inline styles like text-[var(--hl-gold)] -> text-[var(--hl-gold)] already handled by hex replacement

  if (out !== src) {
    // backup original into bak_files_archive preserving relative path
    try {
      const rel = path.relative(root, file);
      const bakPath = path.join(root, 'bak_files_archive', rel + '.bak');
      fs.mkdirSync(path.dirname(bakPath), { recursive: true });
      fs.writeFileSync(bakPath, src, 'utf8');
    } catch (err) {
      console.error('Failed to write backup for', file, err);
    }
    fs.writeFileSync(file, out, 'utf8');
    changedFiles.push(file);
  }
}

console.log('Scanning for files...');
walk(root);
console.log(`Scanned ${totalFiles} files. Modified ${changedFiles.length} files.`);
if (changedFiles.length > 0) {
  console.log('Modified files:');
  changedFiles.forEach(f => console.log(' -', path.relative(root, f)));
} else {
  console.log('No changes needed.');
}

// Exit with success
process.exit(0);

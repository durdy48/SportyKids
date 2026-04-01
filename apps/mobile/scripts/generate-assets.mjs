#!/usr/bin/env node

/**
 * Generate placeholder app assets for SportyKids.
 *
 * Uses sharp with SVG overlays to produce all required icons,
 * splash screens, and store graphics. Idempotent — safe to run repeatedly.
 *
 * Usage:  node scripts/generate-assets.mjs
 * Deps:   sharp (devDependency)
 */

import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { strict as assert } from 'node:assert';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ASSETS_DIR = resolve(__dirname, '..', 'src', 'assets');

const BLUE = '#2563EB';

/* eslint-disable no-console */
let sharp;
try {
  sharp = (await import('sharp')).default;
} catch {
  console.error('Error: sharp is not installed. Run: npm install --save-dev sharp');
  process.exit(1);
}

// Asset manifest: [filename, width, height, svgGenerator]
const manifest = [
  [
    'icon.png',
    1024,
    1024,
    () => `
      <svg width="1024" height="1024">
        <rect width="1024" height="1024" fill="${BLUE}" rx="180"/>
        <text x="512" y="560" font-family="Arial, Helvetica, sans-serif"
              font-size="400" font-weight="bold" fill="white"
              text-anchor="middle" dominant-baseline="middle">SK</text>
      </svg>`,
  ],
  [
    'adaptive-icon.png',
    512,
    512,
    () => `
      <svg width="512" height="512">
        <circle cx="256" cy="256" r="220" fill="${BLUE}"/>
        <text x="256" y="280" font-family="Arial, Helvetica, sans-serif"
              font-size="200" font-weight="bold" fill="white"
              text-anchor="middle" dominant-baseline="middle">SK</text>
      </svg>`,
  ],
  [
    'splash-icon.png',
    200,
    200,
    () => `
      <svg width="200" height="200">
        <circle cx="100" cy="100" r="90" fill="${BLUE}"/>
        <text x="100" y="110" font-family="Arial, Helvetica, sans-serif"
              font-size="80" font-weight="bold" fill="white"
              text-anchor="middle" dominant-baseline="middle">SK</text>
      </svg>`,
  ],
  [
    'favicon.png',
    48,
    48,
    () => `
      <svg width="48" height="48">
        <rect width="48" height="48" fill="${BLUE}" rx="8"/>
        <text x="24" y="28" font-family="Arial, Helvetica, sans-serif"
              font-size="20" font-weight="bold" fill="white"
              text-anchor="middle" dominant-baseline="middle">SK</text>
      </svg>`,
  ],
  [
    'feature-graphic.png',
    1024,
    500,
    () => `
      <svg width="1024" height="500">
        <rect width="1024" height="500" fill="${BLUE}"/>
        <text x="512" y="220" font-family="Arial, Helvetica, sans-serif"
              font-size="72" font-weight="bold" fill="white"
              text-anchor="middle" dominant-baseline="middle">SportyKids</text>
        <text x="512" y="300" font-family="Arial, Helvetica, sans-serif"
              font-size="32" fill="white"
              text-anchor="middle" dominant-baseline="middle">Sports news for kids</text>
      </svg>`,
  ],
];

async function generate() {
  await mkdir(ASSETS_DIR, { recursive: true });

  for (const [name, width, height, svgFn] of manifest) {
    const outputPath = resolve(ASSETS_DIR, name);
    const svg = svgFn();

    await sharp(Buffer.from(svg)).png().toFile(outputPath);

    // Validate output dimensions
    const meta = await sharp(outputPath).metadata();
    assert.strictEqual(meta.width, width, `${name} width mismatch: expected ${width}, got ${meta.width}`);
    assert.strictEqual(meta.height, height, `${name} height mismatch: expected ${height}, got ${meta.height}`);

    console.log(`  ✓ ${name} (${width}×${height})`);
  }

  console.log('\nAll assets generated and validated.');
}

generate().catch((err) => {
  console.error('Asset generation failed:', err);
  process.exit(1);
});

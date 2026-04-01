// scripts/generate-screenshots.mjs
//
// Generates store screenshots using Playwright against the running web app.
// Prerequisites: npm run dev:web (running on localhost:3000)
// Usage: node scripts/generate-screenshots.mjs
//
// Output:
//   apps/mobile/store-metadata/screenshots/ios/    (iPhone 15 Pro: 1179x2556)
//   apps/mobile/store-metadata/screenshots/android/ (Pixel 8: 1080x2400)

import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const DEVICES = {
  ios: {
    name: 'iPhone 15 Pro',
    viewport: { width: 393, height: 852 },
    deviceScaleFactor: 3, // Output: 1179x2556
    outputDir: join(ROOT, 'apps/mobile/store-metadata/screenshots/ios'),
  },
  android: {
    name: 'Pixel 8',
    viewport: { width: 412, height: 915 },
    deviceScaleFactor: 2.625, // Output: ~1080x2402
    outputDir: join(ROOT, 'apps/mobile/store-metadata/screenshots/android'),
  },
};

const SCREENS = [
  {
    name: '01-home-feed',
    path: '/',
    waitFor: '[data-testid="news-card"]',
    description: 'Home feed with personalized sports news',
  },
  {
    name: '02-quiz',
    path: '/quiz',
    waitFor: '[data-testid="quiz-game"]',
    description: 'Daily sports quiz',
  },
  {
    name: '03-reels',
    path: '/reels',
    waitFor: '[data-testid="reel-card"]',
    description: 'Short sports video reels',
  },
  {
    name: '04-collection',
    path: '/collection',
    waitFor: '[data-testid="sticker-card"]',
    description: 'Sticker collection and achievements',
  },
  {
    name: '05-parental',
    path: '/parents',
    waitFor: '[data-testid="parental-panel"]',
    description: 'Parental controls dashboard',
  },
];

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

async function captureScreenshots() {
  const browser = await chromium.launch();

  for (const [platform, device] of Object.entries(DEVICES)) {
    mkdirSync(device.outputDir, { recursive: true });
    console.log(`\n--- ${device.name} (${platform}) ---`);

    const context = await browser.newContext({
      viewport: device.viewport,
      deviceScaleFactor: device.deviceScaleFactor,
      isMobile: true,
      hasTouch: true,
    });

    // Set up a user context (skip onboarding)
    await context.addCookies([]);
    const page = await context.newPage();

    // Seed user via localStorage to skip onboarding
    await page.goto(BASE_URL);
    await page.evaluate(() => {
      localStorage.setItem(
        'sportykids-user',
        JSON.stringify({
          id: 'screenshot-user',
          name: 'Demo',
          age: 10,
          favoriteSports: ['football', 'basketball', 'tennis'],
          locale: 'en',
        }),
      );
    });

    for (const screen of SCREENS) {
      console.log(`  Capturing ${screen.name}...`);
      await page.goto(`${BASE_URL}${screen.path}`, {
        waitUntil: 'networkidle',
      });

      // Wait for key element (with timeout fallback)
      try {
        await page.waitForSelector(screen.waitFor, { timeout: 5000 });
      } catch {
        console.log(`    Warning: ${screen.waitFor} not found, capturing anyway`);
      }

      // Small delay for animations to settle
      await page.waitForTimeout(500);

      const filepath = join(device.outputDir, `${screen.name}.png`);
      await page.screenshot({ path: filepath, fullPage: false });
      console.log(`    Saved: ${filepath}`);
    }

    await context.close();
  }

  await browser.close();
  console.log('\nDone! Screenshots saved to apps/mobile/store-metadata/screenshots/');
}

captureScreenshots().catch((err) => {
  console.error('Screenshot generation failed:', err);
  process.exit(1);
});

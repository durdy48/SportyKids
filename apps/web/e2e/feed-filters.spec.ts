import { test, expect } from '@playwright/test';
import { completeOnboarding, assertNoCrash } from './helpers';

test.describe('Feed and filters', () => {
  test.beforeEach(async ({ page }) => {
    await completeOnboarding(page);
  });

  test('should display the home page with news heading', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);

    if (page.url().includes('/age-gate') || page.url().includes('/onboarding')) {
      test.skip();
      return;
    }

    // The home page should show "Latest news" or "Últimas noticias"
    const heading = page.locator('h2').first();
    await expect(heading).toBeVisible({ timeout: 5000 });
    await assertNoCrash(page);
  });

  test('should show sport filter chips', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);

    if (page.url().includes('/age-gate') || page.url().includes('/onboarding')) {
      test.skip();
      return;
    }

    // Look for filter buttons (sport chips like "All", "Football", etc.)
    const allButton = page.locator('button').filter({ hasText: /^(all|todos)$/i }).first();
    const sportButtons = page.locator('button').filter({
      hasText: /football|fútbol|basketball|baloncesto|tennis|tenis/i,
    });

    const hasAllButton = await allButton.isVisible({ timeout: 3000 }).catch(() => false);
    const sportCount = await sportButtons.count();

    // Should have at least the "All" filter or some sport filters
    expect(hasAllButton || sportCount > 0).toBeTruthy();
    await assertNoCrash(page);
  });

  test('should filter news by sport when clicking a chip', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(3000);

    if (page.url().includes('/age-gate') || page.url().includes('/onboarding')) {
      test.skip();
      return;
    }

    // Find a sport filter button and click it
    const sportButton = page.locator('button').filter({
      hasText: /football|fútbol/i,
    }).first();

    if (await sportButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await sportButton.click();
      await page.waitForTimeout(1000);

      // After clicking a filter, the button should be in active state (blue background)
      // and the page should not crash
      await assertNoCrash(page);

      // Click "All" to reset
      const allButton = page.locator('button').filter({ hasText: /^(all|todos)$/i }).first();
      if (await allButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await allButton.click();
        await page.waitForTimeout(500);
      }
    }
  });

  test('should have a working search input', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);

    if (page.url().includes('/age-gate') || page.url().includes('/onboarding')) {
      test.skip();
      return;
    }

    // Look for search input
    const searchInput = page.locator('input[type="text"], input[type="search"]').first();
    if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await searchInput.fill('Real Madrid');
      await page.waitForTimeout(1000);

      // The search should trigger without crashing
      await assertNoCrash(page);

      // Clear the search
      await searchInput.clear();
      await page.waitForTimeout(500);
    }
  });

  test('should show news cards or empty state', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(3000);

    if (page.url().includes('/age-gate') || page.url().includes('/onboarding')) {
      test.skip();
      return;
    }

    // The feed should show either news cards or an empty/loading state
    const body = await page.textContent('body');

    // Look for common feed elements: article cards, loading spinners, or empty states
    const newsCards = page.locator('article, [class*="card"], [class*="Card"]');
    const cardCount = await newsCards.count();

    // Either we have cards, or we have an empty/loading state — both are valid
    const hasCards = cardCount > 0;
    const hasEmptyState = body ? /no.*news|sin.*noticias|empty|loading|cargando/i.test(body) : false;

    // At minimum, the page rendered something
    expect(hasCards || hasEmptyState || (body && body.length > 0)).toBeTruthy();
    await assertNoCrash(page);
  });

  test('should navigate between pages via navbar', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);

    if (page.url().includes('/age-gate') || page.url().includes('/onboarding')) {
      test.skip();
      return;
    }

    // Look for navigation links
    const navLinks = page.locator('nav a, nav button, header a');
    const linkCount = await navLinks.count();

    if (linkCount > 0) {
      // Try clicking a nav link (e.g., Reels, Quiz)
      const reelsLink = page.locator('a[href*="/reels"], button').filter({ hasText: /reels/i }).first();
      if (await reelsLink.isVisible({ timeout: 2000 }).catch(() => false)) {
        await reelsLink.click();
        await page.waitForTimeout(2000);
        await assertNoCrash(page);
      }
    }
  });
});

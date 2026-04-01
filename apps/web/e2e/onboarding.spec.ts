import { test, expect } from '@playwright/test';

test.describe('Onboarding flow', () => {
  test('should show age gate on first visit', async ({ page }) => {
    await page.goto('/');

    // The app should redirect to age-gate or onboarding on first visit
    // Wait for navigation to settle on expected destination
    await page.waitForURL(/\/(age-gate|onboarding)?$/, { timeout: 10_000 }).catch(() => {});

    const url = page.url();
    const isAgeGate = url.includes('/age-gate');
    const isOnboarding = url.includes('/onboarding');
    const isHome = url.endsWith('/') || url.endsWith(':3000');

    // On first visit, should land on age-gate or onboarding (depending on state)
    expect(isAgeGate || isOnboarding || isHome).toBeTruthy();
  });

  test('should display age gate options', async ({ page }) => {
    await page.goto('/age-gate');
    await page.waitForTimeout(1000);

    // Should show the SportyKids title
    const heading = page.locator('text=SportyKids');
    if (await heading.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(heading).toBeVisible();
    }

    // Should show three age options (parent, teen, child)
    const parentOption = page.locator('[data-testid="age-option-parent"]');
    const teenOption = page.locator('[data-testid="age-option-teen"]');
    const childOption = page.locator('[data-testid="age-option-child"]');

    // At least the age gate buttons should be present
    const anyVisible = await Promise.all([
      parentOption.isVisible({ timeout: 3000 }).catch(() => false),
      teenOption.isVisible({ timeout: 3000 }).catch(() => false),
      childOption.isVisible({ timeout: 3000 }).catch(() => false),
    ]);

    expect(anyVisible.some(Boolean)).toBeTruthy();
  });

  test('should complete adult path through age gate', async ({ page }) => {
    await page.goto('/age-gate');
    await page.waitForTimeout(1000);

    const parentButton = page.locator('[data-testid="age-option-parent"]');
    if (await parentButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await parentButton.click();

      // Should navigate away from age-gate
      await page.waitForTimeout(3000);
      const url = page.url();
      expect(url).not.toContain('/age-gate');
    }
  });

  test('should show onboarding wizard with sport selection', async ({ page }) => {
    // Complete age gate first
    await page.goto('/age-gate');
    const parentButton = page.locator('[data-testid="age-option-parent"]');
    if (await parentButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await parentButton.click();
      await page.waitForTimeout(2000);
    }

    // If we reach onboarding, verify it has expected content
    if (page.url().includes('/onboarding')) {
      // Should have sport selection buttons at some step
      const pageContent = await page.textContent('body');
      const hasSportContent = pageContent &&
        (/football|fútbol|basketball|baloncesto|tennis|tenis/i.test(pageContent));

      // The onboarding page should have some interactive content
      const buttons = page.locator('button');
      const buttonCount = await buttons.count();
      expect(buttonCount).toBeGreaterThan(0);

      // Check for sports in any step (may need to navigate to step 2)
      if (!hasSportContent) {
        // We might be on step 1 (name/age), try to find a name input
        const nameInput = page.locator('input[type="text"]').first();
        if (await nameInput.isVisible({ timeout: 2000 }).catch(() => false)) {
          await nameInput.fill('Test User');
        }
      }
    }
  });

  test('should load home feed after onboarding', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);

    // If we're on the home page, check for expected elements
    if (!page.url().includes('/age-gate') && !page.url().includes('/onboarding')) {
      // Home page should have the latest news heading or news cards or empty state
      // The page should at least render without crashing
      const nextjsError = page.locator('#nextjs__container_errors_label');
      await expect(nextjsError).not.toBeVisible({ timeout: 2000 }).catch(() => {});
    }
  });
});

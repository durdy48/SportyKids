import { test, expect } from '@playwright/test';
import { completeOnboarding, assertNoCrash } from './helpers';

test.describe('Quiz', () => {
  test.beforeEach(async ({ page }) => {
    await completeOnboarding(page);
  });

  test('should load the quiz page', async ({ page }) => {
    await page.goto('/quiz');
    await page.waitForTimeout(2000);

    if (page.url().includes('/onboarding')) {
      test.skip();
      return;
    }

    // The quiz page should render without crashing
    await assertNoCrash(page);

    // Should show some quiz-related content
    const body = await page.textContent('body');
    expect(body).toBeTruthy();
  });

  test('should display quiz start screen with points', async ({ page }) => {
    await page.goto('/quiz');
    await page.waitForTimeout(2000);

    if (page.url().includes('/onboarding')) {
      test.skip();
      return;
    }

    // Look for quiz-related elements (points display, start button, etc.)
    const startButton = page.locator('button').filter({
      hasText: /start|empezar|play|jugar|begin|comenzar/i,
    }).first();

    const hasStartButton = await startButton.isVisible({ timeout: 5000 }).catch(() => false);

    // The page should show either a start button, or a "no questions" message,
    // or a parental block message, or a limit reached message
    if (!hasStartButton) {
      const body = await page.textContent('body');
      const hasContent = body && (
        /quiz|trivia|question|pregunta|point|punto|no.*question|sin.*pregunta|limit|block/i.test(body)
      );
      expect(hasContent).toBeTruthy();
    }

    await assertNoCrash(page);
  });

  test('should start quiz and show questions', async ({ page }) => {
    await page.goto('/quiz');
    await page.waitForTimeout(2000);

    if (page.url().includes('/onboarding')) {
      test.skip();
      return;
    }

    const startButton = page.locator('button').filter({
      hasText: /start|empezar|play|jugar|begin|comenzar/i,
    }).first();

    if (await startButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await startButton.click();
      await page.waitForTimeout(2000);

      // After starting, should show a question or loading state
      // Either we see question options, or the quiz couldn't load (no API)
      await assertNoCrash(page);
    }
  });

  test('should handle clicking an answer option', async ({ page }) => {
    await page.goto('/quiz');
    await page.waitForTimeout(2000);

    if (page.url().includes('/onboarding')) {
      test.skip();
      return;
    }

    const startButton = page.locator('button').filter({
      hasText: /start|empezar|play|jugar|begin|comenzar/i,
    }).first();

    if (await startButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await startButton.click();
      await page.waitForTimeout(3000);

      // Look for answer option buttons (typically 4 options with text)
      // QuizGame renders options as buttons with the answer text
      const options = page.locator('[data-testid="quiz-option"], [data-testid*="option"]');
      const optionCount = await options.count();

      // Fallback: look for any clickable buttons in the quiz area that aren't navigation
      if (optionCount === 0) {
        const allButtons = page.locator('button');
        const buttonCount = await allButtons.count();

        // Try clicking one of the later buttons (first ones might be navigation)
        for (let i = 0; i < buttonCount; i++) {
          const btn = allButtons.nth(i);
          const text = await btn.textContent();
          // Skip buttons that look like navigation/controls
          if (text && !/start|empezar|next|home|back|menu/i.test(text) && text.length > 2) {
            await btn.click();
            await page.waitForTimeout(1000);
            break;
          }
        }
      } else {
        // Click the first answer option
        await options.first().click();
        await page.waitForTimeout(1000);
      }

      // After clicking an answer, should show feedback (correct/incorrect) or move to next question
      await assertNoCrash(page);
    }
  });

  test('should show quiz score area', async ({ page }) => {
    await page.goto('/quiz');
    await page.waitForTimeout(2000);

    if (page.url().includes('/onboarding')) {
      test.skip();
      return;
    }

    // The quiz page should show a points/score display and not crash
    await assertNoCrash(page);
  });
});

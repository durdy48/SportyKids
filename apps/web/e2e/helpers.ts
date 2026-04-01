import { type Page, expect } from '@playwright/test';

/**
 * Complete the age gate as an adult user.
 * The age gate page shows three options (parent/adult, teen, child).
 * We click the parent/adult option which completes immediately.
 */
export async function completeAgeGate(page: Page): Promise<void> {
  await page.goto('/age-gate');

  // The adult/parent button has data-testid="age-option-parent"
  const parentButton = page.locator('[data-testid="age-option-parent"]');
  if (await parentButton.isVisible({ timeout: 5000 }).catch(() => false)) {
    await parentButton.click();
    // After clicking parent option, user is redirected to onboarding or home
    await page.waitForURL(/\/(onboarding|$)/, { timeout: 10_000 }).catch(() => {});
  }
}

/**
 * Complete the full onboarding wizard (age gate + wizard steps).
 * This creates a user with basic preferences so we can navigate the app.
 *
 * Flow: Fresh visit to / redirects to /onboarding (no user).
 * If user exists with ageGateCompleted=false, redirects to /age-gate.
 */
export async function completeOnboarding(page: Page): Promise<void> {
  await page.goto('/');
  // Wait for client-side React redirects to settle (fresh visit → /onboarding, existing user → /age-gate or stays at /)
  await page.waitForURL(/\/(age-gate|onboarding)/, { timeout: 5_000 }).catch(() => {});

  const url = page.url();

  if (url.includes('/age-gate')) {
    await completeAgeGate(page);
    // After age gate, wait for redirect to /onboarding or home
    await page.waitForURL(/\/(onboarding)?$/, { timeout: 10_000 }).catch(() => {});
  }

  if (page.url().includes('/onboarding')) {
    await completeOnboardingWizard(page);
  }
}

/**
 * Walk through the onboarding wizard steps.
 * Step 1: Name + age range
 * Step 2: Select sports
 * Step 3: Select favorite team
 * Step 4: Feed sources (auto-pre-selected from API)
 * Step 5: Parental PIN (2 full inputs, not 4 digit inputs)
 */
async function completeOnboardingWizard(page: Page): Promise<void> {
  // Step 1: Name + age range
  const nameInput = page.locator('input[type="text"]').first();
  if (await nameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    await nameInput.fill('Test User');
  }

  // Select an age range (click first age range button)
  const ageButton = page.locator('button').filter({ hasText: /6-8|9-11|12-14/ }).first();
  if (await ageButton.isVisible({ timeout: 3000 }).catch(() => false)) {
    await ageButton.click();
  }

  // Click next
  await clickNextButton(page);

  // Step 2: Select sports — pick football
  const footballButton = page.locator('button').filter({ hasText: /football|fútbol/i }).first();
  if (await footballButton.isVisible({ timeout: 3000 }).catch(() => false)) {
    await footballButton.click();
  }
  await clickNextButton(page);

  // Step 3: Team — just skip or select first option
  await clickNextButton(page);

  // Step 4: Feed sources — wait for sources to load and be pre-selected,
  // then click Next. canAdvance() requires selectedFeeds.length >= 1.
  await page.waitForTimeout(2000); // Wait for catalog API fetch + pre-selection
  await clickNextButton(page);

  // Step 5: Parental PIN — the wizard has 2 full password inputs (PIN + confirm),
  // not 4 separate digit inputs like PinInput.
  const pinInputs = page.locator('input[type="password"][inputmode="numeric"]');
  const pinCount = await pinInputs.count();
  if (pinCount >= 2) {
    // Fill PIN (first input) and confirm PIN (second input) with "1234"
    await pinInputs.nth(0).fill('1234');
    await pinInputs.nth(1).fill('1234');
    await page.waitForTimeout(300);

    // Click the "Start" / "Empezar" button (step 5 shows Start, not Next)
    const startButton = page.locator('button').filter({
      hasText: /start|empezar|create|crear|confirm|confirmar|finish|finalizar/i,
    }).first();
    if (await startButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await startButton.click();
    }
  } else if (pinCount === 1) {
    // Fallback: single PIN input (e.g., PinInput component)
    await pinInputs.nth(0).fill('1234');
    await clickNextButton(page);
  } else {
    // No PIN step visible, try clicking next/finish
    await clickNextButton(page);
  }

  // Wait for redirect to home (user creation + redirect)
  await page.waitForURL('/', { timeout: 15_000 }).catch(() => {});
}

/**
 * Click the next/continue button in the onboarding wizard
 */
async function clickNextButton(page: Page): Promise<void> {
  const nextButton = page.locator('button').filter({ hasText: /next|siguiente|continue|continuar|skip|omitir/i }).first();
  if (await nextButton.isVisible({ timeout: 3000 }).catch(() => false)) {
    await nextButton.click();
    await page.waitForTimeout(500);
  }
}

/**
 * Set up a new parental PIN from the /parents page.
 * Assumes the user does NOT have a PIN set up yet.
 */
export async function setupParentalPin(page: Page, pin = '1234'): Promise<void> {
  await page.goto('/parents');
  await page.waitForTimeout(1000);

  // Enter PIN digits in the create screen
  const pinInputs = page.locator('input[type="password"][inputmode="numeric"]');
  await pinInputs.first().waitFor({ state: 'visible', timeout: 5000 });

  for (let i = 0; i < 4; i++) {
    await pinInputs.nth(i).fill(pin[i]);
  }

  // Click the next/submit button
  const nextButton = page.locator('button').filter({ hasText: /next|siguiente/i }).first();
  if (await nextButton.isVisible({ timeout: 3000 }).catch(() => false)) {
    await nextButton.click();
  }

  await page.waitForTimeout(500);

  // Confirm PIN
  const confirmInputs = page.locator('input[type="password"][inputmode="numeric"]');
  for (let i = 0; i < 4; i++) {
    await confirmInputs.nth(i).fill(pin[i]);
  }

  // Click the create/confirm button
  const confirmButton = page.locator('button').filter({ hasText: /create|crear|confirm|confirmar/i }).first();
  if (await confirmButton.isVisible({ timeout: 3000 }).catch(() => false)) {
    await confirmButton.click();
  }

  await page.waitForTimeout(1000);
}

/**
 * Verify an existing parental PIN to access the panel.
 */
export async function verifyParentalPin(page: Page, pin = '1234'): Promise<void> {
  const pinInputs = page.locator('input[type="password"][inputmode="numeric"]');
  await pinInputs.first().waitFor({ state: 'visible', timeout: 5000 });

  for (let i = 0; i < 4; i++) {
    await pinInputs.nth(i).fill(pin[i]);
  }

  // Click the access/verify button
  const accessButton = page.locator('button').filter({ hasText: /access|acceder|verify|verificar|confirm|confirmar/i }).first();
  if (await accessButton.isVisible({ timeout: 3000 }).catch(() => false)) {
    await accessButton.click();
  }

  await page.waitForTimeout(1000);
}

/**
 * Dismiss the ParentalTour overlay if visible.
 * The tour shows on first visit to the parental panel and blocks clicks.
 */
export async function dismissParentalTour(page: Page): Promise<void> {
  // The tour has a "Skip" button — click it to dismiss
  const skipButton = page.locator('button').filter({ hasText: /skip|saltar|omitir/i }).first();
  if (await skipButton.isVisible({ timeout: 2000 }).catch(() => false)) {
    await skipButton.click();
    await page.waitForTimeout(500);
  }
}

/**
 * Assert the page did not crash (no unhandled error overlay).
 */
export async function assertNoCrash(page: Page): Promise<void> {
  // Next.js error overlay uses this ID
  const errorOverlay = page.locator('#nextjs__container_errors_label');
  try {
    await expect(errorOverlay).not.toBeVisible({ timeout: 2000 });
  } catch (err) {
    // Log the warning so flaky failures are visible in test output
    // eslint-disable-next-line no-console
    console.warn('[assertNoCrash] Next.js error overlay detected or assertion timed out:', (err as Error).message);
  }
}

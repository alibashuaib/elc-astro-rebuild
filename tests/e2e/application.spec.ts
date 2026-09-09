import { test, expect, type ConsoleMessage, type Page } from '@playwright/test';

function failOnConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (msg: ConsoleMessage) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(`${err.name}: ${err.message}`));
  return errors;
}

test('adult student completes the placement test, books a slot, and submits an application', async ({ page }) => {
  test.setTimeout(120_000);
  const errors = failOnConsoleErrors(page);

  await page.goto('/en/placement-test/');
  await page.getByLabel('First name').fill('Application');
  await page.getByLabel('Father\'s name').fill('Smoke');
  await page.getByLabel('Grandfather\'s name').fill('Test');
  await page.getByLabel('Family name').fill('User');
  await page.getByLabel('WhatsApp number').fill('+966500000001');
  await page.getByLabel('Date of birth').fill('1995-01-01'); // well over 11, stays on the adults track
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByLabel('National ID / Iqama / passport number').fill('1234567890');
  await page.getByLabel('Nationality').fill('Saudi');
  await page.getByRole('radio', { name: 'A friend' }).check();
  await page.getByLabel(/I acknowledge that I have read/).check();
  await page.getByLabel(/I agree \(as the trainee or their guardian\)/).check();
  await page.getByRole('button', { name: 'Start test' }).click();

  // Answer every adults-track question with the first available option until
  // the result card appears -- the adults bank runs a fixed sequential walk
  // (see placement-test-worker/src/db.ts/pickNextQuestion), so this always
  // terminates.
  const resultCard = page.locator('#placement-result');
  for (let i = 0; i < 100 && !(await resultCard.isVisible()); i++) {
    const option = page.locator('#pt-options button').first();
    if (await option.isVisible().catch(() => false) && !(await resultCard.isVisible())) {
      await option.click({ timeout: 5_000 }).catch(() => {});
    } else {
      const skip = page.getByRole('button', { name: /skip/i });
      if (await skip.isVisible().catch(() => false)) await skip.click({ timeout: 5_000 }).catch(() => {});
    }
    await page.waitForTimeout(150);
  }
  await expect(resultCard).toBeVisible({ timeout: 20_000 });

  const slotButton = page.locator('#pt-slots button').first();
  await expect(slotButton).toBeVisible({ timeout: 10_000 });
  await slotButton.click();

  const applyLink = page.locator('#pt-apply');
  await expect(applyLink).toBeVisible();
  await applyLink.click();

  await expect(page.getByRole('heading', { name: 'Complete your application' })).toBeVisible();
  await page.getByLabel('Course').selectOption({ index: 1 });
  await page.getByRole('button', { name: 'Submit application' }).click();

  await expect(page.getByRole('heading', { name: 'Application received' })).toBeVisible({ timeout: 10_000 });

  expect(errors, `console errors:\n${errors.join('\n')}`).toEqual([]);
});

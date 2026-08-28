import { test, expect, type ConsoleMessage, type Page } from '@playwright/test';

/**
 * Fails the test on any console error or uncaught exception.
 *
 * This is the point of the file. Both faults that reached main during the
 * interactive-kids merge were runtime-only: a call to a helper that no longer
 * existed, and CSS that silently stopped matching. The build succeeded and
 * every unit test passed in both cases.
 */
function failOnConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (msg: ConsoleMessage) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(`${err.name}: ${err.message}`));
  return errors;
}

async function startKidsTest(page: Page) {
  await page.goto('/en/placement-test/');
  await page.getByLabel('Full name').fill('Smoke Test');
  await page.getByLabel('WhatsApp number').fill('+966500000000');
  // Under 11, so the form assigns the kids track on its own.
  await page.getByLabel('Date of birth').fill('2018-01-01');
  await page.getByLabel('Guardian name').fill('Guardian');
  await page.getByRole('button', { name: 'Start test' }).click();
}

test('kids placement test starts, renders a question and grades an answer', async ({ page }) => {
  const errors = failOnConsoleErrors(page);

  await startKidsTest(page);

  const runner = page.locator('#placement-test-runner');
  await expect(runner).toBeVisible();
  await expect(page.locator('#pt-progress')).toContainText('1 / 44');

  // Whatever the shuffle served, some control must be clickable -- a letter
  // card, an option button, the counting strip, or a word bank.
  const control = page
    .locator('#pt-options button, #pt-options input, #pt-counting-strip:not([hidden]) button, #pt-picture-word-bank:not([hidden]) button')
    .first();
  await expect(control).toBeVisible();

  // The kid-facing controls are created at runtime; if their scoped CSS stops
  // matching they collapse to unstyled text, so assert real rendered size.
  const box = await control.boundingBox();
  expect(box, 'question control should have a rendered box').not.toBeNull();
  expect(box!.height).toBeGreaterThan(24);

  await control.click();
  // Either feedback appears or the test advances -- both mean the answer was
  // accepted, which is what the answer guard has to allow under shuffling.
  await expect
    .poll(async () => (await page.locator('#pt-progress').textContent()) ?? '', { timeout: 10_000 })
    .not.toContain('1 / 44');

  expect(errors, `console errors:\n${errors.join('\n')}`).toEqual([]);
});

test('the registration form assigns under-11 students to the kids track', async ({ page }) => {
  const errors = failOnConsoleErrors(page);

  await page.goto('/en/placement-test/');
  await page.getByLabel('Date of birth').fill('2018-01-01');

  await expect(page.getByText('Students under 11 are automatically assigned to the Kids test.')).toBeVisible();
  await expect(page.getByLabel('Guardian name')).toBeVisible();

  expect(errors, `console errors:\n${errors.join('\n')}`).toEqual([]);
});

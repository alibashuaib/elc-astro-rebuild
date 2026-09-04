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
  await expect(page.locator('#pt-progress')).toContainText('1 / 41');
  const letterChoices = page.locator('.pt-letter-choice');
  await expect(letterChoices).toHaveCount(2);
  const letters = await letterChoices.allTextContents();
  const sourceLetter = ((await page.locator('#pt-prompt').textContent()) ?? '').match(/“([A-Za-z])”/)?.[1];
  expect(sourceLetter).toBeTruthy();
  expect(letters).toEqual([sourceLetter!.toUpperCase(), sourceLetter!.toLowerCase()]);

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
    .not.toContain('1 / 41');

  expect(errors, `console errors:\n${errors.join('\n')}`).toEqual([]);
});

test('kids counting question accepts a dragged number in the empty slot', async ({ page }) => {
  const errors = failOnConsoleErrors(page);
  await page.route('**/api/session', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: {
        'access-control-allow-origin': 'http://127.0.0.1:4321',
        'access-control-allow-credentials': 'true',
        'access-control-allow-headers': 'content-type',
        'access-control-allow-methods': 'POST, OPTIONS',
      },
      body: JSON.stringify({
        done: false,
        sessionId: 'smoke-counting',
        track: 'kids',
        questionId: 'kids-A2-6',
        type: 'text',
        prompt: 'Count in order: 1, 2, 3, 4, 5, 6, 7. What number comes right after 1?',
        questionNumber: 10,
        total: 41,
        skipAvailable: true,
      }),
    });
  });
  await page.route('**/api/session/smoke-counting/answer', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: {
        'access-control-allow-origin': 'http://127.0.0.1:4321',
        'access-control-allow-credentials': 'true',
        'access-control-allow-headers': 'content-type',
        'access-control-allow-methods': 'POST, OPTIONS',
      },
      body: JSON.stringify({ done: true, correct: true, level: 'A1', levelName: 'Super Minds 1' }),
    });
  });

  await startKidsTest(page);

  const sequence = page.locator('#pt-number-sequence');
  const blank = sequence.locator('.pt-number-blank');
  const correctNumber = page.locator('#pt-number-bank .pt-number-choice').filter({ hasText: /^2$/ });
  await expect(sequence.locator('.pt-number-slot')).toHaveCount(7);
  await expect(blank).toHaveCount(1);
  await expect(page.locator('#pt-number-bank .pt-number-choice')).toHaveCount(3);
  await expect(correctNumber).toHaveAttribute('draggable', 'true');

  const answerRequest = page.waitForRequest('**/api/session/smoke-counting/answer');
  await correctNumber.dragTo(blank);
  const request = await answerRequest;
  expect(request.postDataJSON()).toMatchObject({ questionId: 'kids-A2-6', answerText: '2' });
  await expect(blank).toHaveText('2');
  await expect(blank).toHaveClass(/pt-selected-correct/);

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

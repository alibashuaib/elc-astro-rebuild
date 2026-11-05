import { expect, test } from '@playwright/test';

test('adult and women course diagrams show their published stages in both languages', async ({ page }) => {
  for (const lang of ['en', 'ar']) {
    for (const course of ['adults-general', 'womens-general-english']) {
      await page.goto(`/${lang}/courses/${course}/`);
      await page.getByRole('tab', { name: lang === 'en' ? 'Course Diagram' : 'مخطط الدورة' }).click();
      const diagram = page.locator('.program-section.adult-diagram');
      const women = course === 'womens-general-english';
      await expect(diagram.locator('.progression-card')).toHaveCount(women ? 13 : 16);
      await expect(diagram.locator('.progression-divider')).toHaveCount(women ? 3 : 4);
      for (const [band, count] of (women ? [3, 5, 5] : [3, 5, 5, 3]).entries()) {
        await expect(diagram.locator(`.progression-card[data-stage="${band + 1}"]`)).toHaveCount(count);
      }
      await expect(diagram.locator('.progression-image')).toHaveCount(0);
      await expect(diagram.locator('.progression-card').first()).toContainText('Pre-Fun');
      await expect(diagram.locator('.progression-card').first()).toHaveAttribute('data-step', '00');
      await expect(diagram.locator('.progression-card').last()).toContainText(women ? 'Hint E' : 'Advanced C');
      await expect(diagram.locator('.progression-card').last()).toHaveAttribute('data-step', women ? '12' : '15');
    }
  }
});

test('kids diagram keeps both foundation books at level 0 before Super Minds 1A–6B', async ({ page }) => {
  const titles = [
    'Pre-Starters',
    'Starters',
    ...Array.from({ length: 12 }, (_, index) => `Super Minds ${Math.floor(index / 2) + 1}${index % 2 ? 'B' : 'A'}`),
  ];
  const numbers = ['00A', '00B', ...Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, '0'))];
  for (const lang of ['en', 'ar']) {
    await page.goto(`/${lang}/courses/kids-general/`);
    await page.getByRole('tab', { name: lang === 'en' ? 'Course Diagram' : 'مخطط الدورة' }).click();
    await expect(page.locator('.progression-card strong')).toHaveText(titles);
    expect(await page.locator('.kids-diagram .progression-card').evaluateAll((cards) => cards.map((card) => card.getAttribute('data-step')))).toEqual(numbers);
    await expect(page.locator('.progression-divider').first()).toContainText(lang === 'en' ? 'Level 0' : 'المستوى 0');
  }
});

test('STEP diagram uses three numbered preparation bands in both languages', async ({ page }) => {
  for (const lang of ['en', 'ar']) {
    await page.goto(`/${lang}/courses/step-exam-preparation/`);
    await page.getByRole('tab', { name: lang === 'en' ? 'Course Diagram' : 'مخطط الدورة' }).click();
    const diagram = page.locator('.program-section.step-diagram');
    await expect(diagram.locator('.progression-card')).toHaveCount(3);
    await expect(diagram.locator('.progression-image')).toHaveCount(0);
    await expect(diagram.locator('.progression-divider')).toHaveCount(0);
    expect(await diagram.locator('.progression-card').evaluateAll((cards) => cards.map((card) => card.getAttribute('data-step')))).toEqual(['01', '02', '03']);
  }
});

test('every course diagram fits a mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const lang of ['en', 'ar']) {
    for (const course of ['kids-general', 'adults-general', 'womens-general-english', 'step-exam-preparation']) {
      await page.goto(`/${lang}/courses/${course}/`);
      await page.getByRole('tab', { name: lang === 'en' ? 'Course Diagram' : 'مخطط الدورة' }).click();
      const diagram = page.locator('.program-section');
      expect(await diagram.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
      await expect(diagram.locator('.progression-card')).not.toHaveCount(0);
    }
  }
});

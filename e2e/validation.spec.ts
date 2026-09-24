import { test, expect } from './fixtures';
import { fillSurvey, randomAnswers, submit } from './helpers/survey';

test('empty submission shows required-field errors and sends nothing', async ({ page, backend }) => {
  await page.goto('./');
  await submit(page);

  await expect(page.locator('#participant .field-error')).toHaveText('שדה חובה');
  // Name + 6 tasks × 2 required fields + 11 statements + NPS + summary score + follow-up.
  await expect(page.locator('.field-error')).toHaveCount(1 + 6 * 2 + 11 + 3);
  expect(backend.requests).toHaveLength(0);
});

test('a single missing required answer blocks submission', async ({ page, backend }) => {
  await page.goto('./');
  await fillSurvey(page, randomAnswers(42));
  // Clearing a checked radio isn't possible from the UI, so reload the name field instead.
  await page.locator('#participantName').fill('');
  await submit(page);

  await expect(page.locator('.field-error')).toHaveCount(1);
  await expect(page.locator('#participant .field-error')).toBeVisible();
  expect(backend.requests).toHaveLength(0);
});

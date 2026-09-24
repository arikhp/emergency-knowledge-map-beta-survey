import { readFile } from 'node:fs/promises';
import { test, expect } from './fixtures';
import { fillSurvey, MAX_PDF_BYTES, randomAnswers } from './helpers/survey';

test('the export button downloads a reasonably sized PDF', async ({ page }) => {
  await page.goto('./');
  await fillSurvey(page, randomAnswers(11));

  const downloadPromise = page.waitForEvent('download', { timeout: 45_000 });
  await page.getByRole('button', { name: 'ייצוא ל-PDF' }).click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toMatch(/\.pdf$/);
  const bytes = await readFile(await download.path());
  expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
  expect(bytes.length).toBeGreaterThan(10_000);
  expect(bytes.length).toBeLessThan(MAX_PDF_BYTES);
});

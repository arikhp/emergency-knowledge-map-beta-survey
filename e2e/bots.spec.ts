import { test, expect } from './fixtures';
import { base64Bytes, expectedFlatKeys, fillSurvey, MAX_PDF_BYTES, randomAnswers, submit } from './helpers/survey';

// Five independent bots, each filling the survey with different (seeded) answers.
// fullyParallel runs them concurrently, across every browser project.
for (const seed of [1, 2, 3, 4, 5]) {
  test(`bot ${seed} completes and submits the survey`, async ({ page, backend }) => {
    const answers = randomAnswers(seed);
    await page.goto('./');
    await fillSurvey(page, answers);
    await submit(page);

    await expect(page.getByRole('heading', { name: 'תודה רבה!' })).toBeVisible({ timeout: 45_000 });
    expect(backend.requests).toHaveLength(1);

    const body = backend.lastBody();
    for (const key of expectedFlatKeys) {
      expect(body.has(key), `missing field "${key}"`).toBe(true);
    }
    expect(body.get('participantName')).toBe(answers.participantName);
    expect(body.get('nps')).toBe(String(answers.nps));
    expect(body.get('task1_ease')).toBe(String(answers.tasks.task1.ease));
    expect(body.get('background')).toBe(answers.background.join(', '));

    // The Drive copy of the PDF rides along with the submission. Guards against
    // the per-page image duplication bug that once produced 125 MB PDFs.
    const pdf = body.get('pdfBase64') ?? '';
    expect(pdf.length).toBeGreaterThan(1000);
    expect(base64Bytes(pdf)).toBeLessThan(MAX_PDF_BYTES);
    expect(body.get('pdfFilename')).toContain(answers.participantName);
  });
}

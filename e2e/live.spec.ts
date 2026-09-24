import { test, expect } from './fixtures';
import { fillSurvey, MAX_PDF_BYTES, randomAnswers, submit } from './helpers/survey';
import { testBackend } from './helpers/testBackend';

// Real end-to-end submission to the TEST Apps Script deployment. Skipped in the
// normal suite; run with LIVE=1 LIVE_ENDPOINT=<test web app URL> LIVE_VERIFY_TOKEN=<token>.
// It fills in the survey in a real browser, then asks the test backend whether
// the row reached the Sheet with the right answers and the PDF reached Drive,
// and finally deletes both.
test('@live a real submission reaches the test Sheet and its PDF reaches Drive', async ({ page, request }) => {
  test.setTimeout(180_000);
  const endpoint = process.env.LIVE_ENDPOINT!;
  const token = process.env.LIVE_VERIFY_TOKEN;
  if (!token) throw new Error('LIVE_VERIFY_TOKEN is not set (the VERIFY_TOKEN script property of the test backend).');

  const backend = testBackend(request, endpoint, token);
  const runId = (process.env.GITHUB_RUN_ID ?? `local-${Date.now()}`) + `-${test.info().project.name}`;
  const name = `LIVE-SMOKE-${runId}`;
  const answers = randomAnswers(99, { participantName: name });

  try {
    await page.goto('./');
    await fillSurvey(page, answers);
    await submit(page);
    await expect(page.getByRole('heading', { name: 'תודה רבה!' })).toBeVisible({ timeout: 45_000 });

    // The browser can't read Apps Script's reply, so ask the backend what actually arrived.
    let result = await backend.find(name);
    await expect
      .poll(async () => (result = await backend.find(name)).rows, {
        message: 'the submission never appeared in the test Sheet',
        timeout: 60_000,
        intervals: [2_000, 5_000],
      })
      .toBe(1);

    const { values, pdf } = result.matches![0];

    // The row has the answers the bot typed.
    expect(values.participantName).toBe(name);
    expect(values.participantRole).toBe(answers.participantRole);
    expect(values.frequency).toBe(answers.frequency);
    expect(values.nps).toBe(String(answers.nps));
    expect(values.summaryScore).toBe(String(answers.summaryScore));
    expect(values.followUp).toBe(answers.followUp);
    for (const [id, a] of Object.entries(answers.tasks)) {
      expect(values[`${id}_ease`], `${id}_ease`).toBe(String(a.ease));
      expect(values[`${id}_completion`], `${id}_completion`).toBe(a.completion);
      expect(values[`${id}_notes`], `${id}_notes`).toBe(a.notes);
    }
    for (const [id, v] of Object.entries(answers.statements)) {
      expect(values[id], id).toBe(String(v));
    }
    for (const [id, text] of Object.entries(answers.open)) {
      expect(values[id], id).toBe(text);
    }

    // The PDF was saved to the Drive folder, and it's a real, reasonably sized PDF.
    expect(values.pdfError, 'the backend reported a PDF save error').toBe('');
    expect(values.pdfFile, 'the row has no link to its PDF').toContain('drive.google.com');
    expect(pdf.found, 'the PDF is not in Drive').toBe(true);
    expect(pdf.name).toContain(name);
    expect(pdf.mimeType).toBe('application/pdf');
    expect(pdf.startsWithPdfHeader, 'the Drive file is not a valid PDF').toBe(true);
    expect(pdf.size!).toBeGreaterThan(10_000);
    expect(pdf.size!).toBeLessThan(MAX_PDF_BYTES);
  } finally {
    // Leave the test Sheet and Drive folder clean, whether the checks passed or not.
    const removed = await backend.cleanup(name);
    test.info().annotations.push({
      type: 'cleanup',
      description: `deleted ${removed.deletedRows} row(s), trashed ${removed.trashedPdfs} PDF(s)`,
    });
  }
});

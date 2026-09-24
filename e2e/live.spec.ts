import { test, expect } from './fixtures';
import { fillSurvey, randomAnswers, submit } from './helpers/survey';

// Real end-to-end submission to the TEST Apps Script deployment. Skipped in the
// normal suite; run with LIVE=1 LIVE_ENDPOINT=<test web app URL>. Look for the
// LIVE-SMOKE row in the test Sheet and its PDF in the test Drive folder.
test('@live one real submission reaches the test Sheet', async ({ page }) => {
  const runId = process.env.GITHUB_RUN_ID ?? `local-${Date.now()}`;
  const answers = randomAnswers(99, { participantName: `LIVE-SMOKE-${runId}` });

  await page.goto('./');
  await fillSurvey(page, answers);
  await submit(page);
  await expect(page.getByRole('heading', { name: 'תודה רבה!' })).toBeVisible({ timeout: 45_000 });
});

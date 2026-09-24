import { test, expect } from './fixtures';
import { fillSurvey, randomAnswers, submit } from './helpers/survey';

test.use({ backendMode: 'fail' });

test('a failed submission shows the error banner and keeps the answers', async ({ page, backend }) => {
  const answers = randomAnswers(3);
  await page.goto('./');
  await fillSurvey(page, answers);
  await submit(page);

  await expect(page.getByText('אירעה שגיאה בשליחת התשובות')).toBeVisible({ timeout: 45_000 });
  expect(backend.requests).toHaveLength(1);
  // The form is still there with the participant's answers, so they can export a PDF.
  await expect(page.locator('#participantName')).toHaveValue(answers.participantName);
  await expect(page.getByRole('heading', { name: 'תודה רבה!' })).toHaveCount(0);
});

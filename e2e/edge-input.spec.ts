import { test, expect } from './fixtures';
import { fillSurvey, randomAnswers, submit } from './helpers/survey';

const nasty = {
  open1: 'שכבת מקלטים '.repeat(400), // ~5,000 chars of Hebrew
  open2: 'אמוג׳י 🚒🚑🗺️ וסימנים: "ציטוט" \'גרש\' <script>alert(1)</script> & %20',
  open3: 'Mixed RTL/LTR: ArcGIS 10.8 מול Reflect Portal, קואורדינטות 31.7683,35.2137',
  open4: 'שורה 1\nשורה 2\n\nשורה 4\t(טאב)',
};

test('unusual text is submitted unchanged', async ({ page, backend }) => {
  const answers = randomAnswers(7);
  answers.open = { ...answers.open, ...nasty };
  answers.participantName = 'ג׳ון "בדיקה" או׳בראיין';

  await page.goto('./');
  await fillSurvey(page, answers);
  await submit(page);
  await expect(page.getByRole('heading', { name: 'תודה רבה!' })).toBeVisible({ timeout: 45_000 });

  const body = backend.lastBody();
  for (const [id, text] of Object.entries(nasty)) {
    expect(body.get(id)).toBe(text);
  }
  expect(body.get('participantName')).toBe(answers.participantName);
  expect((body.get('pdfBase64') ?? '').length).toBeGreaterThan(1000);
});

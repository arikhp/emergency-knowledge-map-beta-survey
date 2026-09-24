import type { Page } from '@playwright/test';
import {
  backgroundOptions,
  completionOptions,
  openQuestions,
  statements,
  tasks,
} from '../../src/data/questionnaire';

// Every key flattenForm() (src/lib/flatten.ts) sends — derived from the same
// questionnaire data, so adding a question automatically extends the checks.
export const expectedFlatKeys: string[] = [
  'timestamp',
  'participantName',
  'participantRole',
  'participantDate',
  'background',
  'frequency',
  'nps',
  'summaryScore',
  'followUp',
  ...tasks.flatMap((t) => [`${t.id}_ease`, `${t.id}_completion`, `${t.id}_notes`]),
  ...statements.map((s) => s.id),
  ...openQuestions.map((q) => q.id),
];

// Small deterministic PRNG so each bot's answers are random but reproducible.
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface SurveyAnswers {
  participantName: string;
  participantRole: string;
  frequency: string;
  background: string[];
  tasks: Record<string, { ease: number; completion: string; notes: string }>;
  statements: Record<string, number>;
  nps: number;
  open: Record<string, string>;
  summaryScore: number;
  followUp: 'yes' | 'no';
}

export function randomAnswers(seed: number, overrides: Partial<SurveyAnswers> = {}): SurveyAnswers {
  const rand = mulberry32(seed);
  const int = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
  const pick = <T>(arr: readonly T[]) => arr[int(0, arr.length - 1)];

  return {
    participantName: `בוט בדיקה ${seed}`,
    participantRole: pick(['רשות מקומית', 'פיקוד העורף', 'מוקד עירוני']),
    frequency: pick(['יומי', 'שבועי', 'רק בשעת חירום']),
    background: backgroundOptions.filter(() => rand() < 0.5).map((o) => o.value),
    tasks: Object.fromEntries(
      tasks.map((t) => [
        t.id,
        {
          ease: int(1, 5),
          completion: pick(completionOptions).value,
          notes: rand() < 0.5 ? `הערה אוטומטית למשימה ${t.id} (בוט ${seed})` : '',
        },
      ]),
    ),
    statements: Object.fromEntries(statements.map((s) => [s.id, int(1, 5)])),
    nps: int(0, 10),
    open: Object.fromEntries(
      openQuestions.map((q) => [q.id, rand() < 0.7 ? `תשובה פתוחה ${q.id} מבוט ${seed}` : '']),
    ),
    summaryScore: int(1, 10),
    followUp: rand() < 0.5 ? 'yes' : 'no',
    ...overrides,
  };
}

// Radio/scale inputs have no ids, so target them by react-hook-form's name + value.
async function choose(page: Page, name: string, value: string | number) {
  await page.locator(`input[name="${name}"][value="${value}"]`).check();
}

export async function fillSurvey(page: Page, answers: SurveyAnswers) {
  await page.locator('#participantName').fill(answers.participantName);
  await page.locator('#participantRole').fill(answers.participantRole);
  await page.locator('#frequency').fill(answers.frequency);
  for (const value of answers.background) {
    await page.locator(`input[name="background"][value="${value}"]`).check();
  }

  for (const [id, a] of Object.entries(answers.tasks)) {
    await choose(page, `tasks.${id}.ease`, a.ease);
    await choose(page, `tasks.${id}.completion`, a.completion);
    if (a.notes) await page.locator(`#${id}-notes`).fill(a.notes);
  }

  for (const [id, v] of Object.entries(answers.statements)) {
    await choose(page, `statements.${id}`, v);
  }
  await choose(page, 'nps', answers.nps);

  for (const [id, text] of Object.entries(answers.open)) {
    if (text) await page.locator(`#${id}`).fill(text);
  }

  await choose(page, 'summaryScore', answers.summaryScore);
  await choose(page, 'followUp', answers.followUp);
}

export async function submit(page: Page) {
  await page.getByRole('button', { name: 'שליחת השאלון' }).click();
}

export const MAX_PDF_BYTES = 5 * 1024 * 1024;

export function base64Bytes(b64: string): number {
  return Math.floor((b64.length * 3) / 4);
}

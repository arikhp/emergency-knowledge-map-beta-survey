import AxeBuilder from '@axe-core/playwright';
import { test, expect } from './fixtures';

test('page is right-to-left Hebrew', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('html')).toHaveAttribute('lang', 'he');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

// Known, accepted issues: reported as annotations instead of failing CI.
// Add entries as { rule: 'color-contrast', target: '.btn-primary' }.
const KNOWN_ISSUES: { rule: string; target: string }[] = [];

test('no serious or critical accessibility violations', async ({ page }) => {
  await page.goto('./');
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    // The off-screen copy used only for PDF rendering is aria-hidden and never seen.
    .exclude('.review-offscreen')
    .analyze();

  const isKnown = (rule: string, target: string) =>
    KNOWN_ISSUES.some((k) => k.rule === rule && k.target === target);

  const blocking = results.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => {
      const known = v.nodes.filter((n) => isKnown(v.id, n.target.join(' ')));
      for (const n of known) {
        test.info().annotations.push({ type: 'known a11y issue', description: `${v.id}: ${n.target.join(' ')}` });
      }
      return { ...v, nodes: v.nodes.filter((n) => !known.includes(n)) };
    })
    .filter((v) => v.nodes.length > 0)
    .map((v) => `${v.id} (${v.impact}): ${v.help} — ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
  expect(blocking).toEqual([]);
});

# QA automation — work log & handoff

Branch: `feature/qa-automation` (not merged, no PR yet)
Started: 2026-09-24

This file records what was done, why, and what's left, so the work can be
picked up on any machine.

## Goal

Add automated QA to the beta survey:
1. Several "agents" that fill in and submit the survey, to catch regressions.
2. A load test of the submission backend (Google Apps Script → Sheet + Drive PDF).
3. Run both automatically through a CI/CD pipeline.

## Decisions

| Question | Decision | Why |
|---|---|---|
| What kind of "agents"? | Scripted Playwright browser bots | Repeatable, free, and can run in CI. AI-driven exploratory agents were left out for now. |
| Where does test traffic go? | A **separate test Sheet** and Apps Script deployment | Load tests write real rows and PDFs; the real beta data must stay clean. |
| Expected load | Up to ~20 participants at once, so the test goes up to **30** | 30 is also roughly Apps Script's limit on simultaneous executions. |
| How to deliver | Feature branch + GitHub Actions | `main` auto-deploys, so nothing goes there without review. |
| When does CI run? | Bots on every PR and every push to `main`; load test **manual only** | The load test writes real data and uses Apps Script quota. |

## What was built

### Survey bots: `e2e/` (Playwright)
- `playwright.config.ts` builds the app against a **fake endpoint**
  (`https://sheet.test/exec`) and serves it with `vite preview`. It runs 3
  browser projects: desktop Chrome, mobile (Pixel 7), and WebKit (Safari).
- `e2e/fixtures.ts` intercepts every submission with a mock backend. **Safety
  net:** any request to `script.google.com` fails the test, so the bots can
  never write to the real Sheet.
- `e2e/helpers/survey.ts` holds `randomAnswers(seed)` and `fillSurvey()`.
  Answers are seeded (random but reproducible), and all ids come from
  `src/data/questionnaire.ts`, so new questions are picked up automatically.

| Spec | Checks |
|---|---|
| `bots.spec.ts` | 5 bots in parallel fill in and submit; every `flattenForm` field is sent; the attached PDF is under 5 MB (guards against the old 125 MB bug) |
| `validation.spec.ts` | An empty form shows 27 required-field errors and sends nothing; one missing field blocks submission |
| `edge-input.spec.ts` | 5,000-character Hebrew text, emoji, quotes, `<script>`, and mixed RTL/LTR text arrive unchanged |
| `network-error.spec.ts` | A failed submission shows the error banner and keeps the answers |
| `pdf-export.spec.ts` | The export button downloads a valid PDF (`%PDF-`, 10 KB–5 MB) |
| `a11y-rtl.spec.ts` | `dir="rtl"`, `lang="he"`; no serious or critical axe violations (see known issue below) |
| `live.spec.ts` | `@live`, skipped by default. Makes one real submission to the **test** backend |

### Load test: `load/` (k6)
- `load/submit.js` sends the same form-urlencoded POST as
  `src/lib/submitResponse.ts`, including a real 400 KB PDF
  (`load/fixtures/sample.pdf`, exported from the app).
- It ramps to `VUS` concurrent users (default 30: 2 min ramp, 1 min hold).
- Rows are named `LOADTEST-<runId>-<vu>-<iter>` so they're easy to count and delete.
- Pass criteria: under 2% failed requests, 95% of submissions finish within 15 s, and at least 98% of checks pass.
- It **refuses to run** if `ENDPOINT` equals `PROD_ENDPOINT`.

### CI: `.github/workflows/`
- `qa.yml` runs on every PR, every push to `main`, and on manual trigger. Steps: lint, then all Playwright bots. It uploads the HTML report and traces.
- `load-test.yml` is manual only, with inputs `vus`, `ramp`, and `hold`. It checks the
  target isn't production, runs the live smoke submission, then k6, and
  writes a job summary and artifacts.
- The existing `deploy.yml` (GitHub Pages) is unchanged.

### Docs
- `README.md`: new "QA & load testing" section.
- `google-apps-script/README.md`: new "Test backend" setup section.

## Verification done

- **Full suite:** 36/36 checks passed on 2 consecutive runs, about 1.3 min each.
- **Tests catch a bug:** with `required` removed from the name field, both
  validation tests failed as expected. The change was then reverted.
- **k6 against a local fake backend** (it copies Apps Script's 302 redirect): 53
  submissions of 574 KB each, 100% of checks passed. The production-URL guard refused as expected.
- Lint (`oxlint`) passes.

## Problems hit & fixes

| Problem | Fix |
|---|---|
| Bots timed out, stuck on "שולח..." (sending), with 4 or 10 parallel workers | PDF rendering (html2canvas) is CPU-heavy. Set `workers: 2`: stable, and faster than 4. |
| A stale preview server could be built with the real endpoint from `.env.local` | `reuseExistingServer: false`, so every run rebuilds with the fake endpoint |
| Expected error count was off by one | Forgot the name field; there are 27 required fields, not 26 |

## Known issues found by the tests

- **Low contrast on the submit button:** white text on brand orange `#f2841e` is
  about 2.6:1 (WCAG AA needs 4.5:1). It's listed in `KNOWN_ISSUES` in
  `e2e/a11y-rtl.spec.ts`, so it's reported without failing CI. **Design decision
  pending:** darken the orange, or keep it.

## Git state

- `vercel-base-path` has 3 commits not in `main`, including `.gitignore` for `.vercel` and `.env*`.
- `feature/qa-automation` branches off `vercel-base-path` and adds the QA commits.
- Nothing has been merged and no PR is open, so the live site is unchanged.

## Next steps

1. **Create the test backend:** follow "Test backend" in
   `google-apps-script/README.md`, then add the GitHub secret `TEST_SHEET_ENDPOINT`.
2. **Run the load test:** Actions → *Load test (test Sheet)*, first with
   `vus=5`, then `30`. Check that the `LOADTEST-<run id>-*` row count in the test Sheet matches
   k6 `iterations`, and that the PDFs are in the test Drive folder.
3. **Decide about the button contrast.**
4. **Optional later:** run the bots against Vercel preview URLs (`BASE_URL=...`);
   Vercel deployment protection may need a bypass.
5. **When ready:** open a PR. Nothing gets merged without explicit approval.

## Resuming on another machine

```bash
git clone https://github.com/arikhp/emergency-knowledge-map-beta-survey.git
cd emergency-knowledge-map-beta-survey
git switch feature/qa-automation
npm install
npx playwright install chromium webkit
npm run test:e2e            # expect 36 passed
```

- `.env.local` (the real Sheet URL) is intentionally not in git. The tests
  don't need it; copy it over privately only if you want to run the app against the real Sheet.
- Load test locally: install k6, then
  `k6 run -e ENDPOINT=<TEST /exec URL> -e VUS=5 load/submit.js`
- To resume with Claude Code: *"Continue the QA automation work. Read
  docs/qa-automation-log.md first."*

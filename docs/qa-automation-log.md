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

- ~~**Low contrast on the submit button:** white text on brand orange `#f2841e`
  is about 2.6:1 (WCAG AA needs 4.5:1).~~ **Fixed 2026-09-24:** a new token
  `--orange-strong: #b35900` (4.83:1) is used for `.btn-primary` and
  `.task-number`, and `--orange-dark` is now `#9a4a00` (6.26:1), used for
  hover and the required-field `*`. The bright `--orange` stays for borders
  and outlines. `KNOWN_ISSUES` is now empty, so CI fails if contrast regresses.

## Session 2 (2026-09-24, second laptop)

- Setup reproduced on a new machine: 36/36 passed, lint clean.
- Contrast fix (above). The a11y and PDF export specs pass, and the button
  was checked visually.
- **Vercel preview bots:** new `.github/workflows/qa-preview.yml` runs on
  `deployment_status` (successful Preview deployments only), using
  `BASE_URL=<preview url>`. `playwright.config.ts` sends
  `x-vercel-protection-bypass` when `VERCEL_AUTOMATION_BYPASS_SECRET` is set.
  Checked locally against a root-base (`VERCEL=1`) build: 36/36 passed.
  This needs 2 Vercel settings (README → "Survey bots on Vercel previews").
- **Last-updated date in the footer** ("עודכן לאחרונה"): the build time
  comes from `define` in `vite.config.ts` and is shown in Israel time. A
  footer check was added to `a11y-rtl.spec.ts` (now 39 checks).
- **Real Sheet + Drive verification.** Before this, the live test only
  checked for the "thank you" screen. That screen shows whenever the upload
  doesn't crash, and `Code.gs` hid Drive errors, so a broken Drive save would
  still have passed. Now:
  - `Code.gs` saves the PDF first, then writes the row with a `pdfFile` link
    or a `pdfError` reason. A script lock stops simultaneous submissions from
    overwriting each other's header changes.
  - `Code.gs` has a new `doGet` with `find`, `count` and `cleanup` actions.
    It only works when the `VERIFY_TOKEN` script property is set, which is
    only on the test copy, and only for `LIVE-SMOKE-*`/`LOADTEST-*` names.
  - `e2e/live.spec.ts` submits, polls `find`, checks every answer and the
    Drive PDF (it exists, `%PDF-` header, 10 KB–5 MB), then always cleans up.
  - `load/verify.mjs` compares the Sheet and Drive counts with k6's
    confirmed submissions, then cleans up. It runs in `load-test.yml`.
  - New `live-smoke.yml`: runs on every push to `main`, daily, and manually.
    It skips with a warning until the secrets exist.
  - Tested against a local copy of `Code.gs` with fake Sheets/Drive: 14
    backend checks pass. The live test passes and cleans up. With Drive
    saving broken on purpose it fails with "the backend reported a PDF save
    error". `verify.mjs` fails when a submission is missing and passes when
    all arrived.
- k6 isn't installed on this laptop yet: `brew install k6` needs
  `sudo xcodebuild -license accept` first.

## Load test findings (2026-09-24)

Requirement from the user (final): **30 participants in total, one at a
time, and each submits once.** So the default load test sends 30
submissions one after another. `AT_ONCE` (1–30, default 1) is an optional
stress check. It passes only if every submission sent is in the Sheet with its
PDF (`load/verify.mjs`).

**Result on backend v4, 30 one at a time: 30 of 30 saved with PDFs.** Median
5.2 s, p95 7.1 s, 0 failed requests.

The simultaneous-burst results below came from an earlier, stricter
assumption (30 at the same instant). They're kept for the record. The user
confirmed there is only ever one participant at a time, so the live
production script (no lock) is fine as it is, and the user chose not to
update it. The v4 lock stays in the repo's `Code.gs` as cheap insurance.

| Backend version | Result |
|---|---|
| Lock on every submission, 30 s wait (v1) | Sustained 30-user stream: **24 of 190 lost**. The queue exceeded 30 s, `waitLock` threw, and the row was dropped after the PDF was saved. |
| No lock (v2/v3), which is how the **live production script** works too | **8 of 30 lost, reproducibly, in a single burst.** Every execution was "Completed" and every reply was ok: simultaneous `appendRow` calls silently overwrite each other. |
| Short lock around header + `appendRow` + `flush` only, up to 4 min wait, write anyway if no lock (v4) | **90 of 90 saved** (3 bursts of 30). Median 2.9 s, but p95 about 33 s, because the last people in a burst wait their turn. |

Note: the live production `Code.gs` has the no-lock behaviour, so it would
lose rows only if several participants submitted at the same instant. That's
not expected (one at a time). If that ever changes, deploy v4 to the real
script (without `VERIFY_TOKEN`).

Other findings:
- Apps Script's reply comes through a redirect that sometimes returns a
  Google error page or even `doGet`'s output, even though the submission was
  saved. The real app can't read replies (no-cors), so replies are
  informational only.
- Drive's `title contains` matches by word, so file counts now filter by exact name.
- k6 is run locally from the official release binary (checksum verified),
  because `brew install k6` needs the Xcode license (sudo).

## Git state

- `feature/qa-automation` contains all of `main`, plus the 2
  `vercel-base-path` commits (Vercel root base, and `.gitignore` for
  `.vercel`/`.env*`), plus the QA commits. Merging it also ships the Vercel changes.
- Nothing has been merged, so the live site is unchanged.

## Next steps

1. ~~**Create the test backend**~~ **Done 2026-09-24** (set up through the
   browser, with the user doing Google's permission step): Sheet
   "TEST — תשובות שאלון בטא", Apps Script project "TEST survey backend",
   Drive folder "TEST - תשובות שאלון בטא - PDF". The GitHub secrets
   `TEST_SHEET_ENDPOINT` and `TEST_VERIFY_TOKEN` are set. First real live run
   **passed** in 27 s: every answer was found in the Sheet, a valid PDF was
   found in Drive, and both were cleaned up (0 rows or files left). Without a
   password or with a wrong one, requests are refused, and non-test names are refused.
   Optionally, redeploy the real script with the new `Code.gs` (no `VERIFY_TOKEN` there).
2. ~~**Vercel preview setup**~~ **Done 2026-09-24** through the browser. The
   Vercel project had no env vars before, so none of Production's settings
   changed. Added `VITE_SHEET_ENDPOINT=https://sheet.test/exec` (Config, **Preview
   only**). Added a Protection Bypass for Automation secret (note "GitHub
   Actions QA bots") and stored it as the GitHub secret
   `VERCEL_AUTOMATION_BYPASS_SECRET`. Note: Vercel *Production* builds have no
   `VITE_SHEET_ENDPOINT`, so a Production deploy on Vercel would show the
   "no endpoint" warning. The live site is GitHub Pages, which uses `SHEET_ENDPOINT`.
3. **Run the load test:** locally with
   `k6 run -e ENDPOINT=<TEST url> -e VUS=5 load/submit.js`, then `VUS=30`.
   Or from Actions → *Load test (test Sheet)*: a `workflow_dispatch` workflow
   can only be started once it exists on the default branch, so after merge,
   or with `gh workflow run load-test.yml --ref feature/qa-automation` once
   it's on `main`. Check that the `LOADTEST-<run id>-*` row count matches
   k6 `iterations`, and that the PDFs are in the TEST Drive folder. Record the results here.
4. **PR:** review the CI results, then merge only with explicit approval.

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

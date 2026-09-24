# שאלון בדיקת משתמשים (בטא) — מפת הידע לחירום 2.0

React + TypeScript beta-test questionnaire for "מפת הידע לחירום 2.0" (ענף
אגמי״ם), digitizing the original Word questionnaire. Fully in Hebrew/RTL.

## Features

- Full questionnaire: participant details, 6 guided tasks, 11 general
  Likert-scale statements + NPS, 9 open questions, and a summary section.
- **PDF export** at any point (persistent "ייצוא ל-PDF" button, and again on
  the post-submit success screen) — produces a paginated Hebrew PDF of the
  current answers, downloaded locally.
- Submissions are saved to a Google Sheet via a small Apps Script backend
  (see [`google-apps-script/README.md`](./google-apps-script/README.md) for
  the one-time setup) — no self-hosted server needed. On submit, a PDF copy
  of the same answers is also generated and saved straight to a Drive
  folder automatically (no download dialog for this one).

## Local development

```bash
npm install
cp .env.example .env   # then fill in VITE_SHEET_ENDPOINT, see google-apps-script/README.md
npm run dev
```

If `.env` is left unset, the form still works end-to-end (fill it in,
export a PDF) — it just shows a warning banner instead of silently losing
submissions, since there's nowhere remote to save them yet.

## Build

```bash
npm run build     # type-checks + builds to dist/
npm run preview   # serve the production build locally
```

## Deploy

Static build, deployable to GitHub Pages (see `.github/workflows/deploy.yml`)
or any static host. The `SHEET_ENDPOINT` GitHub Actions secret must be set
for the deployed build to actually save submissions.

## QA & load testing

### Survey bots (Playwright), runs on every PR

```bash
npx playwright install chromium webkit   # once
npm run test:e2e                          # all bots, all browsers
npm run test:e2e:ui                       # interactive runner
```

The suite builds the app against a fake endpoint (`https://sheet.test/exec`)
and intercepts every submission, so it never touches a real Sheet. Any
request to `script.google.com` fails the test. Specs live in `e2e/`:

| Spec | What it checks |
|---|---|
| `bots.spec.ts` | 5 bots with different seeded answers fill in and submit in parallel; every field arrives; the attached PDF is under 5 MB |
| `validation.spec.ts` | Required fields block submission, and nothing is sent |
| `edge-input.spec.ts` | Long Hebrew text, emoji, quotes, HTML, mixed RTL/LTR text arrive unchanged |
| `network-error.spec.ts` | A failed submission shows the error banner and keeps the answers |
| `pdf-export.spec.ts` | The export button downloads a valid PDF under 5 MB |
| `a11y-rtl.spec.ts` | The page is RTL Hebrew; no serious or critical axe violations (except known, listed ones) |

Each spec runs in desktop Chrome, mobile (Pixel 7) and Safari (WebKit).
The **QA** workflow (`.github/workflows/qa.yml`) runs lint and the whole
suite on every pull request and on every push to `main`, and uploads the HTML report as an
artifact.

Set `BASE_URL` to run the same bots against a deployed site instead of a
local build.

### Survey bots on Vercel previews

The **QA (Vercel preview)** workflow (`.github/workflows/qa-preview.yml`)
runs the same suite against every successful Vercel preview deployment.
One-time setup:

1. In Vercel → Project → **Settings → Environment Variables**, set
   `VITE_SHEET_ENDPOINT=https://sheet.test/exec` for the **Preview**
   environment only. Production keeps the real URL. Previews then post to
   the fake endpoint that the bots mock, and the `script.google.com` guard
   still fails any test that would reach a real Sheet.
2. In Vercel → **Settings → Deployment Protection**, enable **Protection
   Bypass for Automation**, and save the value as the GitHub Actions
   secret `VERCEL_AUTOMATION_BYPASS_SECRET`.

### Live check (real Google Sheet + Drive), after every merge and daily

The bots above use a fake backend, so they can't prove Google actually
saved anything. The **Live check** workflow (`.github/workflows/live-smoke.yml`)
does: a bot fills in the survey in a real browser and submits it to the
separate **test** backend. It then asks that backend whether the row arrived
with the right answers and whether the PDF is in the test Drive folder (a
real PDF of a sensible size). Finally it deletes the row and trashes the PDF.
It runs on every push to `main`, daily at 08:00 Israel time, and on demand.

Locally: `LIVE=1 LIVE_ENDPOINT=<test /exec URL> LIVE_VERIFY_TOKEN=<token> npx playwright test --project=desktop-chromium`

### Load test (k6), manual, against the test Sheet only

Needs the separate test backend. See the "Test backend" section in
[`google-apps-script/README.md`](./google-apps-script/README.md).

The site serves at most **30 participants at once, and each submits once**.
So the test is the worst realistic moment: 30 participants all press
"send" at the same instant, one submission each (with a real ~400 KB PDF).
The `rounds` option repeats this with a fresh group of 30 for extra
confidence, and `vus` can't go above 30.

- **From GitHub:** Actions → **Load test (test Sheet)** → Run workflow. It
  first makes one real browser submission (`e2e/live.spec.ts`), then sends
  the burst.
- **Locally:** `k6 run -e ENDPOINT=<test /exec URL> load/submit.js` (add `-e VUS=5` for a small trial)

Then `load/verify.mjs` asks the test backend how many `LOADTEST-<run id>-*`
rows and PDFs arrived. **It passes only if every submission sent is in
the Sheet with its PDF.** Then it deletes them, and the counts appear in the
run's summary. k6 also requires that 95% of submissions finish within 15 s.
Locally: `node load/verify.mjs <test /exec URL> <token> <run id>` (add `KEEP=1` to keep the rows).

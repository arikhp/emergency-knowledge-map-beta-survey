# שאלון בדיקת משתמשים (בטא) — מפת הידע לחירום 2.0

React + TypeScript beta-test questionnaire for "מפת הידע לחירום 2.0" (ענף
אגמי״ם), digitizing the original Word questionnaire. Fully in Hebrew/RTL.

## Features

- Full questionnaire: participant details, 6 guided tasks, 11 general
  Likert-scale statements + NPS, 9 open questions, and a summary section.
- **PDF export** at any point (persistent "ייצוא ל-PDF" button, and again on
  the post-submit success screen) — produces a paginated Hebrew PDF of the
  current answers.
- Submissions are saved to a Google Sheet via a small Apps Script backend
  (see [`google-apps-script/README.md`](./google-apps-script/README.md) for
  the one-time setup) — no self-hosted server needed.

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

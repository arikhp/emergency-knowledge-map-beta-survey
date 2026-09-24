# Google Sheet backend — one-time setup

This connects the questionnaire to a Google Sheet so every submission is
saved as a row you can open, filter, and export from Sheets. Takes about 5
minutes, using your Google account (`anujnov94@gmail.com`).

1. Go to [sheets.google.com](https://sheets.google.com) and create a new
   blank spreadsheet. Name it something like **"תשובות שאלון בטא — מפת הידע
   לחירום"**.
2. In the sheet, open **Extensions → Apps Script**.
3. Delete the placeholder code in `Code.gs` and paste in the contents of
   [`Code.gs`](./Code.gs) from this repo.
4. Click **Deploy → New deployment**.
   - Click the gear icon next to "Select type" and choose **Web app**.
   - Description: anything, e.g. "beta survey intake".
   - Execute as: **Me**.
   - Who has access: **Anyone**.
   - Click **Deploy**, then **Authorize access** and approve the permissions
     (it's your own script, so this is safe).
5. Copy the **Web app URL** shown after deploying — it looks like
   `https://script.google.com/macros/s/AKfycb.../exec`.
6. Put that URL in this project's `.env` file (copy `.env.example` to `.env`
   first) as `VITE_SHEET_ENDPOINT=...`, then restart `npm run dev` for local
   testing. For the deployed site, this same value needs to be set as the
   `SHEET_ENDPOINT` GitHub Actions secret (done once, before deploying).

Every submission appends a row to the sheet's active tab; the header row is
created and kept in sync automatically the first time data comes in — no
manual column setup needed.

Each submission also saves a PDF copy of the answers into a Drive folder
named **"תשובות שאלון בטא - PDF"** (created automatically on first use) —
this happens silently as part of hitting "שליחת השאלון", no download dialog.
Because this needs Drive access (not just Sheets), the deployment now
requests an extra permission — see the re-authorization step below.

**If you ever need to redeploy the script** (e.g. after editing `Code.gs`):
Deploy → Manage deployments → edit (pencil icon) → New version → Deploy. The
`/exec` URL stays the same across versions, so you won't need to update the
`.env`/secret again. If the new version requests a new permission (like the
Drive access added for PDF saving), you'll be prompted to **Authorize
access** again during that redeploy — same one-click approval as the first
time, since it's still your own script.

Each row also has two columns about its PDF: **`pdfFile`** (a link to the
PDF in Drive) and **`pdfError`** (filled only if saving the PDF failed, with
the reason). The answers are saved either way.

## Test backend (for the live check and the load test)

Automated tests must never write to the real beta Sheet, so they use a
separate copy of this backend. One-time setup:

1. Create a second blank spreadsheet, e.g. **"TEST — תשובות שאלון בטא"**.
2. **Extensions → Apps Script**, paste in [`Code.gs`](./Code.gs), and change
   the `PDF_FOLDER_NAME` line to a separate Drive folder:
   `var PDF_FOLDER_NAME = 'TEST - תשובות שאלון בטא - PDF';`
3. Make up a long random password (e.g. run `openssl rand -hex 24` in a
   terminal). In the Apps Script editor, open **Project Settings** (gear icon)
   → **Script Properties** → **Add script property**: name `VERIFY_TOKEN`,
   value = that password. **Do this only in the TEST script, never in the
   real one.** It turns on a check-and-cleanup link that the test bots use.
4. Deploy it as a web app exactly as in step 4 above, and copy its `/exec` URL.
5. In GitHub → repo **Settings → Secrets and variables → Actions**, add:
   - **`TEST_SHEET_ENDPOINT`**: the `/exec` URL. It must differ from
     `SHEET_ENDPOINT`; the workflows refuse to run if they match.
   - **`TEST_VERIFY_TOKEN`**: the same password as in step 3.

What the bots do with it: they submit the survey, ask the check link whether
the row arrived with the right answers and the PDF is in the Drive folder,
and then delete that row and move the PDF to the Drive trash. The link only
accepts test names (`LIVE-SMOKE-<run id>`, `LOADTEST-<run id>-…`), so it can
never read or delete a real participant's answers. In the real script it
does nothing at all, because `VERIFY_TOKEN` isn't set there.

**Updating the real script too:** paste the new `Code.gs` into the real
script and redeploy (see "If you ever need to redeploy" above) to get the
`pdfFile`/`pdfError` columns and the fix for simultaneous submissions.
Do **not** add `VERIFY_TOKEN` there.

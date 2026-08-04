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

**If you ever need to redeploy the script** (e.g. after editing `Code.gs`):
Deploy → Manage deployments → edit (pencil icon) → New version → Deploy. The
`/exec` URL stays the same across versions, so you won't need to update the
`.env`/secret again.

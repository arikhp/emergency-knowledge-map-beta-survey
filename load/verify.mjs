// After a k6 run: asks the TEST backend how many LOADTEST-<runId>-* rows and
// Drive PDFs actually arrived, compares that with what k6 says it sent, then
// deletes them. Exits non-zero if any submission was lost.
//
//   node load/verify.mjs <test /exec URL> <VERIFY_TOKEN> <runId> [load/results/summary.json]
//
// Set KEEP=1 to skip the cleanup and inspect the rows by hand.
import { readFileSync } from 'node:fs';

const [endpoint, token, runId, summaryPath = 'load/results/summary.json'] = process.argv.slice(2);
if (!endpoint || !token || !runId) {
  console.error('Usage: node load/verify.mjs <endpoint> <token> <runId> [summary.json]');
  process.exit(2);
}
const prefix = `LOADTEST-${runId}-`;

async function call(action) {
  const url = new URL(endpoint);
  url.search = new URLSearchParams({ token, action, prefix }).toString();
  // Apps Script sometimes answers with a Google HTML error page; retry those.
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url); // follows Apps Script's redirect
    const text = await res.text();
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      if (attempt >= 4) throw new Error(`Test backend gave no JSON for "${action}" (status ${res.status})`);
      await new Promise((r) => setTimeout(r, 3_000 * attempt));
      continue;
    }
    if (!body.ok) throw new Error(`Test backend refused "${action}": ${body.error}`);
    return body;
  }
}

const summary = JSON.parse(readFileSync(summaryPath, 'utf8'));
const okCheck = (summary.root_group?.checks ?? []).find((c) => c.name === 'backend replied ok');
const confirmed = okCheck?.passes ?? 0;
const iterations = summary.metrics?.iterations?.values?.count ?? 0;

// Late submissions can take a moment to land; retry briefly before judging.
let counts;
for (let attempt = 0; attempt < 6; attempt++) {
  counts = await call('count');
  if (counts.rows >= iterations) break;
  await new Promise((r) => setTimeout(r, 10_000));
}

// The pass criterion: every submission k6 sent is in the Sheet, with its PDF.
// (The real app can't read Apps Script's reply, so a participant always sees
// "thank you"; only the Sheet tells whether their answers were kept.)
const problems = [];
if (counts.rows < iterations) problems.push(`${iterations - counts.rows} of ${iterations} submission(s) are missing from the Sheet (answers lost)`);
if (counts.driveFiles > counts.rows) problems.push(`${counts.driveFiles - counts.rows} PDF(s) in Drive have no row in the Sheet`);
if (counts.rowsWithPdfLink < counts.rows) problems.push(`${counts.rows - counts.rowsWithPdfLink} row(s) have no PDF link`);
if (counts.pdfErrors > 0) problems.push(`${counts.pdfErrors} row(s) report a PDF save error`);
if (counts.driveFiles < counts.rows) problems.push(`${counts.rows - counts.driveFiles} PDF(s) are missing from Drive`);

const report = [
  `submissions sent:         ${iterations}`,
  `replies that said ok:     ${confirmed} (informational; see submit.js)`,
  `rows in test Sheet:       ${counts.rows}`,
  `rows with PDF link:       ${counts.rowsWithPdfLink}`,
  `PDFs in test Drive:       ${counts.driveFiles}`,
  `PDF save errors:          ${counts.pdfErrors}`,
  problems.length ? `RESULT: FAILED\n- ${problems.join('\n- ')}` : 'RESULT: every submission arrived, with its PDF',
];

if (process.env.KEEP) {
  report.push('Cleanup skipped (KEEP=1).');
} else {
  const removed = await call('cleanup');
  report.push(`Cleanup: deleted ${removed.deletedRows} row(s), trashed ${removed.trashedPdfs} PDF(s).`);
}

console.log(report.join('\n'));
process.exit(problems.length ? 1 : 0);

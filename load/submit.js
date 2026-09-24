// k6 load test for the survey's submission backend (Google Apps Script web app).
//
// Sends the same form-urlencoded POST the app builds in src/lib/submitResponse.ts:
// every flattened field (src/lib/flatten.ts) plus a real ~400 KB PDF as base64.
// Point it ONLY at the test deployment, never the production Sheet.
//
// The site has 30 participants in total and they take it ONE AT A TIME,
// each submitting once at the end of a ~45-60 minute session. So by default
// this sends PARTICIPANTS (default 30) submissions one after another, and
// load/verify.mjs then checks that every one is in the Sheet with its PDF.
// AT_ONCE (default 1, max 30) lets several participants submit at the same
// time, as an optional stress check beyond the expected use.
//
//   k6 run -e ENDPOINT=<test web app URL> load/submit.js
//   k6 run -e ENDPOINT=... -e PARTICIPANTS=5 load/submit.js
//
// Every row it writes has participantName LOADTEST-<runId>-<n>, so
// load/verify.mjs can count them afterwards and delete them.
import http from 'k6/http';
import encoding from 'k6/encoding';
import exec from 'k6/execution';
import { check } from 'k6';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.1.0/index.js';

const ENDPOINT = __ENV.ENDPOINT;
const RUN_ID = __ENV.RUN_ID || `local-${Date.now()}`;
const PARTICIPANTS = Number(__ENV.PARTICIPANTS || 30);
const AT_ONCE = Number(__ENV.AT_ONCE || 1);
if (AT_ONCE < 1 || AT_ONCE > 30 || AT_ONCE > PARTICIPANTS) {
  throw new Error('AT_ONCE must be between 1 and 30, and not more than PARTICIPANTS.');
}

if (!ENDPOINT) {
  throw new Error('Set ENDPOINT to the TEST Apps Script web app URL (-e ENDPOINT=...).');
}
// Optional safety net: the CI workflow passes the production URL so we can refuse it.
if (__ENV.PROD_ENDPOINT && ENDPOINT.trim() === __ENV.PROD_ENDPOINT.trim()) {
  throw new Error('ENDPOINT is the production Sheet. Refusing to load-test it.');
}

const pdfBase64 = encoding.b64encode(open('./fixtures/sample.pdf', 'b'));

// Mirrors the ids in src/data/questionnaire.ts.
const TASK_IDS = ['task1', 'task2', 'task3', 'task4', 'task5', 'task6'];
const STATEMENT_IDS = Array.from({ length: 11 }, (_, i) => `stmt${i + 1}`);
const OPEN_IDS = Array.from({ length: 9 }, (_, i) => `open${i + 1}`);

export const options = {
  scenarios: {
    participants: {
      // Each iteration is one participant's single submission.
      executor: 'shared-iterations',
      vus: AT_ONCE,
      iterations: PARTICIPANTS,
      maxDuration: '20m',
    },
  },
  thresholds: {
    // Whether every submission was actually SAVED is checked afterwards by
    // load/verify.mjs against the Sheet and Drive; that's the real pass/fail.
    // Apps Script's reply comes back through a redirect that occasionally
    // returns a Google error page even though the submission was saved, and
    // the real app can't read the reply anyway (no-cors), so replies alone
    // aren't used as a pass criterion.
    http_req_failed: ['rate<0.05'],
    // Apps Script usually answers in 3–6 s; writing the PDF to Drive is the slow part.
    'http_req_duration{name:submit}': ['p(95)<15000'],
  },
};

const rand = (min, max) => min + Math.floor(Math.random() * (max - min + 1));

function buildSubmission() {
  const name = `LOADTEST-${RUN_ID}-${exec.scenario.iterationInTest + 1}`;
  const body = {
    timestamp: new Date().toISOString(),
    participantName: name,
    participantRole: 'בדיקת עומסים',
    participantDate: new Date().toISOString().slice(0, 10),
    background: 'gis',
    frequency: 'שבועי',
    nps: String(rand(0, 10)),
    summaryScore: String(rand(1, 10)),
    followUp: 'no',
  };
  for (const id of TASK_IDS) {
    body[`${id}_ease`] = String(rand(1, 5));
    body[`${id}_completion`] = 'easy';
    body[`${id}_notes`] = `הערת עומס ${id}`;
  }
  for (const id of STATEMENT_IDS) body[id] = String(rand(1, 5));
  for (const id of OPEN_IDS) body[id] = `תשובה פתוחה ${id} — בדיקת עומסים`;

  body.pdfBase64 = pdfBase64;
  body.pdfFilename = `${name}.pdf`;
  return body;
}

export default function () {
  // Apps Script replies 302 → script.googleusercontent.com; k6 follows it, and
  // the row + Drive file are written before that redirect is issued.
  const res = http.post(ENDPOINT, buildSubmission(), {
    tags: { name: 'submit' },
    timeout: '60s',
  });

  const ok = check(res, {
    'status 200': (r) => r.status === 200,
    'backend replied ok': (r) => typeof r.body === 'string' && r.body.includes('"ok":true'),
  });
  if (!ok) {
    // Apps Script reports errors as an HTML page; keep the readable part so failures can be diagnosed.
    const text = String(res.body || res.error || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    console.warn(`reply not ok (verify.mjs decides if it was saved): status=${res.status}: ${text.slice(0, 200)}`);
  }
}

export function handleSummary(data) {
  return {
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
    'load/results/summary.json': JSON.stringify(data, null, 2),
    'load/results/summary.txt': textSummary(data, { indent: ' ', enableColors: false }),
  };
}

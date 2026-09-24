// k6 load test for the survey's submission backend (Google Apps Script web app).
//
// Sends the same form-urlencoded POST the app builds in src/lib/submitResponse.ts:
// every flattened field (src/lib/flatten.ts) plus a real ~400 KB PDF as base64.
// Point it ONLY at the test deployment, never the production Sheet.
//
// The site serves at most 30 participants at once, and each submits once at
// the end of a ~45-60 minute session. So the test is the worst realistic case:
// VUS participants (default 30) each submit ONCE, all at the same instant.
// ROUNDS (default 1) repeats that with a fresh group of participants, GAP
// seconds apart (default 60), for extra confidence; nobody submits twice.
//
//   k6 run -e ENDPOINT=<test web app URL> load/submit.js
//   k6 run -e ENDPOINT=... -e VUS=5 load/submit.js
//
// Every row it writes has participantName LOADTEST-<runId>-<vu>-<round>, so
// load/verify.mjs can count them afterwards and delete them.
import http from 'k6/http';
import encoding from 'k6/encoding';
import exec from 'k6/execution';
import { check, sleep } from 'k6';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.1.0/index.js';

const ENDPOINT = __ENV.ENDPOINT;
const RUN_ID = __ENV.RUN_ID || `local-${Date.now()}`;
const VUS = Number(__ENV.VUS || 30);
const ROUNDS = Number(__ENV.ROUNDS || 1);
const GAP_SECONDS = Number(__ENV.GAP || 60);
if (VUS > 30) {
  throw new Error('The site serves at most 30 participants at once; VUS above 30 is not a realistic test.');
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
    bursts: {
      executor: 'per-vu-iterations',
      vus: VUS,
      iterations: ROUNDS,
      maxDuration: `${ROUNDS * GAP_SECONDS + 120}s`,
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
  const name = `LOADTEST-${RUN_ID}-${exec.vu.idInTest}-${exec.vu.iterationInScenario}`;
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
  // Line every participant up on the same instant for this round.
  const round = exec.vu.iterationInScenario;
  const roundStart = exec.scenario.startTime + round * GAP_SECONDS * 1000;
  const wait = (roundStart - Date.now()) / 1000;
  if (wait > 0) sleep(wait);

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

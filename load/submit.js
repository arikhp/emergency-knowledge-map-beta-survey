// k6 load test for the survey's submission backend (Google Apps Script web app).
//
// Sends the same form-urlencoded POST the app builds in src/lib/submitResponse.ts:
// every flattened field (src/lib/flatten.ts) plus a real ~400 KB PDF as base64.
// Point it ONLY at the test deployment, never the production Sheet:
//
//   k6 run -e ENDPOINT=<test web app URL> load/submit.js
//   k6 run -e ENDPOINT=... -e VUS=5 -e RAMP=30s -e HOLD=30s load/submit.js
//
// Every row it writes has participantName LOADTEST-<runId>-<vu>-<iter>, so the
// rows are easy to count and delete afterwards.
import http from 'k6/http';
import encoding from 'k6/encoding';
import exec from 'k6/execution';
import { check, sleep } from 'k6';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.1.0/index.js';

const ENDPOINT = __ENV.ENDPOINT;
const RUN_ID = __ENV.RUN_ID || `local-${Date.now()}`;
const VUS = Number(__ENV.VUS || 30);

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
    submissions: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: __ENV.RAMP || '2m', target: VUS },
        { duration: __ENV.HOLD || '1m', target: VUS },
        { duration: '20s', target: 0 },
      ],
      gracefulRampDown: '60s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.02'],
    // Apps Script usually answers in 2–6 s; writing the PDF to Drive is the slow part.
    'http_req_duration{name:submit}': ['p(95)<15000'],
    checks: ['rate>0.98'],
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
  // Apps Script replies 302 → script.googleusercontent.com; k6 follows it, and
  // the row + Drive file are written before that redirect is issued.
  const res = http.post(ENDPOINT, buildSubmission(), {
    tags: { name: 'submit' },
    timeout: '60s',
  });

  check(res, {
    'status 200': (r) => r.status === 200,
    'backend replied ok': (r) => typeof r.body === 'string' && r.body.includes('"ok":true'),
  });

  // Real participants don't resubmit back-to-back.
  sleep(rand(1, 3));
}

export function handleSummary(data) {
  return {
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
    'load/results/summary.json': JSON.stringify(data, null, 2),
    'load/results/summary.txt': textSummary(data, { indent: ' ', enableColors: false }),
  };
}

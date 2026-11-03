/* global __ENV, __VU, __ITER */
// Scenario 1: publish throughput and latency. Four phases run one after another, each with
// VUS virtual users publishing for PHASE_SECONDS: valid documents of 10, 100 and 500 `set`
// tasks (every one a new workflow), then documents the runtime refuses (422).
import { check } from 'k6';
import http from 'k6/http';
import {
  invalidWorkflows,
  namespaceOf,
  publish,
  setWorkflow,
  signIn,
  table,
  TREND_STATS,
} from './lib/common.js';

const VUS = Number(__ENV.VUS || 10);
const SECONDS = Number(__ENV.PHASE_SECONDS || 30);
const GAP = 5;
const SIZES = ['10', '100', '500', 'invalid'];

const scenarios = {};
const thresholds = {};

for (const [index, size] of SIZES.entries()) {
  scenarios[`publish_${size}`] = {
    executor: 'constant-vus',
    exec: size === 'invalid' ? 'publishInvalid' : 'publishValid',
    vus: VUS,
    duration: `${String(SECONDS)}s`,
    startTime: `${String(index * (SECONDS + GAP))}s`,
    gracefulStop: `${String(GAP)}s`,
    env: { SIZE: size },
    tags: { size },
  };
  thresholds[`http_req_duration{size:${size}}`] = [
    size === '500' ? 'p(95)<3000' : 'p(95)<1000',
  ];
  thresholds[`checks{size:${size}}`] = ['rate>0.99'];
}

export const options = {
  scenarios,
  thresholds,
  summaryTrendStats: TREND_STATS,
};

// A refused document answers 422; that is the expected outcome, not a failed request.
const refusedExpected = http.expectedStatuses(422);

export function setup() {
  return { cookie: signIn(), namespace: namespaceOf() };
}

export function publishValid(data) {
  const size = Number(__ENV.SIZE);
  const name = `p${String(size)}-${String(__VU)}-${String(__ITER)}`;
  const document = setWorkflow(data.namespace, name, size);
  const response = publish(data.cookie, document, { name: 'POST /workflows' });
  check(response, { 'published (201)': (r) => r.status === 201 });
}

export function publishInvalid(data) {
  const name = `bad-${String(__VU)}-${String(__ITER)}`;
  const documents = invalidWorkflows(data.namespace, name);
  const document = documents[__ITER % documents.length];
  const tags = { name: 'POST /workflows (invalid)' };
  const response = publish(data.cookie, document, tags, refusedExpected);
  check(response, { 'refused (422)': (r) => r.status === 422 });
}

export function handleSummary(data) {
  const rows = [];

  for (const size of SIZES) {
    rows.push({ metric: `http_req_duration{size:${size}}`, seconds: SECONDS });
    rows.push({ metric: `checks{size:${size}}` });
  }

  rows.push({ metric: 'http_req_failed' });
  const out = { stdout: table(data, rows) };

  if (__ENV.SUMMARY_JSON) out[__ENV.SUMMARY_JSON] = JSON.stringify(data);

  return out;
}

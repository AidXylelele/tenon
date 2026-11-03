/* global __ENV, __ITER */
// Scenario 4: a soak at moderate load for SOAK_SECONDS (default 5 minutes), watching error
// rates and whether latency drifts as the tables grow. At once:
//   runs        RUN_RATE/s instances started and polled (every POLL_MS) until they end:
//               seven in ten of the 5-task `set` workflow, three of the HTTP-call workflow
//   reads       READ_RATE/s: GET /instances?limit=50 and GET /instances/{id}
//   publishes   PUBLISH_RATE/s new 10-task workflows
// Metrics carry a `minute` tag (0, 1, ...) so the summary shows each minute apart.
import { check } from 'k6';
import http from 'k6/http';
import { Rate, Trend } from 'k6/metrics';
import {
  API,
  awaitEnd,
  headers,
  httpWorkflow,
  namespaceOf,
  publish,
  published,
  setWorkflow,
  signIn,
  start,
  table,
  TREND_STATS,
} from './lib/common.js';

const SECONDS = Number(__ENV.SOAK_SECONDS || 300);
const RUN_RATE = Number(__ENV.RUN_RATE || 14);
const READ_RATE = Number(__ENV.READ_RATE || 10);
const PUBLISH_RATE = Number(__ENV.PUBLISH_RATE || 0.5);
const POLL_MS = Number(__ENV.POLL_MS || 500);
const MINUTES = Math.ceil(SECONDS / 60);

const server = new Trend('soak_run_server_ms', true);
const reads = new Trend('soak_read_ms', true);
const errors = new Rate('soak_errors');

const thresholds = {
  soak_errors: ['rate<0.01'],
  http_req_failed: ['rate<0.01'],
  soak_run_server_ms: ['p(95)<5000'],
};

for (let minute = 0; minute < MINUTES; minute += 1) {
  thresholds[`soak_run_server_ms{minute:${String(minute)}}`] = ['p(95)<5000'];
  thresholds[`soak_read_ms{minute:${String(minute)}}`] = ['p(95)<500'];
  thresholds[`soak_errors{minute:${String(minute)}}`] = ['rate<0.01'];
}

const rated = (exec, rate, maxVUs) => ({
  executor: 'constant-arrival-rate',
  exec,
  rate: Math.round(rate * 10),
  timeUnit: '10s',
  duration: `${String(SECONDS)}s`,
  preAllocatedVUs: Math.min(maxVUs, 20),
  maxVUs,
  gracefulStop: '60s',
});

export const options = {
  scenarios: {
    runs: rated('run', RUN_RATE, 300),
    reads: rated('read', READ_RATE, 50),
    publishes: rated('publishOne', PUBLISH_RATE, 10),
  },
  thresholds,
  summaryTrendStats: TREND_STATS,
};

export function setup() {
  const cookie = signIn();
  const namespace = namespaceOf();
  published(cookie, setWorkflow(namespace, 'set', 5));
  published(cookie, httpWorkflow(namespace, 'http'));
  const first = start(cookie, namespace, 'set', {}, {}).json('id');
  return { cookie, namespace, first, began: Date.now() };
}

const minuteOf = (data) =>
  String(Math.floor((Date.now() - data.began) / 60_000));

export function run(data) {
  const name = __ITER % 10 < 7 ? 'set' : 'http';
  const tags = { minute: minuteOf(data), workflow: name };
  const response = start(data.cookie, data.namespace, name, {}, tags);
  const started = check(response, { started: (r) => r.status === 201 });

  if (!started) {
    errors.add(true, tags);
    return;
  }

  const id = response.json('id');
  const read = awaitEnd(data.cookie, id, POLL_MS, 120_000, tags);
  const done = read !== null && read.phase === 'completed';
  errors.add(!done, tags);

  if (!done) {
    console.warn(
      `instance ${id}: ${read === null ? 'no end seen' : read.phase}`,
    );
    return;
  }

  const created = Date.parse(read.createdAt);
  server.add(Date.parse(read.endedAt) - created, tags);
}

export function read(data) {
  const tags = { minute: minuteOf(data) };
  const params = { headers: headers(data.cookie), tags };
  const list = http.get(`${API}/instances?limit=50`, params);
  const detail = http.get(`${API}/instances/${data.first}`, params);

  for (const response of [list, detail]) {
    const ok = response.status === 200;
    errors.add(!ok, tags);

    if (ok) reads.add(response.timings.duration, tags);
  }
}

export function publishOne(data) {
  const tags = { minute: minuteOf(data) };
  const name = `soak-${String(Date.now())}-${String(__ITER)}`;
  const document = setWorkflow(data.namespace, name, 10);
  const response = publish(data.cookie, document, tags);
  const ok = check(response, { published: (r) => r.status === 201 });
  errors.add(!ok, tags);
}

export function handleSummary(data) {
  const rows = [
    { metric: 'soak_run_server_ms' },
    { metric: 'soak_errors' },
    { metric: 'http_req_failed' },
    { metric: 'iterations' },
    { metric: 'dropped_iterations' },
  ];

  for (let minute = 0; minute < MINUTES; minute += 1) {
    rows.push({ metric: `soak_run_server_ms{minute:${String(minute)}}` });
    rows.push({ metric: `soak_read_ms{minute:${String(minute)}}` });
    rows.push({ metric: `soak_errors{minute:${String(minute)}}` });
  }

  const out = { stdout: table(data, rows) };

  if (__ENV.SUMMARY_JSON) out[__ENV.SUMMARY_JSON] = JSON.stringify(data);

  return out;
}

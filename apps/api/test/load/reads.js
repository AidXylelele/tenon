/* global __ENV */
// Scenario 3: read latency of the instance list and an instance's tasks, first alone
// (phase:baseline, BASE_SECONDS), then while instances run (phase:loaded, LOAD_SECONDS):
// `writers` start 5-task `set` instances at WRITE_RATE/s and `loops` start 1000-item `for`
// instances at LOOP_RATE/s, so the engine is busy writing journals and task progress.
// Each reader iteration (READ_RATE/s) makes five reads:
//   list      GET /instances?limit=50
//   filtered  GET /instances?namespace=..&name=..&limit=50
//   detail    GET /instances/{id}
//   tasks     GET /instances/{id}/tasks?limit=100        (a 1000-iteration instance)
//   deep      GET /instances/{id}/tasks?cursor=..&limit=100 (its tenth page)
import { check, fail, sleep } from 'k6';
import http from 'k6/http';
import {
  API,
  forWorkflow,
  headers,
  namespaceOf,
  published,
  setWorkflow,
  signIn,
  start,
  table,
  TREND_STATS,
} from './lib/common.js';

const READ_RATE = Number(__ENV.READ_RATE || 20);
const WRITE_RATE = Number(__ENV.WRITE_RATE || 5);
const LOOP_RATE = Number(__ENV.LOOP_RATE || 0.1);
const BASE_SECONDS = Number(__ENV.BASE_SECONDS || 30);
const LOAD_SECONDS = Number(__ENV.LOAD_SECONDS || 60);
const ENDPOINTS = ['list', 'filtered', 'detail', 'tasks', 'deep'];
const PHASES = ['baseline', 'loaded'];

const reader = (phase, startTime, duration) => ({
  executor: 'constant-arrival-rate',
  exec: 'read',
  rate: READ_RATE,
  timeUnit: '1s',
  duration: `${String(duration)}s`,
  startTime: `${String(startTime)}s`,
  preAllocatedVUs: 20,
  maxVUs: 200,
  tags: { phase },
});

const loadStart = BASE_SECONDS + 5;
const thresholds = { 'checks{phase:loaded}': ['rate>0.99'] };

for (const phase of PHASES)
  for (const endpoint of ENDPOINTS)
    thresholds[`http_req_duration{endpoint:${endpoint},phase:${phase}}`] = [
      'p(95)<500',
    ];

export const options = {
  scenarios: {
    baseline: reader('baseline', 0, BASE_SECONDS),
    loaded: reader('loaded', loadStart, LOAD_SECONDS),
    writers: {
      executor: 'constant-arrival-rate',
      exec: 'startSet',
      rate: Math.round(WRITE_RATE * 10),
      timeUnit: '10s',
      duration: `${String(LOAD_SECONDS)}s`,
      startTime: `${String(loadStart)}s`,
      preAllocatedVUs: 10,
      maxVUs: 50,
      tags: { phase: 'writers' },
    },
    loops: {
      executor: 'constant-arrival-rate',
      exec: 'startLoop',
      rate: Math.max(1, Math.round(LOOP_RATE * 100)),
      timeUnit: '100s',
      duration: `${String(LOAD_SECONDS)}s`,
      startTime: `${String(loadStart)}s`,
      preAllocatedVUs: 2,
      maxVUs: 10,
      tags: { phase: 'writers' },
    },
  },
  thresholds,
  summaryTrendStats: TREND_STATS,
  setupTimeout: '180s',
};

const items = [];

for (let index = 0; index < 1000; index += 1) items.push(index);

function waitFor(cookie, id, seconds) {
  for (let tick = 0; tick < seconds * 2; tick += 1) {
    sleep(0.5);
    const response = http.get(`${API}/instances/${id}`, {
      headers: headers(cookie),
    });

    if (response.json('phase') === 'completed') return;
  }

  fail(`instance ${id} did not complete in ${String(seconds)} s`);
}

// One finished instance of each workflow to read, and the cursor of the long one's tenth page.
export function setup() {
  const cookie = signIn();
  const namespace = namespaceOf();
  published(cookie, setWorkflow(namespace, 'set', 5));
  published(cookie, forWorkflow(namespace, 'for'));
  const short = start(cookie, namespace, 'set', {}, {}).json('id');
  const long = start(cookie, namespace, 'for', { items }, {}).json('id');
  waitFor(cookie, short, 30);
  waitFor(cookie, long, 150);
  let cursor = null;

  for (let page = 1; page < 10; page += 1) {
    const after = cursor === null ? '' : `&cursor=${String(cursor)}`;
    const url = `${API}/instances/${long}/tasks?limit=100${after}`;
    cursor = http.get(url, { headers: headers(cookie) }).json('next');
  }

  return { cookie, namespace, short, long, cursor };
}

function get(data, url, endpoint) {
  const response = http.get(url, {
    headers: headers(data.cookie),
    tags: { endpoint, name: endpoint },
  });
  check(response, { [`${endpoint} 200`]: (r) => r.status === 200 });
}

export function read(data) {
  const filter = `namespace=${data.namespace}&name=set`;
  get(data, `${API}/instances?limit=50`, 'list');
  get(data, `${API}/instances?${filter}&limit=50`, 'filtered');
  get(data, `${API}/instances/${data.short}`, 'detail');
  get(data, `${API}/instances/${data.long}/tasks?limit=100`, 'tasks');
  const deep = `${API}/instances/${data.long}/tasks?cursor=${String(data.cursor)}&limit=100`;
  get(data, deep, 'deep');
}

export function startSet(data) {
  const response = start(data.cookie, data.namespace, 'set', {}, {});
  check(response, { 'set started': (r) => r.status === 201 });
}

export function startLoop(data) {
  const response = start(data.cookie, data.namespace, 'for', { items }, {});
  check(response, { 'for started': (r) => r.status === 201 });
}

export function handleSummary(data) {
  const rows = [];

  for (const phase of PHASES)
    for (const endpoint of ENDPOINTS)
      rows.push({
        metric: `http_req_duration{endpoint:${endpoint},phase:${phase}}`,
      });

  rows.push({ metric: 'checks{phase:loaded}' });
  rows.push({ metric: 'http_req_failed' });
  const out = { stdout: table(data, rows) };

  if (__ENV.SUMMARY_JSON) out[__ENV.SUMMARY_JSON] = JSON.stringify(data);

  return out;
}

/* global __ENV */
// Scenario 2: start-and-complete. VUS virtual users each start an instance, poll
// GET /instances/{id} until it ends, and start the next, for DURATION seconds.
//   WORKFLOW=set   five `set` tasks
//   WORKFLOW=for   a `for` over 1000 items, one `set` per iteration
//   WORKFLOW=http  two service calls to the local stub (stub-server.mjs)
// Metrics: run_e2e_ms (start request to observed end, client side), run_server_ms (endedAt -
// createdAt), run_queue_ms (startedAt - createdAt: the wait for an engine slot); teardown reads
// the instances back and reports completed runs per second over the first start to the last end.
import { check, fail } from 'k6';
import http from 'k6/http';
import { Counter, Rate, Trend } from 'k6/metrics';
import {
  API,
  awaitEnd,
  forWorkflow,
  headers,
  httpWorkflow,
  namespaceOf,
  published,
  setWorkflow,
  signIn,
  start,
  table,
  TREND_STATS,
} from './lib/common.js';

const WORKFLOW = __ENV.WORKFLOW || 'set';
const VUS = Number(__ENV.VUS || 1);
const DURATION = Number(__ENV.DURATION || 60);
const LOOP = WORKFLOW === 'for';
const POLL_MS = Number(__ENV.POLL_MS || (LOOP ? 500 : 100));
const TIMEOUT_MS = Number(__ENV.TIMEOUT_MS || (LOOP ? 900_000 : 120_000));
const ITEMS = Number(__ENV.ITEMS || 1000);

const e2e = new Trend('run_e2e_ms', true);
const server = new Trend('run_server_ms', true);
const queue = new Trend('run_queue_ms', true);
const completed = new Counter('runs_completed');
const ended = new Rate('run_ok');
const throughput = new Trend('runs_per_second');

const budgets = { set: 5_000, http: 5_000, for: 600_000 };

export const options = {
  scenarios: {
    runs: {
      executor: 'constant-vus',
      vus: VUS,
      duration: `${String(DURATION)}s`,
      // An instance started before the end may finish: its run counts.
      gracefulStop: `${String(Math.ceil(TIMEOUT_MS / 1000))}s`,
    },
  },
  thresholds: {
    run_ok: ['rate>0.99'],
    run_server_ms: [`p(95)<${String(budgets[WORKFLOW])}`],
    'http_req_failed{phase:start}': ['rate<0.01'],
    'http_req_duration{phase:start}': ['p(95)<1000'],
    'http_req_duration{phase:poll}': ['p(95)<500'],
  },
  summaryTrendStats: TREND_STATS,
  setupTimeout: '120s',
  teardownTimeout: '300s',
};

// Every run publishes its own workflow, named after the shape it runs.
const name = WORKFLOW;

function documentOf(namespace) {
  if (WORKFLOW === 'set') return setWorkflow(namespace, name, 5);

  if (WORKFLOW === 'for') return forWorkflow(namespace, name);

  if (WORKFLOW === 'http') return httpWorkflow(namespace, name);

  return fail(`unknown WORKFLOW ${WORKFLOW}`);
}

function inputOf() {
  if (!LOOP) return {};

  const items = [];

  for (let index = 0; index < ITEMS; index += 1) items.push(index);

  return { items };
}

export function setup() {
  const cookie = signIn();
  const namespace = namespaceOf();
  published(cookie, documentOf(namespace));
  return { cookie, namespace };
}

const input = inputOf();

export default function (data) {
  const begun = Date.now();
  const response = start(data.cookie, data.namespace, name, input, {
    phase: 'start',
  });
  const accepted = check(response, {
    'started (201)': (r) => r.status === 201,
  });

  if (!accepted) {
    ended.add(false);
    return;
  }

  const id = response.json('id');
  const read = awaitEnd(data.cookie, id, POLL_MS, TIMEOUT_MS, {
    phase: 'poll',
  });
  const done = read !== null && read.phase === 'completed';
  ended.add(done);
  check(read, { completed: () => done });

  if (!done) {
    console.warn(
      `instance ${id} ended as ${read === null ? 'timeout' : JSON.stringify(read.error)}`,
    );
    return;
  }

  completed.add(1);
  e2e.add(Date.now() - begun);
  const created = Date.parse(read.createdAt);
  server.add(Date.parse(read.endedAt) - created);
  queue.add(Date.parse(read.startedAt) - created);
}

// Completed runs per second, from the instances themselves: first createdAt to last endedAt.
export function teardown(data) {
  let cursor = null;
  let count = 0;
  let first = Infinity;
  let last = 0;

  do {
    const after =
      cursor === null ? '' : `&cursor=${encodeURIComponent(cursor)}`;
    const url = `${API}/instances?namespace=${data.namespace}&name=${name}&limit=200${after}`;
    const response = http.get(url, {
      headers: headers(data.cookie),
      tags: { name: 'teardown' },
    });

    if (response.status !== 200) break;

    const page = response.json();

    for (const item of page.items) {
      if (item.phase !== 'completed') continue;

      count += 1;
      first = Math.min(first, Date.parse(item.createdAt));
      last = Math.max(last, Date.parse(item.endedAt));
    }

    cursor = page.next;
  } while (cursor !== null);

  const seconds = (last - first) / 1000;
  const rate = seconds > 0 ? count / seconds : 0;
  throughput.add(rate);
  console.log(
    `${WORKFLOW} x ${String(VUS)} VUs: ${String(count)} completed in ${seconds.toFixed(1)} s = ${rate.toFixed(2)} runs/s`,
  );
}

export function handleSummary(data) {
  const rows = [
    { metric: 'run_server_ms' },
    { metric: 'run_queue_ms' },
    { metric: 'run_e2e_ms' },
    { metric: 'runs_completed' },
    { metric: 'run_ok' },
    { metric: 'runs_per_second' },
    { metric: 'http_req_duration{phase:start}' },
    { metric: 'http_req_duration{phase:poll}' },
    { metric: 'http_req_failed{phase:start}' },
  ];
  const title = `runs: WORKFLOW=${WORKFLOW} VUS=${String(VUS)} DURATION=${String(DURATION)}s\n`;
  const out = { stdout: title + table(data, rows) };

  if (__ENV.SUMMARY_JSON) out[__ENV.SUMMARY_JSON] = JSON.stringify(data);

  return out;
}

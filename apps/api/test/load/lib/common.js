/* global __ENV */
// Shared k6 helpers: configuration, sign-in, request headers, the workflow documents the
// scenarios publish, and a run that is started and polled until it ends.
import { check, fail, sleep } from 'k6';
import http from 'k6/http';

export const BASE_URL = __ENV.BASE_URL || 'http://127.0.0.1:3000';
export const API = `${BASE_URL}/api/v1`;
// POSTs need an Origin from TRUSTED_ORIGINS (CSRF protection).
export const ORIGIN = __ENV.ORIGIN || 'http://127.0.0.1:3001';
export const EMAIL = __ENV.EDITOR_EMAIL || 'load-editor@example.com';
export const PASSWORD = __ENV.EDITOR_PASSWORD || 'load-test-password-123';
export const STUB_URL = __ENV.STUB_URL || 'http://127.0.0.1:18080';

// The namespace that keeps one k6 run's workflows apart (DSL names: [a-z0-9-], 63 at most).
// Init code runs once per VU, so setup() picks it and hands it to every VU in its data.
export function namespaceOf() {
  const id = (__ENV.RUN_ID || Date.now().toString(36)).toLowerCase();
  return `load-${id}`;
}

export const TREND_STATS = [
  'avg',
  'min',
  'med',
  'p(95)',
  'p(99)',
  'max',
  'count',
];

// Signs the editor in once; the session cookie goes to every VU through setup()'s data.
export function signIn() {
  const body = JSON.stringify({ email: EMAIL, password: PASSWORD });
  const response = http.post(`${API}/auth/session`, body, {
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
    tags: { name: 'sign-in' },
  });
  const signed = check(response, { 'signed in': (r) => r.status === 200 });

  if (!signed) fail(`sign-in failed: ${response.status} ${response.body}`);

  const sid = response.cookies.sid;

  if (sid === undefined || sid.length === 0) fail('no sid cookie');

  return `sid=${sid[0].value}`;
}

export function headers(cookie) {
  return {
    'Content-Type': 'application/json',
    Origin: ORIGIN,
    Cookie: cookie,
  };
}

const header = (namespace, name) => ({
  dsl: '1.0.3',
  namespace,
  name,
  version: '1.0.0',
});

// `count` set tasks in a row, each with one runtime expression (one jq compile at publish,
// one jq evaluation per run).
export function setWorkflow(namespace, name, count) {
  const tasks = [];

  for (let index = 0; index < count; index += 1) {
    const task = {
      set: { step: index, sum: `\${ (.sum // 0) + ${String(index)} }` },
    };
    tasks.push({ [`t${String(index)}`]: task });
  }

  return { document: header(namespace, name), do: tasks };
}

// A `for` over the input's items with one `set` per iteration (two expressions in it).
export function forWorkflow(namespace, name) {
  const body = {
    set: { count: '${ (.count // 0) + 1 }', last: '${ $item }' },
  };
  const loop = {
    for: { each: 'item', in: '${ .items }' },
    do: [{ acc: body }],
  };
  return { document: header(namespace, name), do: [{ loop }] };
}

// Two service calls to the local stub (GET, then a POST of what the first answered).
export function httpWorkflow(namespace, name) {
  const fetch = {
    call: 'http',
    with: { method: 'get', endpoint: { uri: `${STUB_URL}/lead` } },
  };
  const post = {
    call: 'http',
    with: {
      method: 'post',
      endpoint: { uri: `${STUB_URL}/route` },
      body: { lead: '${ .path }' },
    },
  };
  return { document: header(namespace, name), do: [{ fetch }, { post }] };
}

// Documents the runtime refuses, one per kind of check (schema, expressions, references).
export function invalidWorkflows(namespace, name) {
  const missing = {
    call: 'http',
    with: { method: 'get' },
  };
  const broken = { set: { x: '${ .x | }' } };
  const dangling = { set: { x: 1 }, then: 'nowhere' };
  return [
    { document: header(namespace, `${name}-schema`), do: [{ fetch: missing }] },
    { document: header(namespace, `${name}-jq`), do: [{ broken }] },
    { document: header(namespace, `${name}-ref`), do: [{ dangling }] },
  ];
}

// `expected`: the statuses that count as a successful request (k6's default is 200-399).
export function publish(cookie, document, tags, expected) {
  const body = JSON.stringify(document);
  const params = { headers: headers(cookie), tags };

  if (expected !== undefined) params.responseCallback = expected;

  return http.post(`${API}/workflows`, body, params);
}

// Publishes in setup(); a repeat of the same document answers 200, a first publish 201.
export function published(cookie, document) {
  const response = publish(cookie, document, { name: 'setup-publish' });
  const ok = response.status === 201 || response.status === 200;

  if (!ok) fail(`publish failed: ${response.status} ${response.body}`);
}

export function start(cookie, namespace, name, input, tags) {
  const body = JSON.stringify({ input });
  const url = `${API}/workflows/${namespace}/${name}/instances`;
  return http.post(url, body, {
    headers: headers(cookie),
    tags: Object.assign(
      { name: 'POST /workflows/{ns}/{name}/instances' },
      tags,
    ),
  });
}

export function instance(cookie, id, tags) {
  return http.get(`${API}/instances/${id}`, {
    headers: headers(cookie),
    tags: Object.assign({ name: 'GET /instances/{id}' }, tags),
  });
}

// Polls the instance until it leaves pending/running/waiting, or until `timeoutMs` passes;
// answers the last instance read (null on a failed read or a timeout).
export function awaitEnd(cookie, id, pollMs, timeoutMs, tags) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    sleep(pollMs / 1000);
    const response = instance(cookie, id, tags);

    if (response.status !== 200) return null;

    const read = response.json();
    const live = ['pending', 'running', 'waiting', 'suspended'];

    if (!live.includes(read.phase)) return read;
  }

  return null;
}

// The end-of-test summary as a compact table: one row per tagged sub-metric that has a
// threshold, its rate taken over the duration given for its group.
export function table(data, rows) {
  const lines = [
    'metric | p50 | p95 | p99 | max | count | per s | rate | thresholds',
  ];

  for (const row of rows) {
    const metric = data.metrics[row.metric];

    if (metric === undefined) continue;

    const v = metric.values;
    const count = v.count === undefined ? v.passes + v.fails : v.count;
    const perSecond =
      row.seconds === undefined ? '' : (count / row.seconds).toFixed(2);
    const fixed = (value) => (value === undefined ? '' : value.toFixed(1));
    const ratio = v.rate === undefined ? '' : v.rate.toFixed(4);
    const verdicts = Object.entries(metric.thresholds || {}).map(
      ([expression, verdict]) => `${expression} ${verdict.ok ? 'ok' : 'FAIL'}`,
    );
    lines.push(
      [
        row.metric,
        fixed(v.med),
        fixed(v['p(95)']),
        fixed(v['p(99)']),
        fixed(v.max),
        String(count),
        perSecond,
        ratio,
        verdicts.join(', '),
      ].join(' | '),
    );
  }

  return `${lines.join('\n')}\n`;
}

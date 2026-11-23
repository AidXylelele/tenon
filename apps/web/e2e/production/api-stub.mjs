import { createServer } from "node:http";

const PORT = Number(process.env.API_STUB_PORT ?? "6108");

const ADA = {
  id: "8d6f3a52-2c1e-4b8a-9a55-0d9b3c1f7e01",
  name: "Ada Lovelace",
};

const SESSION = {
  user: { ...ADA, email: "ada@example.com", role: "editor" },
  capabilities: { author: true, operator: true, administrator: false },
};

const PROFILE = {
  effects: ["http", "process", "timer", "emit", "listen", "workflow"],
  authentications: ["basic", "bearer"],
  processes: ["script", "shell"],
  scriptLanguages: ["js", "python"],
  asyncApiProtocols: [],
  mcpTransports: [],
  mcpTransportOptions: [],
  schedules: ["every", "cron", "after", "on"],
  triggers: "one",
  grants: [],
  lifecycleEvents: [],
  shell: { platform: "linux", shell: "sh", commands: [] },
};

const DIGEST = `document:
  dsl: '1.1.0'
  namespace: sales
  name: digest
  version: '1.0.1'
  title: Daily digest
schedule:
  cron: 0 9 * * *
do:
  - Fetch the digest:
      call: http
      with:
        method: get
        endpoint: https://httpbin.org/json
  - Has items:
      switch:
        - has items:
            when: '\${ .slideshow.slides | . != null and . != "" and . != [] and . != {} }'
            then: continue
        - default:
            then: end
  - Normalize names:
      run:
        script:
          language: js
          code: |
            const names=[ 'ada','grace' ];console.log(JSON.stringify(names.map(n=>n.toUpperCase())))
      output:
        as: \${ fromjson }
  - Score a lead:
      run:
        script:
          language: python
          code: |
            import json
            print(json.dumps({'score':  7}))
      output:
        as: \${ fromjson }
  - Post the items:
      call: http
      with:
        method: post
        endpoint: https://httpbin.org/post
        body:
          text: 'New digest: \${ .slideshow.title }'
`;

const EMPTY = `document:
  dsl: '1.1.0'
  namespace: sales
  name: empty
  version: '0.1.0'
  title: New workflow
do: []
`;

const RUN_ID = "5b0c6a8e-7f0d-4a7e-9f61-3c2b1a0d9e11";

const drafts = new Map([
  ["sales/digest", { source: DIGEST, etag: 1 }],
  ["sales/empty", { source: EMPTY, etag: 1 }],
]);

let tested = null;

const PUBLISHED_STRUCTURE = {
  namespace: "sales",
  name: "digest",
  title: "Daily digest",
  triggers: [],
  steps: { id: "/do", pointer: "/do", role: "sequence", steps: [] },
  summary: null,
  input: { schema: null },
};

function send(response, status, body, headers = {}) {
  const text = body === undefined ? "" : JSON.stringify(body);
  response.writeHead(status, {
    "content-type": "application/json",
    ...headers,
  });
  response.end(text);
}

function draftOf(key) {
  const kept = drafts.get(key);
  const draft = {
    source: kept.source,
    layout: {},
    savedBy: ADA,
    savedAt: new Date().toISOString(),
  };
  return { draft, etag: `"${String(kept.etag)}"` };
}

function workflowOf(namespace, name) {
  return {
    namespace,
    name,
    title: name === "digest" ? "Daily digest" : null,
    status: "active",
    on: true,
    currentVersion: name === "digest" ? "1.0.0" : null,
    schedule: null,
    starts: 0,
    lastRun: null,
  };
}

function runOf(phase) {
  const at = "2026-11-23T08:10:00.000Z";
  return {
    id: RUN_ID,
    namespace: "sales",
    name: "digest",
    version: "1.0.1-test",
    phase,
    trigger: "manual",
    test: true,
    createdAt: at,
    startedAt: at,
    endedAt: phase === "completed" ? "2026-11-23T08:10:00.700Z" : null,
    input: {},
    output: null,
    error: null,
    originId: null,
    startedBy: ADA,
    controls: [],
    cancelReason: null,
    waits: [],
  };
}

function recordOf(reference, name, output, endedAt) {
  return {
    execution: `${reference}#0`,
    reference,
    name,
    status: "completed",
    error: null,
    startedAt: "2026-11-23T08:10:00.000Z",
    endedAt,
    attempt: 1,
    input: {},
    output,
    retryAt: null,
  };
}

const SLIDES = {
  slideshow: {
    title: "Sample Slide Show",
    slides: [{ title: "Wake up to WonderWidgets!" }, { title: "Overview" }],
  },
};

const RECORDS = [
  recordOf(
    "/do/0/Fetch the digest",
    "Fetch the digest",
    SLIDES,
    "2026-11-23T08:10:00.512Z",
  ),
  recordOf("/do/1/Has items", "Has items", SLIDES, "2026-11-23T08:10:00.513Z"),
  recordOf(
    "/do/2/Normalize names",
    "Normalize names",
    ["ADA", "GRACE"],
    "2026-11-23T08:10:00.600Z",
  ),
  recordOf(
    "/do/3/Score a lead",
    "Score a lead",
    { score: 7 },
    "2026-11-23T08:10:00.640Z",
  ),
  recordOf(
    "/do/4/Post the items",
    "Post the items",
    { ok: true },
    "2026-11-23T08:10:00.700Z",
  ),
];

async function bodyOf(request) {
  const chunks = [];

  for await (const chunk of request) chunks.push(chunk);

  const text = Buffer.concat(chunks).toString("utf8");
  return text === "" ? undefined : JSON.parse(text);
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://localhost:${String(PORT)}`);
  const path = url.pathname.replace(/^\/api\/v1/, "");
  const method = request.method ?? "GET";
  const draftMatch = /^\/workflows\/([^/]+)\/([^/]+)\/draft$/.exec(path);
  const testMatch = /^\/workflows\/([^/]+)\/([^/]+)\/draft\/test-runs$/.exec(
    path,
  );
  const workflowMatch = /^\/workflows\/([^/]+)\/([^/]+)$/.exec(path);

  if (path === "/health/ready") return send(response, 200, { status: "ok" });

  if (path === "/auth/session") return send(response, 200, SESSION);

  if (path === "/host-profile") return send(response, 200, PROFILE);

  if (path === "/secrets") return send(response, 200, []);

  if (path === "/webhooks") return send(response, 200, []);

  if (draftMatch !== null) {
    const key = `${decodeURIComponent(draftMatch[1])}/${decodeURIComponent(draftMatch[2])}`;

    if (!drafts.has(key)) return send(response, 404);

    if (method === "PUT") {
      const body = await bodyOf(request);
      const kept = drafts.get(key);
      drafts.set(key, { source: body.source, etag: kept.etag + 1 });
    }

    const revision = draftOf(key);
    return send(response, 200, revision.draft, { etag: revision.etag });
  }

  if (testMatch !== null && method === "POST") {
    tested = Date.now();
    return send(response, 201, runOf("running"));
  }

  if (workflowMatch !== null) {
    const namespace = decodeURIComponent(workflowMatch[1]);
    const name = decodeURIComponent(workflowMatch[2]);
    return send(response, 200, workflowOf(namespace, name));
  }

  if (path === "/workflows/sales/digest/versions/1.0.0/structure")
    return send(response, 200, PUBLISHED_STRUCTURE);

  if (path === `/instances/${RUN_ID}`) {
    const ran = tested !== null && Date.now() - tested > 1500;
    return send(response, 200, runOf(ran ? "completed" : "running"));
  }

  if (path === `/instances/${RUN_ID}/tasks`) {
    const ran = tested !== null && Date.now() - tested > 1500;
    const items = ran ? RECORDS : RECORDS.slice(0, 1);
    return send(response, 200, { items, next: null });
  }

  return send(response, 404, {
    type: "about:blank",
    title: "Not found",
    status: 404,
    detail: "Not found",
  });
});

server.listen(PORT);

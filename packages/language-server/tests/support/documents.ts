const header = `document:
  dsl: '1.1.0'
  namespace: test
  name: flow
  version: '0.1.0'
`;

export const flow = `${header}do:
  - route:
      switch:
        - known:
            when: '\${ .known }'
            then: nowhere
        - fallback:
            then: end
`;

export const pushed = {
  range: {
    start: { line: 10, character: 18 },
    end: { line: 10, character: 25 },
  },
  severity: 1,
  code: "unknown-task",
  source: "workflow",
  message: "Task 'nowhere' is not declared in this list.",
};

export const inlineHeader = `document: { dsl: '1.1.0', namespace: test, name: flow, version: '0.1.0' }
`;

export const guardedFlow = `${header}do:
  - greet:
      set:
        message: hello
  - guard:
      try:
        - fetch:
            call: http
            with:
              method: get
              endpoint: https://example.com
      catch:
        do:
          - notify:
              set:
                failed: true
  - route:
      switch:
        - again:
            when: '\${ .retry }'
            then: guard
        - done:
            then: end
`;

export const countdownFlow = `${header}use:
  functions:
    countdown:
      set:
        left: 3
do:
  - start:
      call: countdown
  - again:
      call: countdown
`;

export const greet = `${header}do:
  - greet:
      set:
        a: 1
`;

export const greetValue = {
  document: { dsl: "1.1.0", namespace: "test", name: "flow", version: "0.1.0" },
  do: [{ greet: { set: { a: 1 } } }],
};

export const greetText =
  "document:\n  dsl: 1.1.0\n  namespace: test\n  name: flow\n  version: 0.1.0\ndo:\n  - greet:\n      set:\n        a: 1\n";

export const refusedGreet = `${header}do:
  - greet:
      set:
        a: 1
      nope: 1
`;

export const surrogateFlow = `${header}
do:
  - a: { set: { x: '𐐀' }, then: nowhere }
`;

export const unreadable = "do: [\n";

export const U =
  "https://raw.githubusercontent.com/open-workflow-specification/catalog/main/functions/log/1.0.0/function.yaml";

export const catalogsHeader = `document:
  dsl: '1.1.0'
  namespace: test
  name: catalogs
  version: '0.1.0'
`;

export const uriFlow = `${catalogsHeader}do:
  - log:
      call: ${U}
      with:
        message: hello
  - again:
      call: ${U}
      with:
        message: again
`;

export const logText = `input:
  schema:
    document:
      type: object
      properties:
        message:
          type: string
      required: [ message ]
set:
  logged: \${ .message }
`;

export const unresolved = [
  { code: "unresolved-import" },
  { code: "unresolved-import" },
];

export const orderFlow = `${inlineHeader}do:
  - each:
      for:
        in: \${ .orders }
        each: order
      do:
        - total:
            set:
              sum: \${ $order.price }
              quoted: "\${ $order.name }"
`;

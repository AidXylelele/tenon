export interface DefectiveDocument {
  readonly defect: string;
  readonly pointer: string;
  readonly tasks: string;
  readonly use?: string;
  readonly extra?: string;
  readonly dsl?: string;
}

export const DEFECTIVE_DOCUMENTS: readonly DefectiveDocument[] = [
  {
    defect: 'an unknown task property',
    pointer: '/do/0/a',
    tasks: '  - a:\n      set: { x: 1 }\n      bogus: true\n',
  },
  {
    defect: 'a task without a kind',
    pointer: '/do/0/a',
    tasks: '  - a:\n      bogus: 1\n',
  },
  {
    defect: 'set with a number',
    pointer: '/do/0/a/set',
    tasks: '  - a:\n      set: 5\n',
  },
  {
    defect: 'an http call without an endpoint',
    pointer: '/do/0/a/with',
    tasks: '  - a:\n      call: http\n      with:\n        method: get\n',
  },
  {
    defect: 'a for loop over a number',
    pointer: '/do/0/a/for/in',
    tasks:
      '  - a:\n      for:\n        in: 5\n      do:\n        - b:\n            set: { y: 1 }\n',
  },
  {
    defect: 'a try without catch',
    pointer: '/do/0/a',
    tasks: '  - a:\n      try:\n        - b:\n            set: { y: 1 }\n',
  },
  {
    defect: 'a raise without an error',
    pointer: '/do/0/a/raise',
    tasks: '  - a:\n      raise: {}\n',
  },
  {
    defect: 'an error without a status',
    pointer: '/do/0/a/raise/error',
    tasks:
      '  - a:\n      raise:\n        error:\n          type: https://example.com/x\n',
  },
  {
    defect: 'a task list that is not a list',
    pointer: '/do',
    tasks: '  a:\n    set: { x: 1 }\n',
  },
  {
    defect: 'an invalid namespace',
    pointer: '/document/namespace',
    tasks: '  - a:\n      set: { x: 1 }\n',
    extra: '',
  },
  {
    defect: 'an unsupported DSL version',
    pointer: '',
    tasks: '  - a:\n      set: { x: 1 }\n',
    dsl: '1.0.4',
  },
  {
    defect: 'the wait task',
    pointer: '/do/0/a/wait',
    tasks: '  - a:\n      wait: PT1S\n',
  },
  {
    defect: 'the listen task',
    pointer: '/do/0/a/listen',
    tasks:
      '  - a:\n      listen:\n        to:\n          one:\n            with:\n              type: com.example.x\n',
  },
  {
    defect: 'a gRPC call',
    pointer: '/do/0/a/call',
    tasks:
      '  - a:\n      call: grpc\n      with:\n        proto:\n          endpoint: https://example.com/a.proto\n        service:\n          name: S\n          host: example.com\n        method: M\n',
  },
  {
    defect: 'a container',
    pointer: '/do/0/a/run/container',
    tasks: '  - a:\n      run:\n        container:\n          image: alpine\n',
  },
  {
    defect: 'a script source',
    pointer: '/do/0/a/run/script/source',
    tasks:
      '  - a:\n      run:\n        script:\n          language: python\n          source:\n            endpoint: https://example.com/a.py\n',
  },
  {
    defect: 'a script language outside the subset',
    pointer: '/do/0/a/run/script/language',
    tasks:
      '  - a:\n      run:\n        script:\n          language: ruby\n          code: puts 1\n',
  },
  {
    defect: 'use.secrets',
    pointer: '/use/secrets',
    tasks: '  - a:\n      set: { x: 1 }\n',
    use: '  secrets: [token]\n',
  },
  {
    defect: 'use.extensions',
    pointer: '/use/extensions',
    tasks: '  - a:\n      set: { x: 1 }\n',
    use: '  extensions:\n    - log:\n        extend: all\n',
  },
  {
    defect: 'a schedule',
    pointer: '/schedule',
    tasks: '  - a:\n      set: { x: 1 }\n',
    extra: 'schedule:\n  every: PT1M\n',
  },
  {
    defect: 'digest authentication',
    pointer: '/do/0/a/with/endpoint/authentication/digest',
    tasks:
      '  - a:\n      call: http\n      with:\n        method: get\n        endpoint:\n          uri: https://example.com\n          authentication:\n            digest:\n              username: u\n              password: p\n',
  },
  {
    defect: 'a fractional day',
    pointer: '/do/0/a/timeout/after',
    tasks:
      '  - a:\n      set: { x: 1 }\n      timeout:\n        after: P1.5D\n',
  },
  {
    defect: 'a competing fork without branches',
    pointer: '/do/0/a/fork/branches',
    tasks: '  - a:\n      fork:\n        compete: true\n        branches: []\n',
  },
  {
    defect: 'authentication taken from a secret',
    pointer: '/do/0/a/with/endpoint/authentication/bearer/use',
    tasks:
      '  - a:\n      call: http\n      with:\n        method: get\n        endpoint:\n          uri: https://example.com\n          authentication:\n            bearer:\n              use: token\n',
  },
  {
    defect: 'a runtime expression as a retry delay',
    pointer: '/do/0/a/catch/retry/delay',
    tasks:
      "  - a:\n      try:\n        - b:\n            set: { y: 1 }\n      catch:\n        retry:\n          delay: '${ .delay }'\n",
  },
  {
    defect: 'a negative attempt count',
    pointer: '/do/0/a/catch/retry/limit/attempt/count',
    tasks:
      '  - a:\n      try:\n        - b:\n            set: { y: 1 }\n      catch:\n        retry:\n          limit:\n            attempt:\n              count: -1\n',
  },
  {
    defect: 'an emitted event without with',
    pointer: '/do/0/a/emit/event/with',
    tasks: '  - a:\n      emit:\n        event: {}\n',
  },
  {
    defect: 'a declared function going to a named task',
    pointer: '/use/functions/finish/then',
    tasks: '  - a:\n      call: finish\n',
    use: '  functions:\n    finish:\n      set: { done: true }\n      then: a\n',
  },
  {
    defect: 'a directive to a missing task',
    pointer: '/do/0/a/then',
    tasks: '  - a:\n      set: { x: 1 }\n      then: nowhere\n',
  },
  {
    defect: 'a directive out of its scope',
    pointer: '/do/0/outer/do/0/inner/then',
    tasks:
      '  - outer:\n      do:\n        - inner:\n            set: { x: 1 }\n            then: sibling\n  - sibling:\n      set: { y: 1 }\n',
  },
  {
    defect: 'two tasks with one name',
    pointer: '/do',
    tasks: '  - a:\n      set: { x: 1 }\n  - a:\n      set: { x: 2 }\n',
  },
  {
    defect: 'an undeclared function',
    pointer: '/do/0/a/call',
    tasks: '  - a:\n      call: notify\n',
  },
  {
    defect: 'an undeclared retry policy',
    pointer: '/do/0/a/catch/retry',
    tasks:
      '  - a:\n      try:\n        - b:\n            set: { y: 1 }\n      catch:\n        retry: missing\n',
  },
  {
    defect: 'an undeclared error',
    pointer: '/do/0/a/raise/error',
    tasks: '  - a:\n      raise:\n        error: missing\n',
  },
  {
    defect: 'an undeclared timeout',
    pointer: '/do/0/a/timeout',
    tasks: '  - a:\n      set: { x: 1 }\n      timeout: missing\n',
  },
  {
    defect: 'a malformed expression in a template',
    pointer: '/do/0/a/set/x',
    tasks: "  - a:\n      set:\n        x: '${ .a + }'\n",
  },
  {
    defect: 'a malformed condition',
    pointer: '/do/0/a/if',
    tasks: "  - a:\n      if: '.a ==='\n      set: { x: 1 }\n",
  },
  {
    defect: 'a malformed loop collection',
    pointer: '/do/0/a/for/in',
    tasks:
      "  - a:\n      for:\n        in: '.items['\n      do:\n        - b:\n            set: { y: 1 }\n",
  },
  {
    defect: 'a malformed output transformation',
    pointer: '/do/0/a/output/as',
    tasks: "  - a:\n      set: { x: 1 }\n      output:\n        as: '. | {'\n",
  },
  {
    defect: 'an unusable workflow input schema',
    pointer: '/input/schema',
    tasks: '  - a:\n      set: { x: 1 }\n',
    extra:
      'input:\n  schema:\n    format: json\n    document:\n      type: nonsense\n',
  },
  {
    defect: 'an unusable output schema of a nested task',
    pointer: '/do/0/a/do/0/b/output/schema',
    tasks:
      '  - a:\n      do:\n        - b:\n            set: { y: 1 }\n            output:\n              schema:\n                document:\n                  minimum: high\n',
  },
  {
    defect: 'an export schema that refers outside the document',
    pointer: '/do/0/a/export/schema',
    tasks:
      "  - a:\n      set: { x: 1 }\n      export:\n        schema:\n          document:\n            $ref: 'https://example.com/order.json'\n",
  },
];

export function yamlOf(document: DefectiveDocument): string {
  const dsl = document.dsl ?? '1.0.3';
  const namespace =
    document.defect === 'an invalid namespace' ? 'Bad_Namespace' : 'default';
  const use = document.use === undefined ? '' : `use:\n${document.use}`;
  const extra = document.extra ?? '';
  return `document:\n  dsl: '${dsl}'\n  namespace: ${namespace}\n  name: defective\n  version: '1.0.0'\n${use}do:\n${document.tasks}${extra}`;
}

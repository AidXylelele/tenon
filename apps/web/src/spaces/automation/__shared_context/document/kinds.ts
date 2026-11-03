import type { Specification } from '@openworkflowspec/sdk';
import type { JsonObject } from '@/libs/data-access/types';
import type { TaskKind } from './tasks';

// What each kind of task is called, what it does in plain words, and the task a builder adds
// for it. Every template is a document the platform's check accepts, and conforms to the
// standard's own model: the official SDK's types check it at build time (research R9). Only
// types are imported, so nothing of the SDK reaches the browser.

export interface KindInfo {
  readonly kind: TaskKind;
  readonly label: string;
  readonly description: string;
  readonly stem: string;
  readonly group: 'Work' | 'Events' | 'Flow';
  readonly template: () => Specification.Task;
}

export const RAISE_TYPES = [
  'runtime',
  'validation',
  'expression',
  'communication',
  'timeout',
  'authentication',
  'authorization',
  'configuration',
] as const;

export const ERROR_TYPE_BASE =
  'https://serverlessworkflow.io/spec/1.0.0/errors/';

export const KINDS: readonly KindInfo[] = [
  {
    kind: 'http',
    label: 'Call a URL',
    description: 'Send an HTTP request and keep the answer.',
    stem: 'callApi',
    group: 'Work',
    template: () =>
      ({
        call: 'http',
        with: { method: 'get', endpoint: 'https://example.com' },
      }) satisfies Specification.CallHTTP,
  },
  {
    kind: 'set',
    label: 'Set data',
    description: 'Shape the data the next steps get.',
    stem: 'setData',
    group: 'Work',
    template: () =>
      ({ set: { message: 'Hello' } }) satisfies Specification.SetTask,
  },
  {
    kind: 'run-script',
    label: 'Run a script',
    description: 'Run JavaScript or Python in the sandbox.',
    stem: 'runScript',
    group: 'Work',
    template: () =>
      ({
        run: { script: { language: 'js', code: 'console.log("hello")' } },
      }) satisfies Specification.RunTask,
  },
  {
    kind: 'run-shell',
    label: 'Run a command',
    description: 'Run a shell command in the sandbox.',
    stem: 'runCommand',
    group: 'Work',
    template: () =>
      ({
        run: { shell: { command: 'echo hello' } },
      }) satisfies Specification.RunTask,
  },
  {
    kind: 'run-workflow',
    label: 'Run a workflow',
    description: 'Start another workflow and wait for its output.',
    stem: 'runWorkflow',
    group: 'Work',
    template: () =>
      ({
        run: {
          workflow: { namespace: 'default', name: 'other', version: 'latest' },
        },
      }) satisfies Specification.RunTask,
  },
  {
    kind: 'emit',
    label: 'Send an event',
    description: 'Publish a CloudEvent to subscribers and listeners.',
    stem: 'sendEvent',
    group: 'Events',
    template: () =>
      ({
        emit: {
          event: {
            with: {
              source: 'https://workflows.example.com',
              type: 'com.example.happened',
            },
          },
        },
      }) satisfies Specification.EmitTask,
  },
  {
    kind: 'listen',
    label: 'Wait for an event',
    description: 'Pause until an event of a type arrives.',
    stem: 'waitForEvent',
    group: 'Events',
    template: () =>
      ({
        listen: { to: { one: { with: { type: 'com.example.approved' } } } },
      }) satisfies Specification.ListenTask,
  },
  {
    kind: 'wait',
    label: 'Wait',
    description: 'Pause for a while.',
    stem: 'pause',
    group: 'Flow',
    template: () => ({ wait: { minutes: 1 } }) satisfies Specification.WaitTask,
  },
  {
    kind: 'switch',
    label: 'Choose a path',
    description: 'Go one way or another depending on the data.',
    stem: 'choose',
    group: 'Flow',
    template: () => {
      const cases: Specification.SwitchTask['switch'] = [
        { matched: { when: '${ . != null }', then: 'continue' } },
        { otherwise: { then: 'continue' } },
      ];
      return { switch: cases } satisfies Specification.SwitchTask;
    },
  },
  {
    kind: 'for',
    label: 'Repeat for each item',
    description: 'Run steps once for every item of a list.',
    stem: 'forEach',
    group: 'Flow',
    template: () =>
      ({
        for: { each: 'item', in: '${ .items }' },
        do: [{ keepItem: { set: { item: '${ $item }' } } }],
      }) satisfies Specification.ForTask,
  },
  {
    kind: 'fork',
    label: 'Run side by side',
    description: 'Run branches at the same time.',
    stem: 'inParallel',
    group: 'Flow',
    template: () => {
      const branches: Specification.TaskList = [
        { first: { set: { first: true } } },
        { second: { set: { second: true } } },
      ];
      return {
        fork: { compete: false, branches },
      } satisfies Specification.ForkTask;
    },
  },
  {
    kind: 'try',
    label: 'Handle failures',
    description: 'Retry or recover when steps fail.',
    stem: 'tryIt',
    group: 'Flow',
    template: () =>
      ({
        try: [{ attempt: { set: { attempted: true } } }],
        catch: {
          errors: { with: { type: `${ERROR_TYPE_BASE}communication` } },
        },
      }) satisfies Specification.TryTask,
  },
  {
    kind: 'do',
    label: 'Group steps',
    description: 'Keep steps together under one name.',
    stem: 'group',
    group: 'Flow',
    template: () =>
      ({
        do: [{ step: { set: { done: true } } }],
      }) satisfies Specification.DoTask,
  },
  {
    kind: 'raise',
    label: 'Stop with an error',
    description: 'End the run as failed, with a reason.',
    stem: 'fail',
    group: 'Flow',
    template: () =>
      ({
        raise: {
          error: {
            type: `${ERROR_TYPE_BASE}runtime`,
            status: 500,
            title: 'Stopped on purpose',
          },
        },
      }) satisfies Specification.RaiseTask,
  },
];

const ADVANCED: KindInfo = {
  kind: 'advanced',
  label: 'Advanced',
  description: 'A construct edited as code.',
  stem: 'task',
  group: 'Work',
  template: () => ({ set: {} }),
};

export function infoOf(kind: TaskKind): KindInfo {
  return KINDS.find((info) => info.kind === kind) ?? ADVANCED;
}

// The task a builder adds for a kind, as the plain JSON the draft holds.
export function newTask(kind: TaskKind): JsonObject {
  const task = infoOf(kind).template();
  return JSON.parse(JSON.stringify(task)) as JsonObject;
}

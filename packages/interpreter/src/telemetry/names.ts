export const spanNames = {
  compile: "interpreter.compile",
  analyze: "interpreter.analyze",
  translate: "interpreter.translate",
  start: "interpreter.start",
  correlate: "interpreter.correlate",
  respond: "interpreter.respond",
  suspend: "interpreter.suspend",
  resume: "interpreter.resume",
  cancel: "interpreter.cancel",
} as const;

export const metricNames = {
  compileDuration: "interpreter.compile.duration",
  stepDuration: "interpreter.step.duration",
  stepTransitions: "interpreter.step.transitions",
  runDuration: "interpreter.run.duration",
} as const;

export const attributeKeys = {
  compileSubject: "interpreter.compile.subject",
  compilePhase: "interpreter.compile.phase",
  compileOutcome: "interpreter.compile.outcome",
  operation: "interpreter.operation",
  workflowNamespace: "interpreter.workflow.namespace",
  workflowName: "interpreter.workflow.name",
  workflowVersion: "interpreter.workflow.version",
  instance: "interpreter.instance.id",
  runStatus: "interpreter.run.status",
  transitions: "interpreter.transitions",
  fibers: "interpreter.fibers",
  effectsRequested: "interpreter.effects.requested",
  events: "interpreter.events",
  errorType: "error.type",
} as const;

export const callBuckets = [
  0.0001, 0.00025, 0.0005, 0.001, 0.0025, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25,
  0.5, 1, 2.5, 5, 10,
];

export const transitionBuckets = [
  1, 10, 50, 100, 500, 1_000, 5_000, 10_000, 50_000, 100_000,
];

export const lifetimeBuckets = [
  0.1, 1, 5, 15, 60, 300, 900, 3_600, 21_600, 86_400, 604_800,
];

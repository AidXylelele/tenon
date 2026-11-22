export const runtimeArguments = Object.freeze([
  "context",
  "input",
  "output",
  "secrets",
  "authorization",
  "task",
  "workflow",
  "runtime",
] as const);
export type RuntimeArgument = (typeof runtimeArguments)[number];

const argumentAvailability = {
  workflowInputFrom: Object.freeze(["secrets", "workflow", "runtime"] as const),
  taskIf: Object.freeze([
    "context",
    "secrets",
    "task",
    "workflow",
    "runtime",
  ] as const),
  taskInputFrom: Object.freeze([
    "context",
    "secrets",
    "task",
    "workflow",
    "runtime",
  ] as const),
  taskDefinition: Object.freeze([
    "context",
    "input",
    "secrets",
    "task",
    "workflow",
    "runtime",
  ] as const),
  taskOutputAs: Object.freeze([
    "context",
    "input",
    "secrets",
    "task",
    "workflow",
    "runtime",
    "authorization",
  ] as const),
  taskExportAs: Object.freeze([
    "context",
    "input",
    "output",
    "secrets",
    "task",
    "workflow",
    "runtime",
    "authorization",
  ] as const),
  workflowOutputAs: Object.freeze([
    "context",
    "secrets",
    "workflow",
    "runtime",
  ] as const),
} as const satisfies Readonly<Record<string, readonly RuntimeArgument[]>>;

type EvaluationPoint = keyof typeof argumentAvailability;

const derivedArgumentAvailability = {
  workflowTimeout: Object.freeze(["secrets", "workflow", "runtime"] as const),
  eventTrigger: Object.freeze([] as const),
  schedule: Object.freeze([] as const),
} as const satisfies Readonly<Record<string, readonly RuntimeArgument[]>>;

type DerivedPoint = keyof typeof derivedArgumentAvailability;

export type Point = EvaluationPoint | DerivedPoint;

const availability: Readonly<Record<Point, readonly RuntimeArgument[]>> = {
  ...argumentAvailability,
  ...derivedArgumentAvailability,
};

export function argumentsAt(point: Point): readonly RuntimeArgument[] {
  return availability[point];
}

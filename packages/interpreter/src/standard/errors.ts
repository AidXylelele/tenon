const standardErrors = {
  configuration: { status: 400, title: "Configuration Error" },
  validation: { status: 400, title: "Validation Error" },
  expression: { status: 400, title: "Expression Error" },
  authentication: { status: 401, title: "Authentication Error" },
  authorization: { status: 403, title: "Authorization Error" },
  timeout: { status: 408, title: "Timeout" },
  communication: { status: 500, title: "Communication Error" },
  runtime: { status: 500, title: "Runtime Error" },
} as const;
export type StandardErrorName = keyof typeof standardErrors;

const errorTypeBase =
  "https://open-workflow-specification.org/spec/1.0.0/errors";

export function standardErrorOf(name: StandardErrorName): {
  readonly type: string;
  readonly status: number;
  readonly title: string;
} {
  const { status, title } = standardErrors[name];
  return { type: `${errorTypeBase}/${name}`, status, title };
}

export const errorProperties = [
  "type",
  "status",
  "instance",
  "title",
  "detail",
] as const;
export type ErrorProperty = (typeof errorProperties)[number];

export const textErrorProperties = [
  "type",
  "instance",
  "title",
  "detail",
] as const satisfies readonly ErrorProperty[];

export const instanceProperty = "instance" satisfies ErrorProperty;

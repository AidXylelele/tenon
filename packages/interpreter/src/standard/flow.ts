export const flowDirectives = Object.freeze([
  "continue",
  "exit",
  "end",
] as const);
export type FlowDirective = (typeof flowDirectives)[number];

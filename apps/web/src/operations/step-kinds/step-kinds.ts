import {
  type StepFamily,
  stepFamilies,
  type StepVariant,
} from "language-server/protocol";
import type { FamilyInfo, KindInfo, KindWords, StepKind } from "./interfaces";

const KIND_WORDS: Readonly<Record<StepKind, KindWords>> = {
  call: {
    label: "Call a service",
    description: "HTTP, OpenAPI, gRPC, AsyncAPI, MCP or A2A.",
  },
  run: {
    label: "Run a script or workflow",
    description: "A script, a shell command, a container or another workflow.",
  },
  set: {
    label: "Set data",
    description: "Write values into the workflow's data.",
  },
  emit: {
    label: "Emit an event",
    description: "Publish a CloudEvent.",
  },
  listen: {
    label: "Wait for events",
    description: "Pause until the events arrive.",
  },
  wait: {
    label: "Wait",
    description: "Pause for a while.",
  },
  switch: {
    label: "Choose a path",
    description: "Go one way or another by a condition.",
  },
  for: {
    label: "Repeat for each item",
    description: "Run tasks for every item of a list.",
  },
  fork: {
    label: "Run branches at once",
    description: "Run several branches side by side.",
  },
  try: {
    label: "Try and handle failure",
    description: "Run tasks and decide what happens when they fail.",
  },
  do: {
    label: "Group tasks",
    description: "Run tasks in sequence as one block.",
  },
  raise: {
    label: "Raise an error",
    description: "End the run with an error.",
  },
};

const STARTING_VARIANTS: Readonly<Record<StepKind, StepVariant>> = {
  call: "http",
  run: "shell",
  set: "set",
  emit: "emit",
  listen: "listen",
  wait: "wait",
  switch: "switch",
  for: "for",
  fork: "fork",
  try: "try",
  do: "do",
  raise: "raise",
};

const FAMILY_WORDS: Readonly<Record<StepFamily, string>> = {
  call: "Call a service",
  data: "Set data",
  event: "Send or wait for events",
  time: "Wait",
  flow: "Shape the flow",
  error: "Raise an error",
};

export function kindInfoOf(kind: StepKind): KindInfo {
  const words = KIND_WORDS[kind];
  return { kind, label: words.label, description: words.description };
}

export function startingVariantOf(kind: StepKind): StepVariant {
  return STARTING_VARIANTS[kind];
}

export function familiesOfKinds(
  variants: readonly StepVariant[],
): readonly FamilyInfo[] {
  const kinds = Object.keys(KIND_WORDS).filter(isKind);
  const offered = kinds.filter((kind) =>
    variants.includes(STARTING_VARIANTS[kind]),
  );
  const families = Object.keys(FAMILY_WORDS).filter(isFamily);
  const listed = families.map((family) => {
    const held = offered.filter((kind) => stepFamilies[kind] === family);
    return { family, label: FAMILY_WORDS[family], kinds: held.map(kindInfoOf) };
  });
  return listed.filter((family) => family.kinds.length > 0);
}

function isKind(key: string): key is StepKind {
  return key in KIND_WORDS;
}

function isFamily(key: string): key is StepFamily {
  return key in FAMILY_WORDS;
}

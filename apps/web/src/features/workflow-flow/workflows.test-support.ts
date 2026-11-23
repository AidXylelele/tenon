import {
  type NestedList,
  type Step,
  stepFamilies,
  type StepList,
  type Transition,
  type Trigger,
  type WorkflowStructure,
} from "language-server/protocol";
import type { StepRun } from "./interfaces";

type Kind = Step["kind"];

type Part = NestedList["part"];

export function next(to: string | null): Transition {
  return {
    condition: null,
    on: "done",
    case: null,
    when: null,
    kind: "next",
    to,
  };
}

export function goTo(to: string | null): Transition {
  return {
    condition: null,
    on: "done",
    case: null,
    when: null,
    kind: "jump",
    to,
  };
}

export function ends(): Transition {
  return {
    condition: null,
    on: "done",
    case: null,
    when: null,
    kind: "end",
    to: null,
  };
}

export function leaves(): Transition {
  return {
    condition: null,
    on: "done",
    case: null,
    when: null,
    kind: "exit",
    to: null,
  };
}

export function whenCase(
  name: string,
  when: string | null,
  then: Transition,
): Transition {
  return { ...then, on: "case", case: name, when };
}

export function caught(then: Transition): Transition {
  return { ...then, on: "caught" };
}

export function stepAt(
  id: string,
  kind: Kind,
  summary: string | null,
  flow: readonly Transition[],
  lists: readonly NestedList[] = [],
): Step {
  const name = id.split("/").at(-1) ?? id;
  const family = stepFamilies[kind];

  return {
    variant: null,
    catch: null,
    id,
    pointer: id,
    name,
    kind,
    family,
    summary,
    milliseconds: null,
    note: null,
    range: null,
    selectionRange: null,
    lists,
    flow,
  };
}

export function listAt(
  id: string,
  part: Part,
  steps: readonly Step[],
): NestedList {
  const role = part === "branches" ? "branches" : "sequence";

  return { id, pointer: id, role, part, steps };
}

export function stepNamed(list: StepList, name: string): Step {
  const found = list.steps.find((step) => step.name === name);

  if (found === undefined) throw new Error(`No step named ${name}.`);

  return found;
}

export function workflowOf(
  title: string,
  steps: readonly Step[],
  triggers: readonly Trigger[] = [],
): WorkflowStructure {
  const list = { id: "/do", pointer: "/do", role: "sequence", steps } as const;

  return {
    namespace: "default",
    name: title.toLowerCase().replaceAll(" ", "-"),
    title,
    triggers,
    steps: list,
  };
}

export const DAILY: Trigger = {
  kind: "cron",
  pointer: "/schedule/cron",
  summary: "0 9 * * *",
  milliseconds: null,
};

export const ON_EVENT: Trigger = {
  kind: "on",
  pointer: "/schedule/on",
  summary: "com.acme.order.paid",
  milliseconds: null,
};

export const EVERY_HOUR: Trigger = {
  kind: "every",
  pointer: "/schedule/every",
  summary: "PT1H",
  milliseconds: 3_600_000,
};

const FETCH = "/do/Fetch the digest";
const HAS_ITEMS = "/do/Has items?";
const POST = "/do/Post the items";

export const DAILY_DIGEST = workflowOf(
  "Daily digest",
  [
    stepAt(FETCH, "call", "GET https://httpbin.org/json", [next(HAS_ITEMS)]),
    stepAt(HAS_ITEMS, "switch", "2 cases", [
      whenCase(
        "If the answer has items",
        "${ .slideshow.slides | length > 0 }",
        next(POST),
      ),
      whenCase("Otherwise", null, ends()),
      next(POST),
    ]),
    stepAt(POST, "call", "POST https://httpbin.org/post", [next(null)]),
  ],
  [DAILY],
);

const PAUSE = "/do/Pause before the next digest";

export const DRAFT_DIGEST = workflowOf(
  "Daily digest",
  [
    stepAt(FETCH, "call", "GET https://httpbin.org/json", [next(HAS_ITEMS)]),
    stepAt(HAS_ITEMS, "switch", "2 cases", [
      whenCase(
        "If the answer has items",
        "${ .slideshow.slides | length > 0 }",
        next(POST),
      ),
      whenCase("Otherwise", null, ends()),
      next(POST),
    ]),
    stepAt(POST, "call", "POST", [next(PAUSE)]),
    stepAt(PAUSE, "wait", null, [next(null)]),
  ],
  [DAILY],
);

const READ = "/do/Read the order";
const WHICH = "/do/Which kind?";
const LICENCE = "/do/Send the licence";
const BOOK = "/do/Book the courier";
const BOOKED = "/do/Booked?";
const TELL = "/do/Tell the customer";
const WAIT = "/do/Wait a minute";

export const ORDER_ROUTER = workflowOf(
  "Order router",
  [
    stepAt(READ, "set", "order", [next(WHICH)]),
    stepAt(WHICH, "switch", "3 cases", [
      whenCase("A licence", '${ .kind == "licence" }', goTo(LICENCE)),
      whenCase("A parcel", '${ .kind == "parcel" }', goTo(BOOK)),
      whenCase("Otherwise", null, ends()),
      next(LICENCE),
    ]),
    stepAt(LICENCE, "call", "POST https://httpbin.org/anything/licence", [
      ends(),
    ]),
    stepAt(BOOK, "call", "POST https://httpbin.org/anything/courier", [
      next(BOOKED),
    ]),
    stepAt(BOOKED, "switch", "1 case", [
      whenCase("Not yet", '${ .status != "booked" }', goTo(WAIT)),
      next(TELL),
    ]),
    stepAt(TELL, "call", "POST https://httpbin.org/anything/tell", [ends()]),
    { ...stepAt(WAIT, "wait", "PT1M", [goTo(BOOK)]), milliseconds: 60_000 },
  ],
  [ON_EVENT],
);

const PREPARE = "/do/Prepare the batch";
const EACH = "/do/For each invoice";
const FINANCE = "/do/Tell finance";
const BRANCHES = `${FINANCE}/fork/branches`;
const ARCHIVE = "/do/Archive the batch";

export const MONTH_END = workflowOf("Month-end billing", [
  stepAt(
    PREPARE,
    "do",
    null,
    [next(EACH)],
    [
      listAt(`${PREPARE}/do`, "do", [
        stepAt(
          `${PREPARE}/do/Fetch the invoices`,
          "call",
          "GET https://httpbin.org/anything/invoices",
          [next(`${PREPARE}/do/Add up the totals`)],
        ),
        stepAt(`${PREPARE}/do/Add up the totals`, "set", "total", [next(null)]),
      ]),
    ],
  ),
  stepAt(
    EACH,
    "for",
    "invoice in ${ .invoices }",
    [next(FINANCE)],
    [
      listAt(`${EACH}/do`, "for", [
        stepAt(
          `${EACH}/do/Send the invoice`,
          "call",
          "POST https://httpbin.org/anything/invoices",
          [next(null)],
        ),
      ]),
    ],
  ),
  stepAt(
    FINANCE,
    "fork",
    "2 branches",
    [next(ARCHIVE)],
    [
      listAt(BRANCHES, "branches", [
        stepAt(
          `${BRANCHES}/Email`,
          "do",
          null,
          [next(`${BRANCHES}/Chat`)],
          [
            listAt(`${BRANCHES}/Email/do`, "do", [
              stepAt(
                `${BRANCHES}/Email/do/Email the summary`,
                "call",
                "POST https://httpbin.org/anything/email",
                [next(null)],
              ),
            ]),
          ],
        ),
        stepAt(
          `${BRANCHES}/Chat`,
          "do",
          null,
          [next(null)],
          [
            listAt(`${BRANCHES}/Chat/do`, "do", [
              stepAt(
                `${BRANCHES}/Chat/do/Post to the channel`,
                "call",
                "POST https://httpbin.org/anything/chat",
                [next(null)],
              ),
            ]),
          ],
        ),
      ]),
    ],
  ),
  stepAt(
    ARCHIVE,
    "try",
    null,
    [next(null)],
    [
      listAt(`${ARCHIVE}/try`, "try", [
        stepAt(
          `${ARCHIVE}/try/Upload the archive`,
          "call",
          "PUT https://httpbin.org/anything/archive",
          [next(null)],
        ),
      ]),
      listAt(`${ARCHIVE}/catch/do`, "catch", [
        stepAt(`${ARCHIVE}/catch/do/Mark as not archived`, "set", "archived", [
          next(null),
        ]),
      ]),
    ],
  ),
]);

const ORDERS = "/do/Fetch the orders";
const EACH_ORDER = "/do/For each order";

export const EMPTY_REPEAT = workflowOf("Order export", [
  stepAt(ORDERS, "call", "GET https://httpbin.org/anything/orders", [
    next(EACH_ORDER),
  ]),
  stepAt(
    EACH_ORDER,
    "for",
    "order",
    [next(null)],
    [listAt(`${EACH_ORDER}/do`, "for", [])],
  ),
]);

export const NEW_WORKFLOW = workflowOf("New workflow", []);

const CHECKS = "/do/Check every region";
const REGIONS = `${CHECKS}/fork/branches`;
const REGION_NAMES = ["Europe", "Americas", "Asia", "Africa"];

function regionOf(region: string): Step {
  const branch = `${REGIONS}/${region}`;
  const check = `${branch}/do/Ping ${region}`;
  const url = `GET https://httpbin.org/anything/${region.toLowerCase()}`;

  return stepAt(
    branch,
    "do",
    null,
    [next(null)],
    [listAt(`${branch}/do`, "do", [stepAt(check, "call", url, [next(null)])])],
  );
}

export const PARALLEL_CHECKS = workflowOf(
  "Parallel checks",
  [
    stepAt(
      CHECKS,
      "fork",
      "4 branches",
      [next(null)],
      [listAt(REGIONS, "branches", REGION_NAMES.map(regionOf))],
    ),
  ],
  [EVERY_HOUR],
);

export function ranFor(
  detail: string | null,
  status: StepRun["status"] = "completed",
): StepRun {
  return { status, detail };
}

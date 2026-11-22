import type { CloudEvent } from "../../api/index.js";
import {
  type AttributeTest,
  type FilterTemplate,
  attributeVerdictOf,
} from "../../core/index.js";
import { type Attribute, attributeOf } from "../../runtime/index.js";
import type { ReceiveK } from "../frames/index.js";
import type { Here } from "../registers/index.js";
import { holds } from "../values/index.js";
import type { View } from "../view.js";
import { correlatedOf } from "./correlation.js";
import {
  type Correlating,
  type Match,
  type Standing,
  refused,
} from "./types.js";

export interface Matcher {
  accepts(filter: FilterTemplate, event: CloudEvent): Match;
}

export function matcherOf(frame: ReceiveK, view: View): Matcher {
  const standing: Standing = { frame, view };

  return {
    accepts: (filter, event) => {
      const correlating: Correlating = { event, filter };
      return matchOf(correlating, standing);
    },
  };
}

function matchOf(correlating: Correlating, standing: Standing): Match {
  const event = correlating.event;

  for (const [name, test] of correlating.filter.with) {
    const attribute = attributeOf(event, name);
    const matched = isAttributeMatch(attribute, test, standing);

    if (!matched) {
      return refused;
    }
  }

  return correlatedOf(correlating, standing);
}

function isAttributeMatch(
  attribute: Attribute,
  test: AttributeTest,
  standing: Standing,
): boolean {
  const patterns = standing.view.program.patterns;
  const verdict = attributeVerdictOf(attribute, test, patterns);

  switch (verdict.kind) {
    case "held":
      return true;
    case "failed":
      return false;
    case "conditional": {
      const here: Here = { scope: standing.frame.scope, value: verdict.value };
      const conditions = [verdict.condition];
      return holds(conditions, here, standing.view);
    }
  }
}

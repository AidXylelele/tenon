import type {
  Position,
  Range,
  RangeLocator,
  SourceDocument,
} from "interpreter/front-end";
import {
  bindingNounOf,
  type Variable,
  variableAt,
} from "../expressions/index.js";
import {
  type ComponentKind,
  componentNounOf,
  declarationOf,
  holderDescriptionOf,
  placeAt,
  type Reading,
  readingOf,
  type SchemasAt,
  type Semantics,
} from "../places/index.js";
import type { Snapshot } from "../snapshot/index.js";
import { type StepNode, targetOf } from "../steps/index.js";
import { dedentedOf, textIn } from "../text/index.js";
import type {
  ComponentPlace,
  HoverInfo,
  MemberPlace,
  ReferencePlace,
} from "./interfaces.js";

const backtickRuns = /`+/g;

export function hoverAt(
  snapshot: Snapshot,
  position: Position,
  schemasAt: SchemasAt,
): HoverInfo | null {
  const reading = readingOf(snapshot);
  const { source, semantics } = reading;
  const positions = source?.positions ?? null;

  if (source === null || positions === null) {
    return null;
  }

  const place = placeAt(reading, position);

  switch (place.kind) {
    case "member": {
      const variable =
        place.part === "value"
          ? variableAt(reading, place.pointer, position)
          : null;
      return variable === null
        ? memberHoverOf(place, source, schemasAt)
        : variableHoverOf(variable);
    }
    case "reference":
      return referenceHoverOf(place, reading, positions);
    case "component":
      return componentHoverOf(place, positions);
    case "label":
      return labelHoverOf(place.directive, semantics, positions);
    case "stepName":
      return stepNameHoverOf(place.step, semantics, positions);
    case "nothing":
      return null;
  }
}

function variableHoverOf(variable: Variable): HoverInfo | null {
  const binding = variable.resolution.scope.get(variable.name);

  if (binding === undefined) {
    return null;
  }

  const noun = bindingNounOf(binding);
  const name = codeSpanOf("$" + variable.name);
  return { range: variable.range, markdown: `**${noun}** ${name}` };
}

function memberHoverOf(
  place: MemberPlace,
  source: SourceDocument,
  schemasAt: SchemasAt,
): HoverInfo | null {
  const own = schemasAt(source.document, place.pointer);
  const parent = schemasAt(source.document, place.object);
  const members = parent.flatMap((entry) => entry.members);
  const listed = members.find((member) => member.name === place.name);
  const descriptions = own.map((entry) => entry.description);
  const ownDescription = descriptions.find((text) => text !== null);
  const written = ownDescription ?? listed?.description ?? null;
  const description =
    written ?? holderDescriptionOf(source.document, place.pointer, schemasAt);
  const range = memberRangeOf(place, source.positions);

  if (description === null || range === null) {
    return null;
  }

  const title =
    listed === undefined ? codeSpanOf(place.name) : `**${place.name}**`;
  return { range, markdown: `${title}\n\n${description}` };
}

function memberRangeOf(
  place: MemberPlace,
  positions: RangeLocator | null,
): Range | null {
  switch (place.part) {
    case "key":
      return positions?.keyRangeOf(place.pointer) ?? null;
    case "value":
      return positions?.rangeOf(place.pointer) ?? null;
  }
}

function referenceHoverOf(
  place: ReferencePlace,
  reading: Reading,
  positions: RangeLocator,
): HoverInfo | null {
  const range = positions.rangeOf(place.pointer);
  const model = reading.semantics?.model ?? null;

  if (range === null || model === null) {
    return null;
  }

  const title = componentTitleOf(place.table, place.name);
  const declaration = declarationOf(model, place.table, place.name);
  const declared = declarationTextOf(declaration, reading.text, positions);

  if (declared === null) {
    return { range, markdown: title };
  }

  const block = fencedYamlOf(declared);
  return { range, markdown: `${title}\n\n${block}` };
}

function declarationTextOf(
  declaration: string | null,
  text: string,
  positions: RangeLocator,
): string | null {
  const range =
    declaration === null ? null : positions.itemRangeOf(declaration);

  if (range === null) {
    return null;
  }

  const written = textIn(text, range);
  const indent = range.start.column - 1;
  return dedentedOf(written, indent);
}

function componentHoverOf(
  place: ComponentPlace,
  positions: RangeLocator,
): HoverInfo | null {
  const keyRange = positions.keyRangeOf(place.declaration);
  const range = keyRange ?? positions.rangeOf(place.declaration);

  if (range === null) {
    return null;
  }

  const markdown = componentTitleOf(place.table, place.name);
  return { range, markdown };
}

function labelHoverOf(
  directive: string,
  semantics: Semantics | null,
  positions: RangeLocator,
): HoverInfo | null {
  const range = positions.rangeOf(directive);

  if (range === null || semantics === null) {
    return null;
  }

  const { model, tree } = semantics;
  const target = targetOf(tree, model.symbols.jumps, directive);

  if (target === null) {
    return null;
  }

  const markdown = stepTitleOf(target);
  return { range, markdown };
}

function stepNameHoverOf(
  step: string,
  semantics: Semantics | null,
  positions: RangeLocator,
): HoverInfo | null {
  const range = positions.keyRangeOf(step);

  if (range === null || semantics === null) {
    return null;
  }

  const node = semantics.tree.steps.get(step);

  if (node === undefined) {
    return null;
  }

  const markdown = stepTitleOf(node);
  return { range, markdown };
}

function stepTitleOf(step: StepNode): string {
  const name = codeSpanOf(step.name);

  return `**${step.task.kind}** ${name}`;
}

function componentTitleOf(table: ComponentKind, name: string): string {
  const kind = componentNounOf(table);
  const code = codeSpanOf(name);

  return `**${kind}** ${code}`;
}

function codeSpanOf(text: string): string {
  const longest = longestBacktickRunOf(text);
  const width = longest + 1;
  const fence = "`".repeat(width);
  const isPadded = text.startsWith("`") || text.endsWith("`");
  const content = isPadded ? ` ${text} ` : text;

  return `${fence}${content}${fence}`;
}

function fencedYamlOf(text: string): string {
  const longest = longestBacktickRunOf(text);
  const beyond = longest + 1;
  const width = Math.max(3, beyond);
  const fence = "`".repeat(width);

  return `${fence}yaml\n${text}\n${fence}`;
}

function longestBacktickRunOf(text: string): number {
  const runs = [...text.matchAll(backtickRuns)];
  const lengths = runs.map((run) => run[0].length);

  return Math.max(0, ...lengths);
}

import {
  EditorState,
  type Extension,
  StateEffect,
  StateField,
} from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView } from "@codemirror/view";
import type { TemplatePart } from "language-server/protocol";
import { ChipWidget } from "./chip-widget";

type DataPart = Extract<TemplatePart, { readonly kind: "data" }>;

interface PlacedPart {
  readonly at: number;
  readonly part: DataPart;
}

interface PlacedChip {
  readonly at: number;
  readonly part: DataPart;
  readonly words: string;
}

type WordsOfPart = (part: DataPart) => string;

const CHIP_MARK = "￼";

const chipAdded = StateEffect.define<PlacedChip>();

export function templateDocOf(parts: readonly TemplatePart[]): string {
  return parts
    .map((part) => (part.kind === "text" ? part.text : CHIP_MARK))
    .join("");
}

const chips = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update: (value, transaction) => {
    const mapped = value.map(transaction.changes);
    const added = transaction.effects.flatMap((effect) =>
      effect.is(chipAdded) ? [chipRangeOf(effect.value)] : [],
    );
    return mapped.update({ add: added, sort: true });
  },
  provide: (field) => [
    EditorView.decorations.from(field),
    EditorView.atomicRanges.of((view) => view.state.field(field)),
  ],
});

const oneLine = EditorState.transactionFilter.of((transaction) =>
  transaction.newDoc.lines > 1 ? [] : transaction,
);

export function templateEditing(
  parts: readonly TemplatePart[],
  wordsOf: WordsOfPart,
): Extension {
  const placed = chips.init(() => chipsOf(parts, wordsOf));
  return [placed, oneLine];
}

export function partsOfState(state: EditorState): TemplatePart[] {
  const text = state.doc.toString();
  const placed = placedPartsOf(state);
  const starts = [0, ...placed.map((chip) => chip.at + 1)];
  const parts = placed.flatMap((chip, index) => {
    const before = text.slice(starts[index], chip.at);
    return [...textPartOf(before), chip.part];
  });
  const rest = text.slice(starts.at(-1));
  return [...parts, ...textPartOf(rest)];
}

export function insertChip(
  view: EditorView,
  part: DataPart,
  words: string,
): void {
  const at = view.state.selection.main.head;
  const chip = { at, part, words };
  view.dispatch({
    changes: { from: at, insert: CHIP_MARK },
    selection: { anchor: at + 1 },
    effects: chipAdded.of(chip),
  });
}

function placedPartsOf(state: EditorState): PlacedPart[] {
  const placed = state.field(chips, false) ?? Decoration.none;
  const found: PlacedPart[] = [];
  placed.between(0, state.doc.length, (from, _to, value) => {
    const spec: unknown = value.spec;

    if (isChipSpec(spec)) found.push({ at: from, part: spec.part });
  });
  return found;
}

export function textPartOf(text: string): TemplatePart[] {
  return text === "" ? [] : [{ kind: "text", text }];
}

function isChipSpec(spec: unknown): spec is { readonly part: DataPart } {
  return typeof spec === "object" && spec !== null && "part" in spec;
}

function chipsOf(
  parts: readonly TemplatePart[],
  wordsOf: WordsOfPart,
): DecorationSet {
  const lengths = parts.map((part) =>
    part.kind === "text" ? part.text.length : CHIP_MARK.length,
  );
  const ranges = parts.flatMap((part, index) => {
    if (part.kind === "text") return [];

    const before = lengths.slice(0, index);
    const at = before.reduce((sum, length) => sum + length, 0);
    const words = wordsOf(part);
    const chip = chipRangeOf({ at, part, words });
    return [chip];
  });
  return Decoration.set(ranges, true);
}

function chipRangeOf(chip: PlacedChip) {
  const widget = new ChipWidget(chip.words);
  const decoration = Decoration.replace({ widget, part: chip.part });
  return decoration.range(chip.at, chip.at + 1);
}

import {
  CST,
  type Document,
  isAlias,
  isCollection,
  isMap,
  isNode,
  isPair,
  isScalar,
  isSeq,
  type LineCounter,
  type Node,
  type Pair,
  type Scalar,
  type YAMLSeq,
} from "yaml";
import type { Position, Range } from "../../api/index.js";
import { childPointerOf, rootPointer, tokensOf } from "../../runtime/index.js";
import type { PointerAt, RangeLocator } from "./types.js";

type Span = readonly [number, number];

interface Place {
  readonly pointer: string;
  readonly key: Scalar | null;
  readonly start: number;
  readonly node: Node | null;
}

export class Positions implements RangeLocator {
  readonly #document: Document.Parsed;
  readonly #lineCounter: LineCounter;

  constructor(document: Document.Parsed, lineCounter: LineCounter) {
    this.#document = document;
    this.#lineCounter = lineCounter;
  }

  rangeOf(pointer: string): Range {
    const tokens = tokensOf(pointer);
    const root = this.#rootPlace();
    const place = this.#deepestPlaceOf(root, tokens);

    return this.rangeOfNode(place.node);
  }

  pointerAt(position: Position): PointerAt | null {
    const offset = this.#offsetOf(position);

    if (offset === null) {
      return null;
    }

    const root = this.#rootPlace();
    return this.#pointerIn(root, offset);
  }

  keyRangeOf(pointer: string): Range | null {
    const place = this.#placeOf(pointer);

    if (place === null) {
      return null;
    }

    const { key } = place;

    if (key === null) {
      return null;
    }

    const span = this.#spanOf(place, key);
    return this.rangeOfSpan(span);
  }

  itemRangeOf(pointer: string): Range | null {
    const place = this.#placeOf(pointer);

    if (place === null) {
      return null;
    }

    const span = this.#spanOf(place, place.node);
    return this.rangeOfSpan(span);
  }

  rangeOfNode(node: Node | null): Range {
    const [start = 0, end = start] = node?.range ?? [];
    return this.rangeOfSpan([start, end]);
  }

  rangeOfSpan([start, end]: Span): Range {
    return { start: this.#positionOf(start), end: this.#positionOf(end) };
  }

  #placeOf(pointer: string): Place | null {
    const tokens = tokensOf(pointer);
    const root = this.#rootPlace();
    const place = this.#deepestPlaceOf(root, tokens);
    const isNamed = place.pointer === pointer;

    return isNamed ? place : null;
  }

  #rootPlace(): Place {
    const node = this.#document.contents;
    const [start = 0] = node?.range ?? [];

    return { pointer: rootPointer, key: null, start, node };
  }

  #deepestPlaceOf(place: Place, tokens: readonly string[]): Place {
    const [token] = tokens;

    if (token === undefined) {
      return place;
    }

    const child = this.#placeIn(place, token);

    if (child === null) {
      return place;
    }

    const rest = tokens.slice(1);
    return this.#deepestPlaceOf(child, rest);
  }

  #placeIn(parent: Place, token: string): Place | null {
    const node = this.#resolvedOf(parent.node);
    const isMapping = isMap(node);

    if (isMapping) {
      const pair = node.items.find(
        ({ key }) => isScalar(key) && String(key.value) === token,
      );

      if (pair === undefined) {
        return null;
      }

      return this.#memberPlaceOf(parent, pair);
    }

    const isSequence = isSeq(node);

    if (isSequence) {
      const index = Number(token);
      return this.#itemPlaceOf(parent, node, index);
    }

    return null;
  }

  #resolvedOf(node: Node | null): Node | null {
    const isAliased = isAlias(node);

    if (!isAliased) {
      return node;
    }

    return node.resolve(this.#document) ?? null;
  }

  #memberPlaceOf(parent: Place, { key, value }: Pair): Place | null {
    const isScalarKey = isScalar(key);

    if (!isScalarKey) {
      return null;
    }

    const name = String(key.value);
    const pointer = childPointerOf(parent.pointer, name);
    const [start = 0] = key.range ?? [];
    const isNodeValue = isNode(value);
    const node = isNodeValue ? value : key;

    return { pointer, key, start, node };
  }

  #itemPlaceOf(parent: Place, sequence: YAMLSeq, index: number): Place | null {
    const node = sequence.items[index];
    const isItemNode = isNode(node);

    if (!isItemNode) {
      return null;
    }

    const pointer = childPointerOf(parent.pointer, index);
    // `yaml` keeps a block item's `- ` only in its sequence's source token.
    const token = sequence.srcToken;
    const leading = this.#leadingTokensOf(token, index);
    const indicator = leading.find(({ type }) => type === "seq-item-ind");
    const [valueStart = 0] = node.range ?? [];
    const start = indicator?.offset ?? valueStart;

    return { pointer, key: null, start, node };
  }

  #leadingTokensOf(
    token: YAMLSeq["srcToken"],
    index: number,
  ): readonly CST.SourceToken[] {
    const isBlockSequence = token?.type === "block-seq";

    if (!isBlockSequence) {
      return [];
    }

    return token.items[index]?.start ?? [];
  }

  #pointerIn(place: Place, offset: number): PointerAt | null {
    const [start, end] = this.#spanOf(place, place.node);
    const isHeld = start <= offset && offset < end;

    if (!isHeld) {
      return null;
    }

    const [, keyEnd] = this.#spanOf(place, place.key);
    const isOnKey = offset < keyEnd;

    if (isOnKey) {
      return { pointer: place.pointer, part: "key" };
    }

    const children = this.#childPlacesOf(place);

    for (const child of children) {
      const inner = this.#pointerIn(child, offset);

      if (inner !== null) {
        return inner;
      }
    }

    return { pointer: place.pointer, part: "value" };
  }

  #childPlacesOf(parent: Place): readonly Place[] {
    const node = parent.node;
    const isMapping = isMap(node);

    if (isMapping) {
      const members = node.items.map((pair) =>
        this.#memberPlaceOf(parent, pair),
      );
      return members.filter((member) => member !== null);
    }

    const isSequence = isSeq(node);

    if (isSequence) {
      const items = node.items.map((_, index) =>
        this.#itemPlaceOf(parent, node, index),
      );
      return items.filter((item) => item !== null);
    }

    return [];
  }

  #spanOf(place: Place, node: Node | null): Span {
    if (node === null) {
      return [place.start, place.start];
    }

    const end = this.#endOf(node);
    return [place.start, end];
  }

  #endOf(node: Node): number {
    // `yaml` ends a block collection's and a block scalar's range at the next
    // line's start: the written text ends earlier.
    const token = node.srcToken;
    const [, valueEnd = 0] = node.range ?? [];

    if (token?.type === "block-scalar") {
      const text = CST.stringify(token);
      const trimmed = text.trimEnd();
      return token.offset + trimmed.length;
    }

    const isBlock = isCollection(node) && token?.type !== "flow-collection";

    if (!isBlock) {
      return valueEnd;
    }

    const last: unknown = node.items.at(-1);
    const isMember = isPair(last);
    const written: unknown = isMember ? (last.value ?? last.key) : last;
    const isWrittenNode = isNode(written);

    if (!isWrittenNode) {
      return valueEnd;
    }

    return this.#endOf(written);
  }

  #offsetOf(position: Position): number | null {
    const index = position.line - 1;
    const lineStart = this.#lineCounter.lineStarts[index];

    if (lineStart === undefined) {
      return null;
    }

    const offset = lineStart + position.column - 1;
    const { line } = this.#lineCounter.linePos(offset);
    const isOnLine = line === position.line;

    return isOnLine ? offset : null;
  }

  #positionOf(offset: number): Position {
    const { line, col } = this.#lineCounter.linePos(offset);
    return { line, column: col };
  }
}

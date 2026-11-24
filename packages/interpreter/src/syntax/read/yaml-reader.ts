import { Stack } from "immutable";
import {
  type Alias,
  type Document,
  isAlias,
  isMap,
  isNode,
  isScalar,
  type Node,
  type Pair,
  type Scalar,
  type YAMLMap,
  type YAMLSeq,
} from "yaml";
import type { JsonValue } from "../../api/index.js";
import { isJsonScalar } from "../../runtime/index.js";
import type { Finding } from "../findings.js";
import { depthLimit, tooDeepOf } from "./depth-limit.js";
import { syntaxFindingOf } from "./syntax-finding.js";

type NodeReading<Value = JsonValue> =
  | { readonly kind: "read"; readonly value: Value; readonly budget: number }
  | {
      readonly kind: "refused";
      readonly node: Node;
      readonly finding: Finding;
    };

interface Cursor {
  readonly depth: number;
  readonly budget: number;
  readonly ancestors: Stack<Node>;
}

type Member = readonly [string, JsonValue];

type ReaderRefusal =
  "expanding" | "selfAlias" | "complexKey" | "notJson" | "tooDeep";

export class YamlReader {
  readonly #document: Document.Parsed;

  constructor(document: Document.Parsed) {
    this.#document = document;
  }

  read(size: number): NodeReading {
    const readableNodes = size * 10 + 100;
    const ancestors = Stack<Node>();
    const cursor: Cursor = { depth: 1, budget: readableNodes, ancestors };

    return this.#readNode(this.#document.contents, cursor);
  }

  #readNode(node: unknown, cursor: Cursor): NodeReading {
    const isYamlNode = isNode(node);

    if (!isYamlNode) {
      return { kind: "read", value: null, budget: cursor.budget };
    }

    const budget = cursor.budget - 1;

    if (budget < 0) {
      return this.#refusalOf(node, "expanding");
    }

    const spent: Cursor = { ...cursor, budget };
    const isAliased = isAlias(node);

    if (isAliased) {
      return this.#readAlias(node, spent);
    }

    const isScalarNode = isScalar(node);

    if (isScalarNode) {
      return this.#readScalar(node, budget);
    }

    return this.#readCollection(node, spent);
  }

  #refusalOf(node: Node, name: ReaderRefusal): NodeReading<never> {
    const finding = name === "tooDeep" ? tooDeepOf() : this.#problemOf(name);
    return { kind: "refused", node, finding };
  }

  #problemOf(name: Exclude<ReaderRefusal, "tooDeep">): Finding {
    return syntaxFindingOf(name, []);
  }

  #readAlias(alias: Alias, cursor: Cursor): NodeReading {
    const target = alias.resolve(this.#document);

    if (target === undefined) {
      return this.#refusalOf(alias, "selfAlias");
    }

    const isAncestor = cursor.ancestors.includes(target);

    if (isAncestor) {
      return this.#refusalOf(alias, "selfAlias");
    }

    return this.#readNode(target, cursor);
  }

  #readScalar(scalar: Scalar, budget: number): NodeReading {
    const value: unknown = scalar.value;
    const isJsonScalarValue = isJsonScalar(value);

    if (isJsonScalarValue) {
      return { kind: "read", value, budget };
    }

    return this.#refusalOf(scalar, "notJson");
  }

  #readCollection(collection: YAMLMap | YAMLSeq, cursor: Cursor): NodeReading {
    if (cursor.depth > depthLimit) {
      return this.#refusalOf(collection, "tooDeep");
    }

    const ancestors = cursor.ancestors.push(collection);
    const depth = cursor.depth + 1;
    const inner: Cursor = { depth, budget: cursor.budget, ancestors };

    const isMapping = isMap(collection);

    if (isMapping) {
      return this.#readMap(collection, inner);
    }

    return this.#readSequence(collection, inner);
  }

  #readMap(map: YAMLMap, cursor: Cursor): NodeReading {
    const readMember = (read: NodeReading<Stack<Member>>, pair: Pair) => {
      if (read.kind === "refused") {
        return read;
      }

      const key = pair.key;
      const isScalarKey = isScalar(key);

      if (!isScalarKey) {
        const isKeyNode = isNode(key);
        const complex = isKeyNode ? key : map;

        return this.#refusalOf(complex, "complexKey");
      }

      const name = String(key.value);
      const reading = this.#readWithin(pair.value, read.budget, cursor);
      return this.#pushReading(read, reading, (value): Member => [name, value]);
    };

    const none = this.#emptyReadingOf<Member>(cursor);
    const members = map.items.reduce(readMember, none);

    return this.#collectionReadingOf(members, Object.fromEntries);
  }

  #readWithin(node: unknown, budget: number, cursor: Cursor): NodeReading {
    const within: Cursor = { ...cursor, budget };
    return this.#readNode(node, within);
  }

  #pushReading<Item>(
    read: Extract<NodeReading<Stack<Item>>, { readonly kind: "read" }>,
    child: NodeReading,
    itemOf: (value: JsonValue) => Item,
  ): NodeReading<Stack<Item>> {
    if (child.kind === "refused") {
      return child;
    }

    const item = itemOf(child.value);
    const value = read.value.push(item);
    return { kind: "read", value, budget: child.budget };
  }

  #emptyReadingOf<Item>(cursor: Cursor): NodeReading<Stack<Item>> {
    const value = Stack<Item>();
    return { kind: "read", value, budget: cursor.budget };
  }

  #collectionReadingOf<Item>(
    read: NodeReading<Stack<Item>>,
    collectionOf: (items: readonly Item[]) => JsonValue,
  ): NodeReading {
    if (read.kind === "refused") {
      return read;
    }

    const topFirst = read.value.toArray();
    const items = topFirst.toReversed();
    const value = collectionOf(items);
    return { kind: "read", value, budget: read.budget };
  }

  #readSequence(sequence: YAMLSeq, cursor: Cursor): NodeReading {
    const readItem = (read: NodeReading<Stack<JsonValue>>, node: unknown) => {
      if (read.kind === "refused") {
        return read;
      }

      const reading = this.#readWithin(node, read.budget, cursor);
      return this.#pushReading(read, reading, (value) => value);
    };

    const none = this.#emptyReadingOf<JsonValue>(cursor);
    const items = sequence.items.reduce(readItem, none);

    return this.#collectionReadingOf(items, (values) => values);
  }
}

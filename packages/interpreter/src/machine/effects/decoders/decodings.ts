import type { JsonValue } from "../../../api/index.js";
import type { Decoder } from "../../../core/index.js";
import type { Awaited } from "../../frames/index.js";

export interface DocumentDecoding {
  readonly kind: "document";
}

export interface ElapsedDecoding {
  readonly kind: "elapsed";
}

export type Decoding = Decoder | DocumentDecoding | ElapsedDecoding;

interface AwaitedDecoding {
  readonly decoding: Decoding;
  readonly carried: JsonValue;
}

const documentDecoding: DocumentDecoding = { kind: "document" };

const elapsedDecoding: ElapsedDecoding = { kind: "elapsed" };

const fetchedDocument: AwaitedDecoding = {
  decoding: documentDecoding,
  carried: null,
};

const elapsedTimer: AwaitedDecoding = {
  decoding: elapsedDecoding,
  carried: null,
};

export function awaitedDecodingOf(effect: Awaited): AwaitedDecoding {
  switch (effect.kind) {
    case "perform":
      return { decoding: effect.perform.decoder, carried: effect.carried };
    case "schema":
      return fetchedDocument;
    case "retry":
      return elapsedTimer;
  }
}

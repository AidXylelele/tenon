import { Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";
import type { WritePrecondition } from "../interfaces.js";

@Injectable()
export class EntityTagMapper {
  private static readonly ANY = "*";
  private static readonly STRONG = /^"([^"]*)"$/;
  private static readonly WEAK = /^W\//;
  private static readonly SEPARATOR = ",";
  private static readonly DIGEST = "sha256";

  fromRevision(revision: string): string {
    return `"${revision}"`;
  }

  digestOf(content: object): string {
    const bytes = JSON.stringify(content);
    const hash = createHash(EntityTagMapper.DIGEST).update(bytes);
    return hash.digest("base64url");
  }

  toWritePrecondition(
    ifMatch: string | undefined,
    ifNoneMatch: string | undefined,
  ): WritePrecondition {
    if (ifMatch !== undefined) return this.#matchOf(ifMatch.trim());

    if (ifNoneMatch?.trim() === EntityTagMapper.ANY) return { kind: "create" };

    return { kind: "required" };
  }

  isUnchanged(ifNoneMatch: string | undefined, revision: string): boolean {
    if (ifNoneMatch === undefined) return false;

    const tags = ifNoneMatch
      .split(EntityTagMapper.SEPARATOR)
      .map((tag) => tag.trim());
    return tags.some(
      (tag) => tag === EntityTagMapper.ANY || this.#opaqueOf(tag) === revision,
    );
  }

  #matchOf(tag: string): WritePrecondition {
    if (tag === EntityTagMapper.ANY) return { kind: "required" };

    const strong = EntityTagMapper.STRONG.exec(tag);
    const revision = strong?.[1] ?? tag;
    return { kind: "match", revision };
  }

  #opaqueOf(tag: string): string {
    const unweakened = tag.replace(EntityTagMapper.WEAK, "");
    const strong = EntityTagMapper.STRONG.exec(unweakened);
    return strong?.[1] ?? unweakened;
  }
}

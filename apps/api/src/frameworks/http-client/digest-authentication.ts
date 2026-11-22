import { createHash, randomBytes } from "node:crypto";
import { Injectable } from "@nestjs/common";
import type {
  DigestChallenge,
  PasswordCredentials,
  OutboundRequest,
} from "./interfaces.js";

const HASHES_STRONGEST_FIRST = new Map([
  ["SHA-512-256", "sha512-256"],
  ["SHA-256", "sha256"],
  ["MD5", "md5"],
]);

const NONCE_COUNT = "00000001";

@Injectable()
export class DigestAuthentication {
  answer(
    header: string | null,
    credentials: PasswordCredentials,
    request: OutboundRequest,
  ): string | null {
    const challenge = this.#strongestChallengeOf(header ?? "");

    if (challenge === null) return null;

    const realm = challenge.parameters.get("realm") ?? "";
    const nonce = challenge.parameters.get("nonce") ?? "";
    const qop = this.#qopOf(challenge);
    const cnonce = randomBytes(16).toString("hex");
    const uri = this.#uriOf(request);
    const secret = this.#secretOf(challenge, credentials, cnonce);
    const target = this.#targetOf(challenge, request, qop);
    const proof =
      qop === null
        ? `${secret}:${nonce}:${target}`
        : `${secret}:${nonce}:${NONCE_COUNT}:${cnonce}:${qop}:${target}`;
    const response = this.#hash(challenge, proof);
    const hashedUser =
      challenge.parameters.get("userhash")?.toLowerCase() === "true";
    const username = hashedUser
      ? this.#hash(challenge, `${credentials.username}:${realm}`)
      : credentials.username;
    const parts = [
      `username=${this.#quoted(username)}`,
      `realm=${this.#quoted(realm)}`,
      `uri=${this.#quoted(uri)}`,
      `algorithm=${challenge.algorithm}`,
      `nonce=${this.#quoted(nonce)}`,
      `response=${this.#quoted(response)}`,
    ];

    if (qop !== null)
      parts.push(
        `qop=${qop}`,
        `nc=${NONCE_COUNT}`,
        `cnonce=${this.#quoted(cnonce)}`,
      );

    const opaque = challenge.parameters.get("opaque");

    if (opaque !== undefined) parts.push(`opaque=${this.#quoted(opaque)}`);

    if (hashedUser) parts.push("userhash=true");

    return parts.join(", ");
  }

  #secretOf(
    challenge: DigestChallenge,
    credentials: PasswordCredentials,
    cnonce: string,
  ): string {
    const realm = challenge.parameters.get("realm") ?? "";
    const nonce = challenge.parameters.get("nonce") ?? "";
    const known = `${credentials.username}:${realm}:${credentials.password}`;
    const secret = this.#hash(challenge, known);

    if (!challenge.session) return secret;

    return this.#hash(challenge, `${secret}:${nonce}:${cnonce}`);
  }

  #targetOf(
    challenge: DigestChallenge,
    request: OutboundRequest,
    qop: string | null,
  ): string {
    const uri = this.#uriOf(request);
    const target = `${request.method}:${uri}`;

    if (qop !== "auth-int") return this.#hash(challenge, target);

    const entity = this.#hash(challenge, request.body ?? "");
    return this.#hash(challenge, `${target}:${entity}`);
  }

  #strongestChallengeOf(header: string): DigestChallenge | null {
    const ranked = Array.from(HASHES_STRONGEST_FIRST.keys());
    const offered = header.matchAll(
      /([A-Za-z][\w!#$%&'*+.^`|~-]*)\s+((?:[\w-]+\s*=\s*(?:"(?:[^"\\]|\\.)*"|[^\s,"]+)\s*(?:,\s*|$))+)/g,
    );
    const challenges = Array.from(offered)
      .filter(([, scheme = ""]) => scheme.toLowerCase() === "digest")
      .map(([, , list = ""]) => this.#challengeOf(list))
      .filter((challenge) => challenge !== null);
    const strongestFirst = challenges.toSorted(
      (left, right) =>
        ranked.indexOf(this.#baseOf(left.algorithm)) -
        ranked.indexOf(this.#baseOf(right.algorithm)),
    );
    return strongestFirst[0] ?? null;
  }

  #challengeOf(list: string): DigestChallenge | null {
    const parameters = new Map<string, string>();
    const declared = list.matchAll(
      /([\w-]+)\s*=\s*(?:"((?:[^"\\]|\\.)*)"|([^\s,"]+))/g,
    );

    for (const [, name = "", text, token = ""] of declared) {
      const value = text === undefined ? token : text.replace(/\\(.)/g, "$1");
      parameters.set(name.toLowerCase(), value);
    }

    const algorithm = parameters.get("algorithm") ?? "MD5";
    const base = this.#baseOf(algorithm);
    const hashName = HASHES_STRONGEST_FIRST.get(base);

    if (hashName === undefined) return null;

    const session = base !== algorithm.toUpperCase();
    return { parameters, algorithm, hashName, session };
  }

  #baseOf(algorithm: string): string {
    return algorithm.toUpperCase().replace(/-SESS$/, "");
  }

  #qopOf(challenge: DigestChallenge): string | null {
    const offered = challenge.parameters.get("qop") ?? "";
    const options = offered.split(",").map((option) => option.trim());

    if (options.includes("auth")) return "auth";

    if (options.includes("auth-int")) return "auth-int";

    return null;
  }

  #uriOf(request: OutboundRequest): string {
    const target = new URL(request.uri);
    return `${target.pathname}${target.search}`;
  }

  #hash(challenge: DigestChallenge, text: string): string {
    return createHash(challenge.hashName).update(text, "utf8").digest("hex");
  }

  #quoted(text: string): string {
    const escaped = text.replace(/(["\\])/g, "\\$1");
    return `"${escaped}"`;
  }
}

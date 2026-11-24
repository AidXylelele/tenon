import type { EditAction } from "language-server/protocol";
import type { Authentication, AuthScheme, FieldState } from "./interfaces";
import { isObject, type Json } from "./json";
import { clearEditsOf, valueEditsOf } from "./edits";

const SCHEMES: readonly AuthScheme[] = ["bearer", "basic"];

const NO_AUTHENTICATION: Authentication = { scheme: "none", secret: "" };

export function authenticationOf(value: Json): Authentication {
  if (!isObject(value)) return NO_AUTHENTICATION;

  const scheme = SCHEMES.find((each) => isObject(value[each]));

  if (scheme === undefined) return { scheme: "other", secret: "" };

  const policy = value[scheme];
  const secret =
    isObject(policy) && typeof policy.use === "string" ? policy.use : "";
  return { scheme, secret };
}

export function authenticationEditsOf(
  field: FieldState,
  chosen: Authentication,
): EditAction[] {
  const secret = chosen.secret.trim();

  if (chosen.scheme === "none") return clearEditsOf(field);

  if (chosen.scheme === "other" || secret === "") return [];

  const policy = { [chosen.scheme]: { use: secret } };
  return valueEditsOf(field, policy);
}

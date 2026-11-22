import type { ExpressionLanguage } from "../../runtime/index.js";
import type { RuntimeArgument } from "../../standard/index.js";
import type { Finding, Secret } from "../../syntax/index.js";
import {
  type ExpressionResolution,
  readsAsExpression,
} from "../resolve/index.js";
import { isEvaluated } from "./expression-language.js";
import type { CheckSubject } from "./types.js";

const secrets: RuntimeArgument = "secrets";
const none: readonly Finding[] = [];

export function checkSecrets(subject: CheckSubject): readonly Finding[] {
  const denoted = subject.symbols.references.secrets;
  const held = subject.profile.secrets;
  const policies = subject.occurrences
    .filter((occurrence) => occurrence.kind === "policy")
    .map((occurrence) => occurrence.policy);
  const secretPolicies = policies.filter((policy) => policy.kind === "secret");
  const undeclared = secretPolicies.filter(
    (policy) => !denoted.has(policy.secret.pointer),
  );
  const unheld = subject.workflow.use.secrets.filter(
    (secret) => !held.includes(secret.name),
  );
  const undeclaredFindings = undeclared.map(({ secret }) =>
    undeclaredSecretOf(secret.pointer, secret.name),
  );
  const undeclaredReadFindings = undeclaredReadFindingsOf(subject);
  const unknownFindings = unheld.map(unknownSecretOf);

  return [...undeclaredFindings, ...undeclaredReadFindings, ...unknownFindings];
}

function undeclaredReadFindingsOf(subject: CheckSubject): readonly Finding[] {
  const evaluated = isEvaluated(subject);

  if (!evaluated) {
    return none;
  }

  const declared = subject.workflow.use.secrets.map((secret) => secret.name);
  const resolutions = [...subject.resolutions.values()];
  const reading = resolutions.filter(bindsSecrets);
  const sites = Map.groupBy(reading, ({ expression }) => expression);
  const groups = [...sites.values()];
  const once = groups.flatMap((group) => group.slice(0, 1));

  return once.flatMap((resolution) =>
    undeclaredSecretsOf(resolution, declared, subject.expressions),
  );
}

function bindsSecrets(resolution: ExpressionResolution): boolean {
  const binding = resolution.bindings.get(secrets);
  return binding?.kind === "argument";
}

function undeclaredSecretsOf(
  resolution: ExpressionResolution,
  declared: readonly string[],
  expressions: ExpressionLanguage,
): readonly Finding[] {
  const { pointer, source } = resolution.expression;
  const read = expressions.memberNamesOf(source, secrets);
  const undeclared = read.filter((name) => !declared.includes(name));

  if (undeclared.length === 0) {
    return none;
  }

  const isExpression = readsAsExpression(resolution, expressions);

  if (!isExpression) {
    return none;
  }

  return undeclared.map((name) => undeclaredSecretOf(pointer, name));
}

function undeclaredSecretOf(
  pointer: string,
  name: string,
): Finding<"undeclaredSecret"> {
  return {
    name: "undeclaredSecret",
    code: "undeclared-secret",
    pointer,
    subject: name,
    details: [name],
    import: null,
  };
}

function unknownSecretOf(secret: Secret): Finding<"unknownSecret"> {
  return {
    name: "unknownSecret",
    code: "unknown-secret",
    pointer: secret.pointer,
    subject: secret.name,
    details: [secret.name],
    import: null,
  };
}

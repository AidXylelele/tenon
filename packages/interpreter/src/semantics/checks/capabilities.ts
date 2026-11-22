import type { HostProfile } from "../../api/index.js";
import type { Finding, Workflow } from "../../syntax/index.js";
import { offers, type Requirement, requirementsOf } from "./requirements.js";
import type { CheckSubject } from "./types.js";

export function checkCapabilities(subject: CheckSubject): readonly Finding[] {
  const requirements = requirementsOf(
    subject.workflow,
    subject.occurrences,
    subject.symbols.references,
  );
  const missing = requirements.filter(
    (requirement) => !isProvided(requirement, subject.profile),
  );
  const capabilities = missing.map(missingCapabilityOf);
  const triggers = triggerFindingsOf(subject.workflow, subject.profile);

  return [...capabilities, ...triggers];
}

export function missingCapabilityOf(
  requirement: Requirement,
): Finding<"capability"> {
  const capability = `${requirement.kind}.${requirement.name}`;
  return refusedCapabilityOf(capability, requirement.pointer);
}

function triggerFindingsOf(
  workflow: Workflow,
  profile: HostProfile,
): readonly Finding<"capability">[] {
  const isOne = profile.triggers === "one";
  const isMany = workflow.schedules.length > 1;

  if (!isOne || !isMany) {
    return [];
  }

  const refused = refusedCapabilityOf("triggers.many", "/schedule");
  return [refused];
}

function refusedCapabilityOf(
  capability: string,
  pointer: string,
): Finding<"capability"> {
  return {
    name: "capability",
    code: "capability",
    pointer,
    subject: capability,
    details: [capability],
    import: null,
  };
}

function isProvided(requirement: Requirement, profile: HostProfile): boolean {
  const offered: readonly string[] = profile[offers[requirement.kind]] ?? [];
  return offered.includes(requirement.name);
}

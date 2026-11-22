import type { Role } from "@/libs/data-access/types";

interface RoleWords {
  readonly label: string;
  readonly noun: string;
  readonly duties: string;
}

const ROLE: Record<Role, RoleWords> = {
  admin: {
    label: "Administrator",
    noun: "an administrator",
    duties: "everything editors do, and inviting people",
  },
  editor: {
    label: "Editor",
    noun: "an editor",
    duties: "builds, runs and connects automations",
  },
  viewer: {
    label: "Viewer",
    noun: "a viewer",
    duties: "reads workflows and runs",
  },
};

export function roleLabel(role: Role): string {
  return ROLE[role].label;
}

export function roleNoun(role: Role): string {
  return ROLE[role].noun;
}

export function roleDuties(role: Role): string {
  return ROLE[role].duties;
}

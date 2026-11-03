import type { Role } from '@/libs/data-access/types';

interface RoleWords {
  readonly label: string;
  // The role as a sentence names it: "invited as an editor".
  readonly noun: string;
  readonly duties: string;
}

// What each role is called and what it may do, in the console's words (003 FR-002).
const ROLE: Record<Role, RoleWords> = {
  admin: {
    label: 'Administrator',
    noun: 'an administrator',
    duties: 'everything editors do, and inviting people',
  },
  editor: {
    label: 'Editor',
    noun: 'an editor',
    duties: 'builds, runs and connects automations',
  },
  viewer: {
    label: 'Viewer',
    noun: 'a viewer',
    duties: 'reads workflows and runs',
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

import { describe, expect, it } from 'vitest';
import type { Role, User } from '@/libs/data-access/types';
import { canAuthor, isAdministrator } from './access';

const as = (role: Role): User => ({
  id: 'u1',
  email: 'ada@example.com',
  name: 'Ada',
  role,
});

describe('who may do what in the console', () => {
  it.each([
    ['admin', true],
    ['editor', true],
    ['viewer', false],
  ] as const)('the_%s_role_may_change_automations_%s', (role, may) => {
    expect(canAuthor(as(role))).toBe(may);
  });

  it.each([
    ['admin', true],
    ['editor', false],
    ['viewer', false],
  ] as const)('the_%s_role_runs_the_team_%s', (role, runs) => {
    expect(isAdministrator(as(role))).toBe(runs);
  });

  it('nobody_signed_in_yet_may_do_neither', () => {
    expect(canAuthor(null)).toBe(false);
    expect(isAdministrator(null)).toBe(false);
  });
});

import { JsonPointer } from '../../../../../src/domain/automation/language/json-pointer.js';
import { ForkTask } from '../../../../../src/domain/automation/language/tasks/fork-task.js';
import { EmptyCompetingForkError } from '../../../../../src/domain/errors.js';
import { baseAt, rejectionOf, taskList } from '../../../../support/language.js';

describe('ForkTask', () => {
  const reference = JsonPointer.root().at('do').at(0).at('race');
  const branchesAt = reference.at('fork').at('branches');

  it('a_competing_fork_without_branches_is_refused', () => {
    const branches = taskList(branchesAt, []);

    const rejection = rejectionOf(
      () =>
        new ForkTask({
          name: 'race',
          reference,
          base: baseAt(reference),
          branches,
          compete: true,
        }),
    );

    expect(rejection).toBeInstanceOf(EmptyCompetingForkError);
    expect(rejection.pointer).toBe('/do/0/race/fork/branches');
  });

  it('a_fork_does_not_compete_unless_it_says_so', () => {
    const branches = taskList(branchesAt, []);

    const fork = new ForkTask({
      name: 'race',
      reference,
      base: baseAt(reference),
      branches,
      compete: null,
    });

    expect(fork.compete).toBe(false);
  });
});

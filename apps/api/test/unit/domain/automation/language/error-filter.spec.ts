import { ErrorFilter } from '../../../../../src/domain/automation/language/error-filter.js';
import { ErrorType } from '../../../../../src/domain/automation/language/error-type.js';
import { WorkflowError } from '../../../../../src/domain/automation/language/workflow-error.js';

describe('ErrorFilter', () => {
  const communication = WorkflowError.of(
    ErrorType.COMMUNICATION,
    '/do/0/getPet',
    'refused',
  );

  it('an_error_matches_when_every_filtered_property_is_equal', () => {
    const filter = ErrorFilter.read({
      with: {
        type: 'https://serverlessworkflow.io/spec/1.0.0/errors/communication',
        status: 500,
      },
    });

    expect(filter.matches(communication)).toBe(true);
  });

  it('an_error_does_not_match_when_one_property_differs', () => {
    const filter = ErrorFilter.read({ with: { status: 404 } });

    expect(filter.matches(communication)).toBe(false);
  });

  it('a_filter_without_properties_matches_every_error', () => {
    const filter = ErrorFilter.read(undefined);

    expect(filter.matches(communication)).toBe(true);
  });
});

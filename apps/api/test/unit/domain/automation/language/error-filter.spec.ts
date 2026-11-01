import { ErrorProperty } from '../../../../../src/domain/automation/language/enums.js';
import { ErrorFilter } from '../../../../../src/domain/automation/language/error-filter.js';
import { ErrorType } from '../../../../../src/domain/automation/language/error-type.js';
import { JsonPointer } from '../../../../../src/domain/automation/language/json-pointer.js';

const at = JsonPointer.root().at('do').at(0).at('getPet');
const notFound = ErrorType.Communication.errorWithStatus(404, at, null);

describe('ErrorFilter', () => {
  it('a_filter_matches_when_every_expected_property_is_equal', () => {
    const expected = new Map<ErrorProperty, string | number>([
      [
        ErrorProperty.Type,
        'https://serverlessworkflow.io/spec/1.0.0/errors/communication',
      ],
      [ErrorProperty.Status, 404],
    ]);

    expect(new ErrorFilter(expected).matches(notFound)).toBe(true);
  });

  it('a_filter_with_one_different_property_does_not_match', () => {
    const expected = new Map<ErrorProperty, string | number>([
      [ErrorProperty.Status, 503],
    ]);

    expect(new ErrorFilter(expected).matches(notFound)).toBe(false);
  });

  it('an_empty_filter_matches_every_error', () => {
    expect(ErrorFilter.none().matches(notFound)).toBe(true);
  });
});

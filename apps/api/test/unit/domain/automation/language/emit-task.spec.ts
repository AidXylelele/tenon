import { JsonPointer } from '../../../../../src/domain/automation/language/json-pointer.js';
import { EmitTask } from '../../../../../src/domain/automation/language/tasks/emit-task.js';
import { Template } from '../../../../../src/domain/automation/language/template.js';
import { MalformedEventError } from '../../../../../src/domain/errors.js';
import { baseAt, rejectionOf } from '../../../../support/language.js';

describe('EmitTask', () => {
  const reference = JsonPointer.root().at('do').at(0).at('notify');
  const withAt = reference.at('emit').at('event').at('with');

  it.each([
    {},
    { source: 'https://example.com' },
    { type: 'order.placed' },
    { source: 'https://example.com', type: 'order.placed', Trace_Id: '1' },
  ])(
    'an_event_without_a_source_and_a_type_or_with_a_bad_attribute_name_is_refused',
    (value) => {
      const event = new Template({ pointer: withAt, value });

      const rejection = rejectionOf(
        () =>
          new EmitTask({
            name: 'notify',
            reference,
            base: baseAt(reference),
            event,
          }),
      );

      expect(rejection).toBeInstanceOf(MalformedEventError);
      expect(rejection.pointer).toBe('/do/0/notify/emit/event/with');
    },
  );
});

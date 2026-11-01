import { ErrorType } from '../../../../../src/domain/automation/language/error-type.js';
import { FlowDirective } from '../../../../../src/domain/automation/language/flow-directive.js';
import { JsonPointer } from '../../../../../src/domain/automation/language/json-pointer.js';
import { Outcome } from '../../../../../src/domain/automation/language/outcome.js';
import { TaskEnding } from '../../../../../src/domain/automation/language/task-ending.js';
import { InconsistentProgressError } from '../../../../../src/domain/errors.js';

const at = JsonPointer.root().at('do').at(0).at('greet');
const failure = ErrorType.Runtime.errorAt(at, null);

describe('Outcome', () => {
  it('a_failed_outcome_with_an_output_is_refused', () => {
    const build = () =>
      new Outcome({
        output: { a: 1 },
        failure,
        directive: null,
        authorization: null,
        emitted: null,
        detachedProcess: null,
        detachedWorkflow: null,
      });

    expect(build).toThrow(InconsistentProgressError);
  });

  it('an_outcome_with_two_effects_is_refused', () => {
    const build = () =>
      new Outcome({
        output: { a: 1 },
        failure: null,
        directive: FlowDirective.End,
        authorization: null,
        emitted: { type: 'com.example.done' },
        detachedProcess: null,
        detachedWorkflow: null,
      });

    expect(build).toThrow(InconsistentProgressError);
  });

  it('an_outcome_directed_to_end_ends_the_workflow', () => {
    const ended = Outcome.directed({ a: 1 }, FlowDirective.End);
    const continued = Outcome.of({ a: 1 });

    expect(ended.endsWorkflow()).toBe(true);
    expect(continued.endsWorkflow()).toBe(false);
  });
});

describe('TaskEnding', () => {
  it('a_faulted_ending_with_a_directive_is_refused', () => {
    const build = () =>
      new TaskEnding({
        output: null,
        failure,
        directive: FlowDirective.Continue,
        skipped: false,
        exported: false,
        context: null,
        body: null,
      });

    expect(build).toThrow(InconsistentProgressError);
  });

  it('an_ending_without_a_fault_or_a_directive_is_refused', () => {
    const build = () =>
      new TaskEnding({
        output: { a: 1 },
        failure: null,
        directive: null,
        skipped: false,
        exported: false,
        context: null,
        body: null,
      });

    expect(build).toThrow(InconsistentProgressError);
  });

  it('a_skipped_ending_with_a_body_is_refused', () => {
    const body = Outcome.of({ a: 1 });
    const build = () =>
      new TaskEnding({
        output: { a: 1 },
        failure: null,
        directive: FlowDirective.Continue,
        skipped: true,
        exported: false,
        context: null,
        body,
      });

    expect(build).toThrow(InconsistentProgressError);
  });
});

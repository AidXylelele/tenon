import { CloudEvent } from '../../../../../src/domain/automation/language/cloud-event.js';
import { ErrorType } from '../../../../../src/domain/automation/language/error-type.js';
import { FlowDirective } from '../../../../../src/domain/automation/language/flow-directive.js';
import { JsonPointer } from '../../../../../src/domain/automation/language/json-pointer.js';
import { Outcome } from '../../../../../src/domain/automation/language/outcome.js';
import { InconsistentProgressError } from '../../../../../src/domain/errors.js';
import { CompletedEnding } from '../../../../../src/domain/automation/language/endings/completed-ending.js';
import { SkippedEnding } from '../../../../../src/domain/automation/language/endings/skipped-ending.js';

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
        emitted: new CloudEvent({
          id: '1',
          source: 'https://orders.example',
          type: 'com.example.done',
          time: null,
          subject: null,
          dataContentType: null,
          dataSchema: null,
          data: null,
          extensions: {},
        }),
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
  it('a_completed_ending_whose_body_failed_is_refused', () => {
    const outcome = Outcome.failed(failure);
    const build = () =>
      new CompletedEnding({
        output: null,
        then: FlowDirective.Continue,
        exported: false,
        context: null,
        outcome,
      });

    expect(build).toThrow(InconsistentProgressError);
  });

  it('a_completed_ending_follows_the_directive_of_its_body', () => {
    const outcome = Outcome.directed({ a: 1 }, FlowDirective.End);
    const ending = new CompletedEnding({
      output: { a: 1 },
      then: FlowDirective.Continue,
      exported: false,
      context: null,
      outcome,
    });

    expect(ending.directive).toBe(FlowDirective.End);
  });

  it('a_skipped_ending_keeps_its_raw_input_and_runs_no_body', () => {
    const ending = new SkippedEnding({ a: 1 }, FlowDirective.Exit);

    expect(ending.output).toEqual({ a: 1 });
    expect(ending.directive).toBe(FlowDirective.Exit);
    expect(ending.body).toBeNull();
  });
});

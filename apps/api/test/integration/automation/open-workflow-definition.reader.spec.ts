import type { Definition } from '../../../src/domain/automation/language/definition.js';
import { ErrorProperty } from '../../../src/domain/automation/language/enums.js';
import { DoTask } from '../../../src/domain/automation/language/tasks/do-task.js';
import { FunctionCallTask } from '../../../src/domain/automation/language/tasks/function-call-task.js';
import { HttpCallTask } from '../../../src/domain/automation/language/tasks/http-call-task.js';
import { RunWorkflowTask } from '../../../src/domain/automation/language/tasks/run-workflow-task.js';
import { TryTask } from '../../../src/domain/automation/language/tasks/try-task.js';
import {
  EmptyCompetingForkError,
  InvalidDocumentError,
  UndeclaredComponentError,
  UnknownTaskError,
  UnsupportedConstructError,
} from '../../../src/domain/errors.js';
import { SdkOpenWorkflowClient } from '../../../src/frameworks/openworkflowspec/sdk-open-workflow.client.js';
import { OpenWorkflowDefinitionReader } from '../../../src/interface-adapters/documents/open-workflow-definition.reader.js';
import { ctkDocuments } from '../../support/ctk-documents.js';
import { rejectionOf } from '../../support/language.js';

const DOCUMENT = `document:
  dsl: '1.0.3'
  namespace: default
  name: sample
  version: '1.0.0'
`;

function workflowOf(body: string): string {
  return `${DOCUMENT}${body}`;
}

describe('OpenWorkflowDefinitionReader', () => {
  const reader = new OpenWorkflowDefinitionReader(new SdkOpenWorkflowClient());

  function read(text: string): Definition {
    return reader.read(text);
  }

  it('every_ctk_document_is_read_or_refused_as_outside_the_subset', () => {
    const documents = ctkDocuments();

    expect(documents).toHaveLength(21);

    for (const text of documents) {
      try {
        read(text);
      } catch (error) {
        expect(error).toBeInstanceOf(UnsupportedConstructError);
      }
    }
  });

  it('a_document_becomes_its_definition_with_every_expression_located', () => {
    const definition = read(
      workflowOf(`input:
  from: \${ .order }
use:
  functions:
    charge:
      call: http
      with:
        method: post
        endpoint: https://payments.example.com/charges
do:
  - prepare:
      if: \${ .amount > 0 }
      do:
        - pay:
            call: charge
  - notify:
      call: http
      with:
        method: post
        endpoint: \${ "https://hooks.example.com/" + .id }
  - archive:
      run:
        workflow:
          namespace: billing
          name: archive
          version: latest
`),
    );

    const [prepare, notify, archive] = definition.body.tasks;
    const pay = prepare instanceof DoTask ? prepare.body.tasks[0] : undefined;
    const located = definition.expressions.map((expression) => [
      expression.pointer.toString(),
      expression.program,
    ]);
    expect(definition.workflow.toString()).toBe('default/sample');
    expect(definition.dslVersion).toBe('1.0.3');
    expect(pay).toBeInstanceOf(FunctionCallTask);
    expect(notify).toBeInstanceOf(HttpCallTask);
    expect(archive).toBeInstanceOf(RunWorkflowTask);
    expect(located).toEqual([
      ['/input/from', '.order'],
      ['/do/0/prepare/if', '.amount > 0'],
      ['/do/1/notify/with/endpoint', '"https://hooks.example.com/" + .id'],
    ]);
  });

  it.each([
    ['/do/0/pause/wait', 'do:\n  - pause:\n      wait: PT1S\n'],
    [
      '/do/0/hear/listen',
      'do:\n  - hear:\n      listen:\n        to:\n          one:\n            with:\n              type: com.example.order\n',
    ],
    [
      '/do/0/greet/call',
      'do:\n  - greet:\n      call: grpc\n      with:\n        proto:\n          endpoint: file://app/greet.proto\n        service:\n          name: GreeterApi.Greeter\n          host: localhost\n        method: SayHello\n',
    ],
    ['/do/0/log/call', 'do:\n  - log:\n      call: log@default\n'],
    [
      '/do/0/build/run/container',
      'do:\n  - build:\n      run:\n        container:\n          image: alpine\n',
    ],
    [
      '/do/0/compute/run/script/source',
      'do:\n  - compute:\n      run:\n        script:\n          language: js\n          source:\n            endpoint: https://scripts.example.com/compute.js\n',
    ],
    [
      '/do/0/compute/run/script/language',
      'do:\n  - compute:\n      run:\n        script:\n          language: ruby\n          code: puts 1\n',
    ],
    [
      '/schedule',
      'schedule:\n  every: PT1M\ndo:\n  - greet:\n      set:\n        x: 1\n',
    ],
    [
      '/use/secrets',
      'use:\n  secrets: [token]\ndo:\n  - greet:\n      set:\n        x: 1\n',
    ],
    [
      '/use/authentications/petAuth/digest',
      'use:\n  authentications:\n    petAuth:\n      digest:\n        username: admin\n        password: secret\ndo:\n  - greet:\n      set:\n        x: 1\n',
    ],
    [
      '/use/authentications/petAuth/basic/use',
      'use:\n  authentications:\n    petAuth:\n      basic:\n        use: petSecret\ndo:\n  - greet:\n      set:\n        x: 1\n',
    ],
    [
      '/use/authentications/petAuth/oauth2/grant',
      'use:\n  authentications:\n    petAuth:\n      oauth2:\n        authority: https://auth.example.com\n        grant: password\n        username: admin\n        password: secret\n        client:\n          id: pets\ndo:\n  - greet:\n      set:\n        x: 1\n',
    ],
    [
      '/do/0/greet/timeout/after',
      'do:\n  - greet:\n      timeout:\n        after: P1.5D\n      set:\n        x: 1\n',
    ],
    [
      '/do/0/guarded/catch/retry/delay',
      'do:\n  - guarded:\n      try:\n        - greet:\n            set:\n              x: 1\n      catch:\n        retry:\n          delay: ${ .delay }\n',
    ],
  ])('a_construct_outside_the_subset_is_refused_at_%s', (pointer, body) => {
    const rejection = rejectionOf(() => read(workflowOf(body)));

    expect(rejection).toBeInstanceOf(UnsupportedConstructError);
    expect(rejection.pointer).toBe(pointer);
  });

  it.each([
    [
      '/do/0/guarded/catch/retry',
      '"fast" is not declared in use.retries',
      'do:\n  - guarded:\n      try:\n        - greet:\n            set:\n              x: 1\n      catch:\n        retry: fast\n',
    ],
    [
      '/do/0/greet/timeout',
      '"short" is not declared in use.timeouts',
      'do:\n  - greet:\n      timeout: short\n      set:\n        x: 1\n',
    ],
    [
      '/do/0/fail/raise/error',
      '"notFound" is not declared in use.errors',
      'do:\n  - fail:\n      raise:\n        error: notFound\n',
    ],
    [
      '/do/0/getPet/with/endpoint/authentication/use',
      '"petAuth" is not declared in use.authentications',
      'do:\n  - getPet:\n      call: http\n      with:\n        method: get\n        endpoint:\n          uri: https://pets.example.com/pets/1\n          authentication:\n            use: petAuth\n',
    ],
    [
      '/do/0/pay/call',
      '"charge" is not declared in use.functions',
      'do:\n  - pay:\n      call: charge\n',
    ],
  ])(
    'a_name_that_use_does_not_declare_is_refused_at_%s',
    (pointer, message, body) => {
      const rejection = rejectionOf(() => read(workflowOf(body)));

      expect(rejection).toBeInstanceOf(UndeclaredComponentError);
      expect(rejection.pointer).toBe(pointer);
      expect(rejection.message).toBe(message);
    },
  );

  it('a_directive_naming_no_task_of_its_list_is_refused_where_it_stands', () => {
    const rejection = rejectionOf(() =>
      read(
        workflowOf(
          'do:\n  - greet:\n      set:\n        x: 1\n      then: missing\n',
        ),
      ),
    );

    expect(rejection).toBeInstanceOf(UnknownTaskError);
    expect(rejection.pointer).toBe('/do/0/greet/then');
  });

  it('a_competing_fork_without_branches_is_refused', () => {
    const rejection = rejectionOf(() =>
      read(
        workflowOf(
          'do:\n  - race:\n      fork:\n        compete: true\n        branches: []\n',
        ),
      ),
    );

    expect(rejection).toBeInstanceOf(EmptyCompetingForkError);
    expect(rejection.pointer).toBe('/do/0/race/fork/branches');
  });

  it('a_document_the_standard_refuses_is_refused_at_the_place_given', () => {
    const rejection = rejectionOf(() => read('document: [unclosed'));

    expect(rejection).toBeInstanceOf(InvalidDocumentError);
    expect(rejection.pointer).toBe('');
  });

  it('an_error_filter_takes_the_standard_properties_of_an_error', () => {
    const definition = read(
      workflowOf(
        'do:\n  - guarded:\n      try:\n        - greet:\n            set:\n              x: 1\n      catch:\n        errors:\n          with:\n            status: 503\n            details: busy\n',
      ),
    );

    const [guarded] = definition.body.tasks;
    const expected =
      guarded instanceof TryTask ? guarded.catchClause.filter.expected : null;
    expect(expected).toEqual(
      new Map<ErrorProperty, string | number>([
        [ErrorProperty.Status, 503],
        [ErrorProperty.Detail, 'busy'],
      ]),
    );
  });

  it('declared_functions_may_call_each_other', () => {
    const definition = read(
      workflowOf(
        'use:\n  functions:\n    charge:\n      call: settle\n    settle:\n      call: charge\ndo:\n  - pay:\n      call: charge\n',
      ),
    );

    expect(
      definition.components.function('settle', definition.body.reference),
    ).toBeInstanceOf(FunctionCallTask);
  });
});

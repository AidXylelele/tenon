import { ResilienceService } from '@nestjs/resilience';
import { Test } from '@nestjs/testing';
import type { Definition } from '../../../src/domain/automation/language/definition.js';
import { ErrorType } from '../../../src/domain/automation/language/error-type.js';
import { DoTask } from '../../../src/domain/automation/language/tasks/do-task.js';
import { FunctionCallTask } from '../../../src/domain/automation/language/tasks/function-call-task.js';
import { HttpCallTask } from '../../../src/domain/automation/language/tasks/http-call-task.js';
import { RunWorkflowTask } from '../../../src/domain/automation/language/tasks/run-workflow-task.js';
import { TryTask } from '../../../src/domain/automation/language/tasks/try-task.js';
import {
  BranchJumpError,
  DefinitionRejectedError,
  DuplicateDefaultCaseError,
  EmptyCompetingForkError,
  InvalidDocumentError,
  UndeclaredComponentError,
  UnknownTaskError,
  UnsupportedConstructError,
} from '../../../src/domain/errors.js';
import { ResilienceModule } from '../../../src/frameworks/di/resilience.module.js';
import { SdkOpenWorkflowClient } from '../../../src/frameworks/openworkflowspec/sdk-open-workflow.client.js';
import { OpenWorkflowDefinitionReader } from '../../../src/interface-adapters/workflows/definitions/open-workflow-definition.reader.js';
import { ctkDocuments } from '../../support/ctk-documents.js';

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
  let client: SdkOpenWorkflowClient;
  let reader: OpenWorkflowDefinitionReader;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ResilienceModule],
    }).compile();
    client = new SdkOpenWorkflowClient(moduleRef.get(ResilienceService));
    reader = new OpenWorkflowDefinitionReader(client);
  });

  afterAll(async () => {
    await client.onApplicationShutdown();
  });

  function read(text: string): Promise<Definition> {
    return reader.read(text);
  }

  async function refusalOf(text: string): Promise<DefinitionRejectedError> {
    try {
      await reader.read(text);
    } catch (error) {
      if (error instanceof DefinitionRejectedError) return error;

      throw error;
    }

    throw new Error('The definition was not rejected');
  }

  it('every_ctk_document_is_read_or_refused_as_outside_the_subset', async () => {
    const documents = ctkDocuments();

    expect(documents).toHaveLength(21);

    for (const text of documents) {
      try {
        await read(text);
      } catch (error) {
        expect(error).toBeInstanceOf(UnsupportedConstructError);
      }
    }
  });

  it('a_document_becomes_its_definition_with_every_expression_located', async () => {
    const definition = await read(
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
    [
      '/do/0/guarded/catch/retry/limit/attempt/duration',
      'do:\n  - guarded:\n      try:\n        - greet:\n            set:\n              x: 1\n      catch:\n        retry:\n          limit:\n            attempt:\n              duration: PT5S\n',
    ],
    [
      '/do/0/guarded/catch/retry/backoff',
      'do:\n  - guarded:\n      try:\n        - greet:\n            set:\n              x: 1\n      catch:\n        retry:\n          backoff:\n            exponential:\n              factor: 3\n',
    ],
    [
      '/evaluate/mode',
      'evaluate:\n  mode: loose\ndo:\n  - greet:\n      set:\n        x: 1\n',
    ],
    [
      '/evaluate/language',
      'evaluate:\n  language: js\ndo:\n  - greet:\n      set:\n        x: 1\n',
    ],
    [
      '/evaluate/langauge',
      'evaluate:\n  langauge: js\ndo:\n  - greet:\n      set:\n        x: 1\n',
    ],
    [
      '/input/schema/resource',
      'input:\n  schema:\n    format: json\n    resource:\n      endpoint: https://schemas.example.com/order.json\ndo:\n  - greet:\n      set:\n        x: 1\n',
    ],
    [
      '/input/schema/format',
      'input:\n  schema:\n    format: avro\n    document: {}\ndo:\n  - greet:\n      set:\n        x: 1\n',
    ],
    [
      '/do/0/greet/timeout/after',
      'do:\n  - greet:\n      timeout:\n        after: P1W\n      set:\n        x: 1\n',
    ],
    [
      '/do/0/guarded/catch/errors/type',
      'do:\n  - guarded:\n      try:\n        - greet:\n            set:\n              x: 1\n      catch:\n        errors:\n          type: https://serverlessworkflow.io/spec/1.0.0/errors/communication\n',
    ],
    [
      '/do/0/guarded/catch/errors/with/detail',
      'do:\n  - guarded:\n      try:\n        - greet:\n            set:\n              x: 1\n      catch:\n        errors:\n          with:\n            detail: timeout\n',
    ],
    [
      '/do/0/notify/emit/event/source',
      'do:\n  - notify:\n      emit:\n        event:\n          with:\n            source: https://example.com\n            type: com.example.order\n          source: https://example.com\n',
    ],
    [
      '/timout',
      'timout:\n  after: PT1S\ndo:\n  - greet:\n      set:\n        x: 1\n',
    ],
    [
      '/use/authentications/petAuth/token',
      'use:\n  authentications:\n    petAuth:\n      bearer:\n        token: abc\n      token: abc\ndo:\n  - greet:\n      set:\n        x: 1\n',
    ],
    [
      '/do/0/greet/set/x',
      'do:\n  - greet:\n      set:\n        x: ${ $secrets.token }\n',
    ],
    [
      '/use/authentications/petAuth/oauth2/client/authentication',
      'use:\n  authentications:\n    petAuth:\n      oauth2:\n        authority: https://auth.example.com\n        grant: client_credentials\n        client:\n          id: pets\n          secret: s3cr3t\n          authentication: client_secret_jwt\ndo:\n  - greet:\n      set:\n        x: 1\n',
    ],
    [
      '/use/authentications/petAuth/oauth2/client',
      'use:\n  authentications:\n    petAuth:\n      oauth2:\n        authority: https://auth.example.com\n        grant: client_credentials\n        client:\n          id: pets\ndo:\n  - greet:\n      set:\n        x: 1\n',
    ],
    [
      '/use/authentications/petAuth/oauth2/issuers',
      'use:\n  authentications:\n    petAuth:\n      oauth2:\n        authority: https://auth.example.com\n        grant: client_credentials\n        client:\n          id: pets\n          secret: s3cr3t\n        issuers: [https://auth.example.com]\ndo:\n  - greet:\n      set:\n        x: 1\n',
    ],
    [
      '/use/authentications/petAuth/oauth2/request/encoding',
      'use:\n  authentications:\n    petAuth:\n      oauth2:\n        authority: https://auth.example.com\n        grant: client_credentials\n        client:\n          id: pets\n          secret: s3cr3t\n        request:\n          encoding: application/json\ndo:\n  - greet:\n      set:\n        x: 1\n',
    ],
    [
      '/use/authentications/petAuth/oauth2/endpoints/introspection',
      'use:\n  authentications:\n    petAuth:\n      oauth2:\n        authority: https://auth.example.com\n        grant: client_credentials\n        client:\n          id: pets\n          secret: s3cr3t\n        endpoints:\n          introspection: /introspect\ndo:\n  - greet:\n      set:\n        x: 1\n',
    ],
    [
      '/do/0/archive/run/return',
      'do:\n  - archive:\n      run:\n        workflow:\n          namespace: billing\n          name: archive\n          version: latest\n        return: all\n',
    ],
  ])(
    'a_construct_outside_the_subset_is_refused_at_%s',
    async (pointer, body) => {
      const rejection = await refusalOf(workflowOf(body));

      expect(rejection).toBeInstanceOf(UnsupportedConstructError);
      expect(rejection.pointer).toBe(pointer);
    },
  );

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
    async (pointer, message, body) => {
      const rejection = await refusalOf(workflowOf(body));

      expect(rejection).toBeInstanceOf(UndeclaredComponentError);
      expect(rejection.pointer).toBe(pointer);
      expect(rejection.message).toBe(message);
    },
  );

  it('a_directive_naming_no_task_of_its_list_is_refused_where_it_stands', async () => {
    const rejection = await refusalOf(
      workflowOf(
        'do:\n  - greet:\n      set:\n        x: 1\n      then: missing\n',
      ),
    );

    expect(rejection).toBeInstanceOf(UnknownTaskError);
    expect(rejection.pointer).toBe('/do/0/greet/then');
  });

  it('a_competing_fork_without_branches_is_refused', async () => {
    const rejection = await refusalOf(
      workflowOf(
        'do:\n  - race:\n      fork:\n        compete: true\n        branches: []\n',
      ),
    );

    expect(rejection).toBeInstanceOf(EmptyCompetingForkError);
    expect(rejection.pointer).toBe('/do/0/race/fork/branches');
  });

  it('a_dsl_version_outside_the_supported_range_is_refused', async () => {
    const document = workflowOf('do:\n  - greet:\n      set:\n        x: 1\n');
    const alpha = document.replace("dsl: '1.0.3'", "dsl: '1.0.0-alpha5'");

    const rejection = await refusalOf(alpha);

    expect(rejection).toBeInstanceOf(UnsupportedConstructError);
    expect(rejection.pointer).toBe('/document/dsl');
  });

  it('a_second_default_case_is_refused_where_it_stands', async () => {
    const rejection = await refusalOf(
      workflowOf(
        'do:\n  - pick:\n      switch:\n        - a:\n            then: end\n        - b:\n            then: end\n',
      ),
    );

    expect(rejection).toBeInstanceOf(DuplicateDefaultCaseError);
    expect(rejection.pointer).toBe('/do/0/pick/switch/1/b');
  });

  it('a_fork_branch_naming_another_branch_is_refused_where_it_stands', async () => {
    const rejection = await refusalOf(
      workflowOf(
        'do:\n  - both:\n      fork:\n        branches:\n          - a:\n              set:\n                a: 1\n              then: b\n          - b:\n              set:\n                b: 2\n',
      ),
    );

    expect(rejection).toBeInstanceOf(BranchJumpError);
    expect(rejection.pointer).toBe('/do/0/both/fork/branches/0/a/then');
  });

  it.each([
    ['/evaluate', 'evaluate: loose\n'],
    ['/evaluate/mode', 'evaluate:\n  mode: 5\n'],
    ['/evaluate/language', 'evaluate:\n  language: [jq]\n'],
  ])(
    'an_evaluate_of_the_wrong_type_is_refused_at_%s',
    async (pointer, evaluate) => {
      const body = `${evaluate}do:\n  - greet:\n      set:\n        x: 1\n`;

      const rejection = await refusalOf(workflowOf(body));

      expect(rejection).toBeInstanceOf(InvalidDocumentError);
      expect(rejection.pointer).toBe(pointer);
    },
  );

  it('a_document_the_standard_refuses_is_refused_at_the_place_given', async () => {
    const rejection = await refusalOf('document: [unclosed');

    expect(rejection).toBeInstanceOf(InvalidDocumentError);
    expect(rejection.pointer).toBe('');
  });

  it('an_error_filter_takes_the_standard_properties_of_an_error', async () => {
    const definition = await read(
      workflowOf(
        'do:\n  - guarded:\n      try:\n        - greet:\n            set:\n              x: 1\n      catch:\n        errors:\n          with:\n            status: 503\n            details: busy\n',
      ),
    );

    const [guarded] = definition.body.tasks;
    const clause = guarded instanceof TryTask ? guarded.catchClause : null;
    const at = definition.body.reference;
    const busy = ErrorType.Communication.errorWithStatus(503, at, 'busy');
    const idle = ErrorType.Communication.errorWithStatus(503, at, 'idle');
    expect(clause?.filters(busy)).toBe(true);
    expect(clause?.filters(idle)).toBe(false);
  });

  it('client_credentials_with_a_client_secret_scopes_and_a_token_endpoint_are_read', async () => {
    const definition = await read(
      workflowOf(
        'use:\n  authentications:\n    petAuth:\n      oauth2:\n        authority: https://auth.example.com\n        grant: client_credentials\n        client:\n          id: pets\n          secret: s3cr3t\n          authentication: client_secret_basic\n        scopes: [pets]\n        audiences: [pets-api]\n        endpoints:\n          token: /token\n        request:\n          encoding: application/x-www-form-urlencoded\ndo:\n  - greet:\n      set:\n        x: 1\n',
      ),
    );

    const authentication = definition.components.authentication(
      'petAuth',
      definition.body.reference,
    );

    expect(authentication.scheme).toBe('oauth2');
  });

  it('declared_functions_may_call_each_other', async () => {
    const definition = await read(
      workflowOf(
        'use:\n  functions:\n    charge:\n      call: settle\n    settle:\n      call: charge\ndo:\n  - pay:\n      call: charge\n',
      ),
    );

    expect(
      definition.components.function('settle', definition.body.reference),
    ).toBeInstanceOf(FunctionCallTask);
  });

  it('a_document_whose_yaml_aliases_expand_without_bound_is_refused_and_the_node_keeps_serving', async () => {
    const levels = Array.from({ length: 9 }, (_, level) => {
      const previous = level === 0 ? 'lol' : `*a${String(level - 1)}`;
      const items = Array.from({ length: 10 }, () => previous).join(',');
      return `x${String(level)}: &a${String(level)} [${items}]`;
    });
    const bomb = workflowOf(
      `${levels.join('\n')}\ndo:\n  - a:\n      set:\n        v: *a8\n`,
    );
    const started = performance.now();

    const rejection = await refusalOf(bomb);
    const definition = await read(
      workflowOf('do:\n  - greet:\n      set:\n        x: 1\n'),
    );

    const elapsed = performance.now() - started;
    expect(rejection).toBeInstanceOf(InvalidDocumentError);
    expect(rejection.pointer).toBe('');
    expect(elapsed).toBeLessThan(8000);
    expect(definition.body.tasks).toHaveLength(1);
  });
});

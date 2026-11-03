import { describe, expect, it } from 'vitest';
import type { JsonObject } from '@/libs/document-text/json';
import { scriptLanguageName, summaryOf, uriOf } from './summary';
import { kindOf, type TaskEntry } from './tasks';

const summary = (task: JsonObject): string => {
  const entry: TaskEntry = {
    name: 'step',
    kind: kindOf(task),
    pointer: '/do/0/step',
    index: 0,
    listPointer: '/do',
    task,
  };
  return summaryOf(entry);
};

describe('one line that says what a step does', () => {
  it('a_call_names_its_method_and_address', () => {
    expect(
      summary({
        call: 'http',
        with: { method: 'post', endpoint: { uri: 'https://crm.example.com' } },
      }),
    ).toBe('POST https://crm.example.com');
    expect(summary({ call: 'http' })).toBe('GET');
  });

  it('setting_data_names_what_it_sets', () => {
    expect(summary({ set: { lead: 1, owner: 2 } })).toBe('Set lead, owner');
    expect(summary({ set: {} })).toBe('Set nothing');
    expect(summary({ set: '${ .lead }' })).toBe('Set from an expression');
  });

  it('a_wait_says_how_long', () => {
    expect(summary({ wait: { minutes: 1 } })).toBe('Wait 1 minute');
    expect(summary({ wait: 'PT1M' })).toBe('Wait');
  });

  it('events_name_their_type', () => {
    expect(summary({ emit: { event: { with: { type: 'lead.seen' } } } })).toBe(
      'Send lead.seen',
    );
    expect(summary({ emit: {} })).toBe('Send an event');
    expect(
      summary({ listen: { to: { one: { with: { type: 'lead.won' } } } } }),
    ).toBe('Wait for lead.won');
    expect(summary({ listen: { to: { any: [] } } })).toBe('Wait for events');
  });

  it('an_error_names_its_title_or_type', () => {
    expect(summary({ raise: { error: { title: 'No lead', type: 'x' } } })).toBe(
      'Fail: No lead',
    );
    expect(summary({ raise: { error: { type: 'validation' } } })).toBe(
      'Fail: validation',
    );
    expect(summary({ raise: { error: 'notFound' } })).toBe('Fail: an error');
  });

  it('flow_says_how_it_branches_and_repeats', () => {
    expect(summary({ switch: [{ a: {} }, { b: {} }] })).toBe(
      'Choose between 2 paths',
    );
    expect(summary({ switch: '${ .way }' })).toBe('Choose a path');
    expect(summary({ for: { each: 'lead', in: '${ .leads }' }, do: [] })).toBe(
      'For each lead in ${ .leads }',
    );
    expect(summary({ for: {}, do: [] })).toBe('For each item in …');
    expect(summary({ try: [], catch: {} })).toBe('Try, and handle failures');
  });

  it('branches_and_groups_count_what_they_hold', () => {
    expect(summary({ fork: { branches: [{ a: {} }] } })).toBe(
      '1 branch side by side',
    );
    expect(
      summary({ fork: { compete: true, branches: [{ a: {} }, { b: {} }] } }),
    ).toBe('2 branches side by side, first wins');
    expect(summary({ fork: 'x' })).toBe('0 branches side by side');
    expect(summary({ do: [{ a: {} }] })).toBe('1 step');
    expect(summary({ do: [{ a: {} }, { b: {} }] })).toBe('2 steps');
    expect(summary({ do: '${ .steps }' })).toBe('Steps');
  });

  it('runs_name_what_they_run', () => {
    expect(
      summary({ run: { workflow: { namespace: 'sales', name: 'score' } } }),
    ).toBe('Run sales/score');
    expect(summary({ run: { workflow: {} } })).toBe('Run /');
    expect(summary({ run: { script: { language: 'python' } } })).toBe(
      'Run Python',
    );
    expect(summary({ run: { script: {} } })).toBe('Run a script');
    expect(summary({ run: { shell: { command: 'ls' } } })).toBe('$ ls');
    expect(summary({ run: { shell: {} } })).toBe('$ ');
  });

  it('a_construct_edited_as_code_names_its_call_when_it_has_one', () => {
    expect(summary({ call: 'openapi' })).toBe('Call openapi');
    expect(summary({ unknown: true })).toBe('Edited as code');
  });
});

describe('the parts a summary is made of', () => {
  it('an_endpoint_is_its_address_or_its_uri', () => {
    expect(uriOf('https://a.example')).toBe('https://a.example');
    expect(uriOf({ uri: 'https://b.example' })).toBe('https://b.example');
    expect(uriOf({ authentication: {} })).toBeNull();
    expect(uriOf(undefined)).toBeNull();
  });

  it('a_script_language_is_named_as_people_name_it', () => {
    expect(scriptLanguageName('js')).toBe('JavaScript');
    expect(scriptLanguageName('javascript')).toBe('JavaScript');
    expect(scriptLanguageName('python')).toBe('Python');
    expect(scriptLanguageName('ruby')).toBe('ruby');
    expect(scriptLanguageName('')).toBe('a script');
  });
});

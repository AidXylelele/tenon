'use client';

import { CodeEditor } from '@/libs/code-editor/code-editor';
import { scriptLanguageName } from '../../../__shared_context/document/summary';
import type { JsonObject } from '@/libs/data-access/types';
import {
  Field,
  FieldDescription,
  FieldLabel,
} from '@/libs/ui/components/field';
import { Switch } from '@/libs/ui/components/switch';
import { isObject, withMember } from '../../../__shared_context/document/json';
import { uriOf } from '../../../__shared_context/document/summary';
import { useEditing, useFieldProblem } from '../editing-context';
import { ChoiceField, JsonField, PairsField, TextField } from './fields';
import { type TaskFormProps, taskEditor } from './task-form';

const METHODS = [
  'get',
  'post',
  'put',
  'patch',
  'delete',
  'head',
  'options',
].map((method) => ({
  value: method,
  label: method.toUpperCase(),
}));

const OUTPUTS = [
  { value: 'content', label: 'The body of the answer' },
  { value: 'response', label: 'The whole answer: status, headers and body' },
  { value: 'raw', label: 'The body as base64 text' },
];

const NONE = 'none';

export function HttpForm(props: TaskFormProps) {
  const edit = taskEditor(props);
  const { secretNames } = useEditing();
  const endpoint = edit.value('/with/endpoint');
  const uri = uriOf(endpoint) ?? '';
  const policy =
    isObject(endpoint) && isObject(endpoint.authentication)
      ? endpoint.authentication
      : null;
  const scheme =
    policy === null
      ? NONE
      : 'basic' in policy
        ? 'basic'
        : 'bearer' in policy
          ? 'bearer'
          : 'other';
  const schemePolicy =
    policy !== null && (scheme === 'basic' || scheme === 'bearer')
      ? policy[scheme]
      : undefined;
  const secret =
    isObject(schemePolicy) && typeof schemePolicy.use === 'string'
      ? schemePolicy.use
      : '';

  function writeUri(nextUri: string) {
    if (isObject(endpoint)) edit.set('/with/endpoint/uri', nextUri);
    else edit.set('/with/endpoint', nextUri);
  }

  function writeAuthentication(nextScheme: string, nextSecret: string) {
    if (nextScheme === NONE) {
      edit.set('/with/endpoint', uri);
      return;
    }

    const authentication = { [nextScheme]: { use: nextSecret } };
    edit.set('/with/endpoint', { uri, authentication });
  }

  return (
    <>
      <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-3">
        <ChoiceField
          id="http-method"
          label="Method"
          at="with/method"
          value={edit.text('/with/method') || 'get'}
          onChange={(method) => edit.set('/with/method', method)}
          options={METHODS}
        />
        <TextField
          id="http-uri"
          label="URL"
          at="with/endpoint"
          value={uri}
          placeholder="https://api.example.com/leads"
          mono
          onChange={writeUri}
        />
      </div>
      {scheme === 'other' ? (
        <p className="text-sm text-muted-foreground">
          This call authenticates with a policy written as code; edit it in the
          code view.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <ChoiceField
            id="http-auth"
            label="Authentication"
            at="with/endpoint/authentication"
            value={scheme}
            onChange={(next) =>
              writeAuthentication(next, secret || (secretNames[0] ?? ''))
            }
            options={[
              { value: NONE, label: 'None' },
              { value: 'basic', label: 'Basic, from a secret' },
              { value: 'bearer', label: 'Bearer token, from a secret' },
            ]}
          />
          {scheme !== NONE && (
            <SecretChoice
              value={secret}
              onChange={(next) => writeAuthentication(scheme, next)}
              hint={
                scheme === 'basic'
                  ? 'The secret holds {"username": "…", "password": "…"}.'
                  : 'The secret holds {"token": "…"}.'
              }
            />
          )}
        </div>
      )}
      <PairsField
        label="Headers"
        at="with/headers"
        optional
        keyLabel="Header"
        value={edit.object('/with/headers')}
        onChange={(headers) =>
          edit.set(
            '/with/headers',
            Object.keys(headers).length === 0 ? undefined : headers,
          )
        }
      />
      <PairsField
        label="Query"
        at="with/query"
        optional
        keyLabel="Parameter"
        value={edit.object('/with/query')}
        onChange={(query) =>
          edit.set(
            '/with/query',
            Object.keys(query).length === 0 ? undefined : query,
          )
        }
      />
      <JsonField
        id="http-body"
        label="Body"
        at="with/body"
        optional
        value={edit.value('/with/body')}
        onChange={(body) => edit.set('/with/body', body)}
        description="JSON, or an expression such as ${ .lead }."
      />
      <ChoiceField
        id="http-output"
        label="Keep"
        at="with/output"
        value={edit.text('/with/output') || 'content'}
        onChange={(output) =>
          edit.set('/with/output', output === 'content' ? undefined : output)
        }
        options={OUTPUTS}
      />
    </>
  );
}

function SecretChoice({
  value,
  onChange,
  hint,
}: {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly hint: string;
}) {
  const { secretNames } = useEditing();
  const options = secretNames.map((name) => ({ value: name, label: name }));

  if (options.length === 0)
    return (
      <Field>
        <FieldLabel>Secret</FieldLabel>
        <FieldDescription>
          You have no secrets yet. Add one on the Secrets page, then pick it
          here.
        </FieldDescription>
      </Field>
    );

  return (
    <ChoiceField
      id="http-secret"
      label="Secret"
      at="with/endpoint/authentication"
      value={value === '' ? (options[0]?.value ?? '') : value}
      onChange={onChange}
      options={options}
      description={hint}
    />
  );
}

export function SetForm(props: TaskFormProps) {
  const edit = taskEditor(props);
  const set = edit.value('/set');

  if (typeof set === 'string')
    return (
      <TextField
        id="set-expression"
        label="Data"
        at="set"
        mono
        value={set}
        onChange={(next) => edit.set('/set', next)}
        description="An expression whose result becomes the data."
      />
    );

  return (
    <PairsField
      label="Data"
      at="set"
      keyLabel="Field"
      value={edit.object('/set')}
      onChange={(data) => edit.set('/set', data)}
      description="Text, a number, true or false, JSON, or an expression such as ${ .lead.email }."
    />
  );
}

export function ScriptForm(props: TaskFormProps) {
  const edit = taskEditor(props);
  const { scriptLanguages } = useEditing();
  const problem = useFieldProblem('run/script/code');
  const language = edit.text('/run/script/language') || 'js';
  const languages = (
    scriptLanguages.length > 0 ? scriptLanguages : ['js', 'python']
  ).map((each) => ({
    value: each,
    label: scriptLanguageName(each),
  }));

  return (
    <>
      <ChoiceField
        id="script-language"
        label="Language"
        at="run/script/language"
        value={language}
        onChange={(chosen) => edit.set('/run/script/language', chosen)}
        options={languages}
      />
      <Field data-invalid={problem !== null}>
        <FieldLabel htmlFor="script-code">Code</FieldLabel>
        <CodeEditor
          id="script-code"
          label={`The ${scriptLanguageName(language)} code`}
          language={language === 'python' ? 'python' : 'javascript'}
          value={edit.text('/run/script/code')}
          onChange={(code) => edit.set('/run/script/code', code)}
          invalid={problem !== null}
        />
        <FieldDescription>
          {problem ??
            'Runs in the sandbox without network access, for 30 seconds at most. What it prints is its output; an error fails the step.'}
        </FieldDescription>
      </Field>
      <AwaitSwitch {...props} path="/run/await" />
    </>
  );
}

export function ShellForm(props: TaskFormProps) {
  const edit = taskEditor(props);

  return (
    <>
      <TextField
        id="shell-command"
        label="Command"
        at="run/shell/command"
        mono
        value={edit.text('/run/shell/command')}
        onChange={(command) => edit.set('/run/shell/command', command)}
        placeholder="echo hello"
      />
      <PairsField
        label="Arguments"
        at="run/shell/arguments"
        optional
        keyLabel="Argument"
        value={edit.object('/run/shell/arguments')}
        onChange={(args) =>
          edit.set(
            '/run/shell/arguments',
            Object.keys(args).length === 0 ? undefined : args,
          )
        }
      />
      <AwaitSwitch {...props} path="/run/await" />
    </>
  );
}

export function RunWorkflowForm(props: TaskFormProps) {
  const edit = taskEditor(props);

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField
          id="run-namespace"
          label="Namespace"
          at="run/workflow/namespace"
          value={edit.text('/run/workflow/namespace')}
          onChange={(namespace) =>
            edit.set('/run/workflow/namespace', namespace)
          }
        />
        <TextField
          id="run-name"
          label="Workflow"
          at="run/workflow/name"
          value={edit.text('/run/workflow/name')}
          onChange={(name) => edit.set('/run/workflow/name', name)}
        />
      </div>
      <TextField
        id="run-version"
        label="Version"
        at="run/workflow/version"
        value={edit.text('/run/workflow/version')}
        onChange={(version) => edit.set('/run/workflow/version', version)}
        placeholder="latest"
        description="A published version, or latest for the current one when it runs."
      />
      <JsonField
        id="run-input"
        label="Input"
        at="run/workflow/input"
        optional
        value={edit.value('/run/workflow/input')}
        onChange={(input) => edit.set('/run/workflow/input', input)}
      />
      <AwaitSwitch {...props} path="/run/await" />
    </>
  );
}

// Whether the step waits for what it runs; without waiting, the run goes on at once.
function AwaitSwitch({
  task,
  onChange,
  path,
}: TaskFormProps & { readonly path: string }) {
  const edit = taskEditor({ task, onChange });
  const waits = edit.value(path) !== false;

  return (
    <Field orientation="horizontal">
      <Switch
        id={`await-${path}`}
        checked={waits}
        onCheckedChange={(on) =>
          onChange(withMember(task, path, on ? undefined : false) as JsonObject)
        }
      />
      <FieldLabel htmlFor={`await-${path}`}>Wait for it to finish</FieldLabel>
    </Field>
  );
}

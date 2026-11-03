'use client';

import { isObject } from '../../../__shared_context/document/json';
import { JsonField, TextField } from './fields';
import { type TaskFormProps, taskEditor } from './task-form';

export function EmitForm(props: TaskFormProps) {
  const edit = taskEditor(props);

  return (
    <>
      <TextField
        id="emit-type"
        label="Event type"
        at="emit/event/with/type"
        mono
        value={edit.text('/emit/event/with/type')}
        onChange={(type) => edit.set('/emit/event/with/type', type)}
        placeholder="com.example.lead.routed"
        description="Subscriptions and waiting runs match events by this type."
      />
      <TextField
        id="emit-source"
        label="Source"
        at="emit/event/with/source"
        mono
        value={edit.text('/emit/event/with/source')}
        onChange={(source) => edit.set('/emit/event/with/source', source)}
        placeholder="/workflows/sales"
        description="Who sends it, as a URI."
      />
      <TextField
        id="emit-subject"
        label="Subject"
        at="emit/event/with/subject"
        optional
        value={edit.text('/emit/event/with/subject')}
        onChange={(subject) => edit.set('/emit/event/with/subject', subject)}
      />
      <JsonField
        id="emit-data"
        label="Data"
        at="emit/event/with/data"
        optional
        value={edit.value('/emit/event/with/data')}
        onChange={(data) => edit.set('/emit/event/with/data', data)}
        description="JSON, or an expression such as ${ .lead }."
      />
    </>
  );
}

export function ListenForm(props: TaskFormProps) {
  const edit = taskEditor(props);
  const to = edit.value('/listen/to');
  const one = isObject(to) && Object.keys(to).length === 1 && isObject(to.one);

  if (!one)
    return (
      <p className="text-sm text-muted-foreground">
        This step waits for several events or with a condition written as code;
        edit it in the code view.
      </p>
    );

  return (
    <TextField
      id="listen-type"
      label="Event type"
      at="listen/to/one/with/type"
      mono
      value={edit.text('/listen/to/one/with/type')}
      onChange={(type) => edit.set('/listen/to/one/with/type', type)}
      placeholder="com.example.approval.granted"
      description="The run waits here until an event of this type arrives, and goes on with it as data."
    />
  );
}

'use client';

import { type JsonObject, withMember } from '@/libs/document-text/json';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/libs/ui/components/card';
import { headerOf } from '../../__shared_context/document/draft';
import { TextField } from './forms/fields';

interface HeaderCardProps {
  readonly draft: JsonObject;
  readonly onChange: (draft: JsonObject) => void;
  // An existing workflow keeps its namespace and name; only a new one chooses them.
  readonly named: boolean;
}

export function HeaderCard({ draft, onChange, named }: HeaderCardProps) {
  const header = headerOf(draft);
  const set = (key: string, value: string) =>
    onChange(withMember(draft, `/document/${key}`, value));

  return (
    <Card>
      <CardHeader>
        <CardTitle>About this workflow</CardTitle>
        <CardDescription>
          {named
            ? 'Publishing adds this version; runs started later use it.'
            : 'Namespace and name identify the workflow; lower-case letters, digits and dashes.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_8rem]">
          <TextField
            id="document-namespace"
            label="Namespace"
            at="document/namespace"
            value={header.namespace}
            onChange={(value) => set('namespace', value)}
            placeholder="sales"
            mono
            readOnly={named}
          />
          <TextField
            id="document-name"
            label="Name"
            at="document/name"
            value={header.name}
            onChange={(value) => set('name', value)}
            placeholder="route-lead"
            mono
            readOnly={named}
          />
          <TextField
            id="document-version"
            label="Version"
            at="document/version"
            value={header.version}
            onChange={(value) => set('version', value)}
            placeholder="1.0.0"
            mono
          />
        </div>
        <TextField
          id="document-title"
          label="Title"
          at="document/title"
          optional
          value={header.title}
          onChange={(value) => set('title', value)}
          placeholder="Route new leads to the right team"
        />
        <TextField
          id="document-summary"
          label="Summary"
          at="document/summary"
          optional
          value={header.summary}
          onChange={(value) => set('summary', value)}
          placeholder="What it does, in one sentence"
        />
      </CardContent>
    </Card>
  );
}

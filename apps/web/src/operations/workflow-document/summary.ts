import { isObject, type JsonValue } from '@/libs/document-text/json';
import { durationOf, durationText } from './trigger';
import type { TaskEntry } from './tasks';

// One line that says what a task does, for the outline: "GET https://crm.example.com/leads".
export function summaryOf(entry: TaskEntry): string {
  const task = entry.task;

  switch (entry.kind) {
    case 'http': {
      const call = isObject(task.with) ? task.with : {};
      const method =
        typeof call.method === 'string' ? call.method.toUpperCase() : 'GET';
      return `${method} ${uriOf(call.endpoint) ?? ''}`.trim();
    }
    case 'set':
      return isObject(task.set)
        ? `Set ${Object.keys(task.set).join(', ') || 'nothing'}`
        : 'Set from an expression';
    case 'wait': {
      const duration = durationOf(task.wait);
      return duration === null ? 'Wait' : `Wait ${durationText(duration)}`;
    }
    case 'emit':
      return `Send ${textAt(task.emit, ['event', 'with', 'type']) ?? 'an event'}`;
    case 'listen':
      return `Wait for ${textAt(task.listen, ['to', 'one', 'with', 'type']) ?? 'events'}`;
    case 'raise':
      return `Fail: ${textAt(task.raise, ['error', 'title']) ?? textAt(task.raise, ['error', 'type']) ?? 'an error'}`;
    case 'switch':
      return Array.isArray(task.switch)
        ? `Choose between ${task.switch.length} paths`
        : 'Choose a path';
    case 'for':
      return `For each ${textAt(task.for, ['each']) ?? 'item'} in ${textAt(task.for, ['in']) ?? '…'}`;
    case 'fork': {
      const branches =
        isObject(task.fork) && Array.isArray(task.fork.branches)
          ? task.fork.branches.length
          : 0;
      const how =
        isObject(task.fork) && task.fork.compete === true ? ', first wins' : '';
      return `${countOf(branches, 'branch', 'branches')} side by side${how}`;
    }
    case 'try':
      return 'Try, and handle failures';
    case 'do':
      return Array.isArray(task.do) ? countOf(task.do.length, 'step') : 'Steps';
    case 'run-workflow': {
      const namespace = textAt(task.run, ['workflow', 'namespace']) ?? '';
      const name = textAt(task.run, ['workflow', 'name']) ?? '';
      return `Run ${namespace}/${name}`;
    }
    case 'run-script':
      return `Run ${scriptLanguageName(textAt(task.run, ['script', 'language']) ?? '')}`;
    case 'run-shell':
      return `$ ${textAt(task.run, ['shell', 'command']) ?? ''}`;
    case 'advanced':
      return typeof task.call === 'string'
        ? `Call ${task.call}`
        : 'Edited as code';
  }
}

export function uriOf(endpoint: JsonValue | undefined): string | null {
  if (typeof endpoint === 'string') return endpoint;

  if (isObject(endpoint) && typeof endpoint.uri === 'string')
    return endpoint.uri;

  return null;
}

function textAt(
  value: JsonValue | undefined,
  path: readonly string[],
): string | null {
  let node = value;

  for (const key of path) {
    if (!isObject(node)) return null;

    node = node[key];
  }

  return typeof node === 'string' ? node : null;
}

function countOf(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}

// A script language as people name it: `js` is JavaScript (DSL 1.0.3, script process).
export function scriptLanguageName(language: string): string {
  if (language === 'js' || language === 'javascript') return 'JavaScript';

  if (language === 'python') return 'Python';

  return language === '' ? 'a script' : language;
}

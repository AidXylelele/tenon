export class RuntimeArguments {
  static readonly NAMES = [
    'context',
    'input',
    'output',
    'secrets',
    'authorization',
    'task',
    'workflow',
    'runtime',
  ] as const;
}

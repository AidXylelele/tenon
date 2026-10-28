import { JqError, loadJq } from 'jq-wasm';
import type { JqOutcome, JqTask } from '../interfaces.js';

const PRELUDE = [
  'def env: error("env is not available");',
  'def input: error("input is not available");',
  'def inputs: error("inputs is not available");',
  'def input_filename: error("input_filename is not available");',
  'def debug: .;',
  'def debug(message): .;',
  'def stderr: .;',
  'def halt: error("halt is not available");',
  'def halt_error: error("halt_error is not available");',
  'def halt_error(code): error("halt_error is not available");',
  'def localtime: error("localtime is not available");',
  'def strflocaltime(format): error("strflocaltime is not available");',
  '{} as $ENV |',
].join(' ');

const PROGRAM_ECHO = / at <top-level>, line \d+, column \d+:[\s\S]*$/;

const ERROR_PREFIX = /^jq: error(?: \(at [^)]*\))?: /;

const jq = await loadJq();

export default function evaluate(task: JqTask): JqOutcome {
  const flags: string[] = [];

  for (const [name, value] of Object.entries(task.arguments)) {
    flags.push('--argjson', name, value);
  }

  const program = `${PRELUDE} (${task.program})`;

  try {
    const values = jq.json(task.input, program, flags);
    return { values };
  } catch (error) {
    if (!(error instanceof JqError)) throw error;

    const failure = error.stderr
      .trim()
      .replace(PROGRAM_ECHO, '')
      .replace(ERROR_PREFIX, '');
    return { failure };
  }
}

import { describe, expect, it } from 'vitest';
import type { Phase } from '@/libs/data-access/types';
import {
  controlsOf,
  isAdvancing,
  isUnended,
  phaseLabel,
  PHASES,
  phaseStatusOf,
  phaseTone,
  startedBy,
  taskStatusLabel,
  taskStatusTone,
  triggerLabel,
} from './vocabulary';

describe('the words and tones of a run', () => {
  it('every_phase_has_a_word_and_a_tone', () => {
    expect(PHASES).toEqual([
      'pending',
      'running',
      'waiting',
      'suspended',
      'completed',
      'faulted',
      'cancelled',
    ]);
    expect(phaseLabel('faulted')).toBe('Faulted');
    expect(phaseTone('suspended')).toBe('held');
  });

  it.each([
    ['pending', { tone: 'idle', label: 'Pending', live: true }],
    ['running', { tone: 'busy', label: 'Running', live: true }],
    ['waiting', { tone: 'waiting', label: 'Waiting', live: false }],
    ['completed', { tone: 'done', label: 'Completed', live: false }],
  ] as const)('a_%s_run_shows_as_its_status', (phase, status) => {
    expect(phaseStatusOf(phase)).toEqual(status);
  });

  it.each([
    ['pending', true, true],
    ['running', true, true],
    ['waiting', true, true],
    ['suspended', true, false],
    ['completed', false, false],
    ['faulted', false, false],
    ['cancelled', false, false],
  ] as const)(
    'a_%s_run_is_unended_%s_and_advancing_%s',
    (phase: Phase, unended, advancing) => {
      expect(isUnended(phase)).toBe(unended);
      expect(isAdvancing(phase)).toBe(advancing);
    },
  );

  it('a_task_status_has_a_word_and_a_tone', () => {
    expect(taskStatusLabel('skipped')).toBe('Skipped');
    expect(taskStatusTone('faulted')).toBe('failed');
  });

  it('what_started_a_run_reads_as_a_column_and_as_a_phrase', () => {
    expect(triggerLabel('schedule')).toBe('Schedule');
    expect(startedBy('restart')).toBe('Run again by hand');
  });
});

describe('the controls a phase allows', () => {
  it('a_running_run_is_held_or_cancelled', () => {
    expect(controlsOf('running')).toEqual({
      suspend: true,
      resume: false,
      cancel: true,
      restart: false,
      remove: false,
    });
  });

  it('a_held_run_is_resumed_or_cancelled', () => {
    expect(controlsOf('suspended')).toEqual({
      suspend: false,
      resume: true,
      cancel: true,
      restart: false,
      remove: false,
    });
  });

  it('an_ended_run_is_run_again_or_removed', () => {
    expect(controlsOf('faulted')).toEqual({
      suspend: false,
      resume: false,
      cancel: false,
      restart: true,
      remove: true,
    });
  });
});

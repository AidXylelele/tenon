import { describe, expect, it } from 'vitest';
import { durationText, relativeText } from './format';

const NOW = Date.parse('2026-11-03T12:00:00Z');
const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe('a time and a duration in words', () => {
  it.each([
    [-2 * SECOND, 'just now'],
    [-30 * SECOND, '30 seconds ago'],
    [-3 * MINUTE, '3 minutes ago'],
    [2 * HOUR, 'in 2 hours'],
    [-1 * DAY, 'yesterday'],
    [-45 * DAY, 'last month'],
    [-800 * DAY, '2 years ago'],
  ])('%d_ms_from_now_reads_as_%s', (offset, text) => {
    const at = NOW + offset;

    expect(relativeText(at, NOW)).toBe(text);
  });

  it.each([
    [-5, '0 ms'],
    [850, '850 ms'],
    [4_200, '4.2 s'],
    [42_000, '42 s'],
    [3 * MINUTE + 5 * SECOND, '3 min 5 s'],
    [2 * HOUR + 10 * MINUTE, '2 h 10 min'],
    [3 * DAY + 4 * HOUR, '3 d 4 h'],
  ])('%d_ms_reads_as_%s', (milliseconds, text) => {
    expect(durationText(milliseconds)).toBe(text);
  });
});

import { describe, it, expect } from 'vitest';
import { KNOWN_JOBS, JOB_FREQUENCIES } from './job-runner';

describe('job-runner constants', () => {
  it('KNOWN_JOBS and JOB_FREQUENCIES have identical keys', () => {
    const freqKeys = Object.keys(JOB_FREQUENCIES).sort();
    const knownSorted = [...KNOWN_JOBS].sort();
    expect(knownSorted).toEqual(freqKeys);
  });

  it('all JOB_FREQUENCIES values are positive numbers', () => {
    for (const [name, freq] of Object.entries(JOB_FREQUENCIES)) {
      expect(freq, `${name} frequency must be positive`).toBeGreaterThan(0);
    }
  });
});

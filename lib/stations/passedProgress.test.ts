import { describe, expect, it } from 'vitest';
import { GUARANTEE_STATION_COUNT, trialStationsPassed } from './passedProgress';

describe('trialStationsPassed', () => {
  it('is 1 of 200 when the free station passed', () => {
    expect(trialStationsPassed('Pass', 8)).toMatchObject({ passed: 1, attempted: 1 });
  });

  it('counts Bare Pass, because the report already tells them "Passed"', () => {
    expect(trialStationsPassed('Bare Pass', 6).passed).toBe(1);
  });

  it('is 0 of 200 for a fail, and still counts the attempt', () => {
    expect(trialStationsPassed('Bare Fail', 5)).toMatchObject({ passed: 0, attempted: 1 });
    expect(trialStationsPassed('Fail', 3)).toMatchObject({ passed: 0, attempted: 1 });
  });

  it('treats a missing verdict as not yet passed', () => {
    expect(trialStationsPassed(null, null).passed).toBe(0);
    expect(trialStationsPassed(undefined, undefined).passed).toBe(0);
  });

  it('refuses a pass with no real score, matching the dashboard rule', () => {
    // A marked-but-empty transcript can carry a verdict without being a
    // consultation; passTracking discards these and so must this.
    expect(trialStationsPassed('Pass', 0).passed).toBe(0);
    expect(trialStationsPassed('Pass', -1).passed).toBe(0);
  });

  it('reports the guarantee total and a percentage of it', () => {
    const p = trialStationsPassed('Pass', 8);
    expect(p.total).toBe(GUARANTEE_STATION_COUNT);
    expect(p.percent).toBeCloseTo(0.5);
  });
});

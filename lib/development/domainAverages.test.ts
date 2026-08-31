import { describe, expect, it } from 'vitest';

import {
  sparklinePoints,
  summariseDomains,
  trajectoryOf,
  type DomainCasePoints,
} from './domainAverages';
import { isTrendReportV2 } from '@/lib/clinical-master/trendTypes';

/** A case that graded all three domains. Clinical management is already weighted. */
function marked(
  sessionId: string,
  dataGathering: number,
  clinicalManagement: number,
  relating: number,
): DomainCasePoints {
  return {
    sessionId,
    points: {
      data_gathering: dataGathering,
      clinical_management: clinicalManagement,
      relating_to_others: relating,
    },
  };
}

describe('trajectoryOf', () => {
  it('needs more than three cases before it will call a direction', () => {
    expect(trajectoryOf([0, 0, 3])).toBe('steady');
  });

  it('reads a rise in the last three against everything before them', () => {
    expect(trajectoryOf([1, 1, 1, 2, 2, 2])).toBe('improving');
  });

  it('reads a fall the same way', () => {
    expect(trajectoryOf([3, 3, 3, 1, 1, 1])).toBe('slipping');
  });

  it('holds steady inside the noise threshold', () => {
    // The last three mean 2.1 against 2.0 — a tenth of a grade point is not a
    // direction, and flipping the arrow on it would make it meaningless.
    expect(trajectoryOf([2, 2, 2, 2, 2.1, 2.2])).toBe('steady');
  });
});

describe('summariseDomains', () => {
  it('averages each domain over the window and keeps the case order', () => {
    const averages = summariseDomains([marked('a', 1, 3, 2), marked('b', 2, 4.5, 3)]);
    const dataGathering = averages[0];

    expect(dataGathering.domain).toBe('data_gathering');
    expect(dataGathering.mean).toBeCloseTo(1.5);
    expect(dataGathering.series).toEqual([1, 2]);
  });

  it('scores clinical management out of 4.5, the weighted maximum', () => {
    const [, clinicalManagement] = summariseDomains([marked('a', 3, 4.5, 3)]);
    expect(clinicalManagement.max).toBe(4.5);
    expect(clinicalManagement.mean).toBe(4.5);
  });

  it('skips a domain a case never graded rather than counting it as zero', () => {
    const averages = summariseDomains([
      marked('a', 2, 3, 2),
      { sessionId: 'b', points: { data_gathering: 3 } },
    ]);

    expect(averages[0].series).toEqual([2, 3]);
    // Clinical management was graded once; the ungraded case must not drag it
    // toward zero, which would read as a failed domain that was never marked.
    expect(averages[1].series).toEqual([3]);
    expect(averages[1].mean).toBe(3);
  });

  it('reports a null mean when nothing in the window is graded', () => {
    expect(summariseDomains([]).every((average) => average.mean === null)).toBe(true);
  });
});

describe('sparklinePoints', () => {
  it('scales to the domain maximum, not to the values present', () => {
    // Two identical grades draw a flat line at their own height, not a line
    // sweeping the full box.
    expect(sparklinePoints([1.5, 1.5], 3, 100, 20)).toBe('0.0,10.0 100.0,10.0');
  });

  it('draws a single case as a flat segment', () => {
    expect(sparklinePoints([3], 3, 100, 20)).toBe('0,0.0 100,0.0');
  });

  it('has nothing to draw for an empty series', () => {
    expect(sparklinePoints([], 3, 100, 20)).toBe('');
  });
});

describe('isTrendReportV2', () => {
  it('accepts a v2 payload', () => {
    expect(isTrendReportV2({ version: 2, patterns: [] })).toBe(true);
  });

  it('rejects a v1 row, which carries different fields under different meanings', () => {
    expect(isTrendReportV2({ recurring_themes: [], confidence: 'low' })).toBe(false);
  });

  it('rejects a v2 stamp with no patterns array', () => {
    expect(isTrendReportV2({ version: 2 })).toBe(false);
  });

  it('rejects nothing at all', () => {
    expect(isTrendReportV2(null)).toBe(false);
  });
});

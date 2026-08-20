import { describe, expect, it } from 'vitest';
import {
  flattenSessionRows,
  passedStationIds,
  reduceStationPassMap,
  type StationAttemptRow,
} from './passTracking';

function attempt(overrides: Partial<StationAttemptRow> = {}): StationAttemptRow {
  return {
    station_id: 'station-a',
    verdict: 'Pass',
    weighted_score: 8.5,
    ...overrides,
  };
}

describe('reduceStationPassMap — empty and unusable input', () => {
  it('returns an empty map for no attempts', () => {
    expect(reduceStationPassMap([]).size).toBe(0);
  });

  it('ignores rows with no station', () => {
    expect(reduceStationPassMap([attempt({ station_id: null })]).size).toBe(0);
  });
});

describe('reduceStationPassMap — a single scored pass', () => {
  const state = reduceStationPassMap([attempt({ verdict: 'Bare Pass', weighted_score: 6.2 })]).get(
    'station-a',
  );

  it('marks the station passed', () => {
    expect(state?.passed).toBe(true);
  });

  it('records the verdict and score of that attempt', () => {
    expect(state?.bestVerdict).toBe('Bare Pass');
    expect(state?.bestScore).toBe(6.2);
    expect(state?.attempts).toBe(1);
  });
});

describe('reduceStationPassMap — best attempt wins', () => {
  const map = reduceStationPassMap([
    attempt({ verdict: 'Fail', weighted_score: 3.1 }),
    attempt({ verdict: 'Pass', weighted_score: 9.0 }),
    attempt({ verdict: 'Bare Fail', weighted_score: 5.0 }),
  ]);
  const state = map.get('station-a');

  it('keeps the pass even though a later attempt failed', () => {
    expect(state?.passed).toBe(true);
    expect(state?.bestVerdict).toBe('Pass');
  });

  it('reports the highest score, not the latest', () => {
    expect(state?.bestScore).toBe(9.0);
  });

  it('counts every attempt', () => {
    expect(state?.attempts).toBe(3);
  });
});

describe('reduceStationPassMap — attempted but never passed', () => {
  const state = reduceStationPassMap([
    attempt({ verdict: 'Fail', weighted_score: 2.0 }),
    attempt({ verdict: 'Bare Fail', weighted_score: 5.4 }),
  ]).get('station-a');

  it('does not mark the station passed', () => {
    expect(state?.passed).toBe(false);
  });

  it('surfaces the best fail band so the UI can show how close it was', () => {
    expect(state?.bestVerdict).toBe('Bare Fail');
    expect(state?.bestScore).toBe(5.4);
  });
});

describe('reduceStationPassMap — legacy zero-score artefacts', () => {
  // A verdict with weighted_score 0 is the engine marking an empty pre-engine
  // transcript, not a consultation the user actually failed.
  it('never lets an artefact fail set a verdict or a score', () => {
    const state = reduceStationPassMap([
      attempt({ verdict: 'Fail', weighted_score: 0 }),
      attempt({ verdict: 'Fail', weighted_score: -1 }),
    ]).get('station-a');

    expect(state?.passed).toBe(false);
    expect(state?.bestVerdict).toBeNull();
    expect(state?.bestScore).toBeNull();
    expect(state?.attempts).toBe(2);
  });

  it('never lets an artefact PASS count as a pass', () => {
    const state = reduceStationPassMap([attempt({ verdict: 'Pass', weighted_score: 0 })]).get(
      'station-a',
    );

    expect(state?.passed).toBe(false);
    expect(state?.bestVerdict).toBeNull();
  });

  it('leaves a real pass intact when an artefact sits alongside it', () => {
    const state = reduceStationPassMap([
      attempt({ verdict: 'Fail', weighted_score: 0 }),
      attempt({ verdict: 'Pass', weighted_score: 7.7 }),
    ]).get('station-a');

    expect(state?.passed).toBe(true);
    expect(state?.bestScore).toBe(7.7);
  });
});

describe('reduceStationPassMap — unmarked and malformed rows', () => {
  it('counts an unmarked session as an attempt with no verdict', () => {
    const state = reduceStationPassMap([
      attempt({ verdict: null, weighted_score: null }),
    ]).get('station-a');

    expect(state?.passed).toBe(false);
    expect(state?.bestVerdict).toBeNull();
    expect(state?.attempts).toBe(1);
  });

  it('ignores a verdict string the schema does not know', () => {
    const state = reduceStationPassMap([
      attempt({ verdict: 'Merit', weighted_score: 9.9 }),
    ]).get('station-a');

    expect(state?.bestVerdict).toBeNull();
    expect(state?.bestScore).toBeNull();
  });

  it('reads numeric scores that arrive as strings', () => {
    // Postgres numeric columns can surface as strings through PostgREST.
    const state = reduceStationPassMap([
      attempt({ verdict: 'Pass', weighted_score: '8.25' }),
    ]).get('station-a');

    expect(state?.passed).toBe(true);
    expect(state?.bestScore).toBe(8.25);
  });
});

describe('reduceStationPassMap — several stations', () => {
  const map = reduceStationPassMap([
    attempt({ station_id: 'station-a', verdict: 'Pass', weighted_score: 8.5 }),
    attempt({ station_id: 'station-b', verdict: 'Fail', weighted_score: 4.0 }),
    attempt({ station_id: 'station-c', verdict: 'Fail', weighted_score: 0 }),
  ]);

  it('keeps each station tally separate', () => {
    expect(map.get('station-a')?.passed).toBe(true);
    expect(map.get('station-b')?.passed).toBe(false);
    expect(map.get('station-c')?.bestVerdict).toBeNull();
  });

  it('lists only the passed stations', () => {
    expect(passedStationIds(map)).toEqual(new Set(['station-a']));
  });
});

describe('flattenSessionRows', () => {
  it('flattens the 1:1 object shape PostgREST returns', () => {
    expect(
      flattenSessionRows([
        { station_id: 'station-a', session_results: { verdict: 'Pass', weighted_score: 8.5 } },
      ]),
    ).toEqual([{ station_id: 'station-a', verdict: 'Pass', weighted_score: 8.5 }]);
  });

  it('tolerates the array shape', () => {
    expect(
      flattenSessionRows([
        { station_id: 'station-a', session_results: [{ verdict: 'Fail', weighted_score: 3 }] },
      ]),
    ).toEqual([{ station_id: 'station-a', verdict: 'Fail', weighted_score: 3 }]);
  });

  it('turns a session with no result into an unscored attempt', () => {
    expect(
      flattenSessionRows([{ station_id: 'station-a', session_results: null }]),
    ).toEqual([{ station_id: 'station-a', verdict: null, weighted_score: null }]);
  });

  it('returns nothing when the query errored and handed back no array', () => {
    expect(flattenSessionRows(null)).toEqual([]);
  });
});

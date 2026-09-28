import { describe, expect, it } from 'vitest';

import {
  DOMAIN_WINDOW,
  MARKED_SESSION_COLUMNS,
  domainCaseSeriesFromRows,
  type MarkedSessionRow,
} from './domainCaseSeries';

/** A marked session row as PostgREST returns it, newest-first order is the caller's job. */
function row(
  id: string,
  weightedScore: number | string | null,
  domains: unknown = [
    { domain: 'data_gathering', grade_points: 2 },
    { domain: 'clinical_management', grade_points: 2 },
    { domain: 'relating_to_others', grade_points: 3 },
  ],
): MarkedSessionRow {
  return {
    id,
    started_at: '2026-09-01T10:00:00Z',
    completed_at: '2026-09-01T10:15:00Z',
    session_results: weightedScore === null ? null : { domains, weighted_score: weightedScore },
  };
}

describe('domainCaseSeriesFromRows', () => {
  it('turns newest-first rows into an oldest → newest series', () => {
    const series = domainCaseSeriesFromRows([row('newest', 6), row('middle', 5), row('oldest', 4)]);
    expect(series.map((entry) => entry.sessionId)).toEqual(['oldest', 'middle', 'newest']);
  });

  it('weights clinical management through the shared domain reading', () => {
    const [entry] = domainCaseSeriesFromRows([row('a', 6)]);
    expect(entry.points).toEqual({
      data_gathering: 2,
      clinical_management: 3,
      relating_to_others: 3,
    });
  });

  it('drops zero-score results and sessions with no result row', () => {
    // A zero is the engine marking an empty pre-engine transcript; counting its
    // grades would drag every average down for a consultation that never happened.
    const series = domainCaseSeriesFromRows([row('real', 5), row('empty', 0), row('unmarked', null)]);
    expect(series.map((entry) => entry.sessionId)).toEqual(['real']);
  });

  it('reads a weighted score PostgREST handed back as a string', () => {
    const series = domainCaseSeriesFromRows([row('numeric-string', '4.5'), row('zero-string', '0')]);
    expect(series.map((entry) => entry.sessionId)).toEqual(['numeric-string']);
  });

  it('drops a scored row whose domains blob carries no readable grade', () => {
    const series = domainCaseSeriesFromRows([row('graded', 5), row('blank', 5, [])]);
    expect(series.map((entry) => entry.sessionId)).toEqual(['graded']);
  });

  it('keeps only the newest `window` marked cases, counted after the filter', () => {
    const rows = [
      row('n1', 5),
      row('zero', 0),
      row('n2', 5),
      row('n3', 5),
      row('n4', 5),
    ];
    // The zero row does not use up a slot: three marked cases, not two.
    const series = domainCaseSeriesFromRows(rows, 3);
    expect(series.map((entry) => entry.sessionId)).toEqual(['n3', 'n2', 'n1']);
  });

  it('defaults to the report window', () => {
    const rows = Array.from({ length: DOMAIN_WINDOW + 5 }, (_, index) => row(`s${index}`, 5));
    expect(domainCaseSeriesFromRows(rows)).toHaveLength(DOMAIN_WINDOW);
  });
});

describe('MARKED_SESSION_COLUMNS', () => {
  it('asks for exactly what the mapping reads', () => {
    expect(MARKED_SESSION_COLUMNS.replace(/\s/g, '')).toBe(
      'id,started_at,completed_at,session_results(domains,weighted_score)',
    );
  });
});

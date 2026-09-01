import { describe, expect, it } from 'vitest';
import { clientXToViewX, nearestPointIndex } from './ScoreTrend';

/**
 * The two bits of arithmetic the cursor depends on, neither of which is visible
 * when it is wrong — a cursor that lands one case to the left is a readout
 * confidently describing the wrong consultation.
 */

describe('clientXToViewX — the viewBox is fixed at 520, the rendered width is not', () => {
  it('scales a client pixel into viewBox units', () => {
    // Rendered half as wide as the viewBox: 130px in is 260 viewBox units in.
    expect(clientXToViewX(130, { left: 0, width: 260 })).toBe(260);
  });

  it('subtracts the box offset before scaling', () => {
    expect(clientXToViewX(100, { left: 100, width: 260 })).toBe(0);
    expect(clientXToViewX(360, { left: 100, width: 260 })).toBe(520);
  });

  it('is 1:1 only when the box happens to be 520 wide', () => {
    expect(clientXToViewX(300, { left: 0, width: 520 })).toBe(300);
  });

  it('has no answer for a collapsed container, and does not invent zero', () => {
    expect(clientXToViewX(120, { left: 0, width: 0 })).toBeNull();
  });
});

describe('nearestPointIndex', () => {
  // The plot spans viewBox x 14..506 (520 less 14 of padding each side).
  const FIRST = 14;
  const LAST = 506;

  it('snaps the ends of the plot to the ends of the series', () => {
    expect(nearestPointIndex(FIRST, 10)).toBe(0);
    expect(nearestPointIndex(LAST, 10)).toBe(9);
  });

  it('snaps to the nearest point, not the one before', () => {
    const step = (LAST - FIRST) / 9;
    expect(nearestPointIndex(FIRST + step * 3, 10)).toBe(3);
    expect(nearestPointIndex(FIRST + step * 3.4, 10)).toBe(3);
    expect(nearestPointIndex(FIRST + step * 3.6, 10)).toBe(4);
  });

  it('clamps a drag that has left the chart', () => {
    expect(nearestPointIndex(-400, 10)).toBe(0);
    expect(nearestPointIndex(9000, 10)).toBe(9);
  });

  it('carries the same single-point guard as the layout it inverts', () => {
    // x() puts one point at the middle and has no gradient to divide by; the
    // inverse must not divide by zero either.
    expect(nearestPointIndex(260, 1)).toBe(0);
    expect(nearestPointIndex(9000, 1)).toBe(0);
    expect(nearestPointIndex(0, 0)).toBe(0);
  });
});

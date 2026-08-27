import { describe, expect, it } from 'vitest';
import {
  SWEEP_DEGREES,
  arcBoxHeight,
  arcPath,
  fractionAngle,
  gaugeFraction,
  polarPoint,
} from './ArcGauge';

/**
 * The dial's geometry, not its pixels. A wrong angle here is the difference
 * between a pass mark tick sitting at 57% of the arc and sitting somewhere
 * meaningless, and that is a correctness bug in a score display, not a style
 * preference — so it gets tests even though the drawing itself does not.
 */

const CX = 100;
const CY = 100;
const R = 80;

describe('polarPoint — degrees run clockwise from 12 o\'clock', () => {
  it('puts 0° straight up', () => {
    expect(polarPoint(CX, CY, R, 0)).toEqual({ x: 100, y: 20 });
  });

  it('puts 90° to the right and 180° straight down', () => {
    expect(polarPoint(CX, CY, R, 90)).toEqual({ x: 180, y: 100 });
    expect(polarPoint(CX, CY, R, 180)).toEqual({ x: 100, y: 180 });
  });

  it('mirrors negative angles to the left', () => {
    expect(polarPoint(CX, CY, R, -90)).toEqual({ x: 20, y: 100 });
  });

  it('lands the dial\'s two ends level with each other, below the centre', () => {
    const left = polarPoint(CX, CY, R, -SWEEP_DEGREES / 2);
    const right = polarPoint(CX, CY, R, SWEEP_DEGREES / 2);
    expect(left.y).toBe(right.y);
    expect(left.y).toBeGreaterThan(CY);
    expect(left.x).toBeLessThan(CX);
    expect(right.x).toBeGreaterThan(CX);
  });
});

describe('arcPath', () => {
  it('draws clockwise, and takes the long way round for a 270° sweep', () => {
    const d = arcPath(CX, CY, R, -135, 135);
    // "A rx ry rotation large-arc-flag sweep-flag x y"
    expect(d).toMatch(/A 80 80 0 1 1 /);
    expect(d.startsWith('M ')).toBe(true);
  });

  it('takes the short way round for a sweep under 180°', () => {
    expect(arcPath(CX, CY, R, -45, 45)).toMatch(/A 80 80 0 0 1 /);
  });
});

describe('gaugeFraction', () => {
  it('is the plain ratio inside the scale', () => {
    expect(gaugeFraction(6, 10.5)).toBeCloseTo(0.5714, 4);
  });

  it('clamps to the ends rather than overshooting the dial', () => {
    expect(gaugeFraction(12, 10.5)).toBe(1);
    expect(gaugeFraction(-3, 10.5)).toBe(0);
  });

  it('returns 0 rather than NaN for a missing or zero maximum', () => {
    expect(gaugeFraction(6, 0)).toBe(0);
    expect(gaugeFraction(6, Number.NaN)).toBe(0);
    expect(gaugeFraction(Number.NaN, 10.5)).toBe(0);
  });
});

describe('fractionAngle', () => {
  it('starts and ends at the dial\'s two ends', () => {
    expect(fractionAngle(0)).toBe(-SWEEP_DEGREES / 2);
    expect(fractionAngle(1)).toBe(SWEEP_DEGREES / 2);
  });

  it('puts the halfway point at the top of the dial', () => {
    expect(fractionAngle(0.5)).toBe(0);
  });

  it('puts the SCA pass mark just past the top, on the right', () => {
    // 6.0 / 10.5 — the tick has to sit clockwise of 12 o'clock or the gauge
    // is telling people the pass mark is easier than it is.
    const angle = fractionAngle(6 / 10.5);
    expect(angle).toBeGreaterThan(0);
    expect(angle).toBeLessThan(SWEEP_DEGREES / 2);
  });
});

describe('arcBoxHeight', () => {
  it('crops the empty space a 270° dial leaves below its ends', () => {
    expect(arcBoxHeight(224, 100, 13)).toBeLessThan(224);
  });

  it('still contains the lowest painted pixel of the arc', () => {
    const size = 224;
    const radius = 100;
    const thickness = 13;
    const lowest = polarPoint(size / 2, size / 2, radius, SWEEP_DEGREES / 2).y + thickness / 2;
    expect(arcBoxHeight(size, radius, thickness)).toBeGreaterThanOrEqual(lowest);
  });
});

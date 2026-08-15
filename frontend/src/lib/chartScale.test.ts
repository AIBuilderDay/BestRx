import { describe, expect, it } from 'vitest';
import {
  areaPath,
  bandPath,
  hitBands,
  linePath,
  niceScale,
  sparklineGeometry,
  toPoints,
  TREND_BOX,
  xAt,
  yAt,
} from './chartScale';

describe('niceScale', () => {
  it('snaps the axis top to a round multiple at or above the data max', () => {
    const scale = niceScale(4801);
    expect(scale.top).toBeGreaterThanOrEqual(4801);
    expect(scale.top).toBeCloseTo(scale.step * 4, 6);
    expect(scale.ticks).toHaveLength(5);
    expect(scale.ticks[0]).toBe(0);
  });

  it('survives degenerate inputs without dividing by zero', () => {
    for (const input of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const scale = niceScale(input);
      expect(Number.isFinite(scale.step), String(input)).toBe(true);
      expect(scale.step, String(input)).toBeGreaterThan(0);
    }
  });
});

describe('plot geometry', () => {
  it('spans the plot area edge to edge', () => {
    expect(xAt(TREND_BOX, 0, 4)).toBeCloseTo(62, 6);
    expect(xAt(TREND_BOX, 3, 4)).toBeCloseTo(884, 6);
  });

  it('centres a single point rather than dividing by zero', () => {
    expect(Number.isFinite(xAt(TREND_BOX, 0, 1))).toBe(true);
  });

  it('maps value zero to the baseline and the max to the top margin', () => {
    expect(yAt(TREND_BOX, 0, 100)).toBeCloseTo(210, 6);
    expect(yAt(TREND_BOX, 100, 100)).toBeCloseTo(14, 6);
  });

  it('clamps out-of-range values into the plot area', () => {
    expect(yAt(TREND_BOX, 500, 100)).toBeCloseTo(14, 6);
    expect(yAt(TREND_BOX, -50, 100)).toBeCloseTo(210, 6);
  });

  it('builds paths with no NaN in them', () => {
    const points = toPoints(TREND_BOX, [10, 40, 25, 0], 40);
    expect(linePath(points)).not.toMatch(/NaN/);
    expect(areaPath(points, 210)).toMatch(/Z$/);
    expect(bandPath(points, toPoints(TREND_BOX, [5, 20, 12, 0], 40))).toMatch(/Z$/);
  });

  it('returns empty paths for empty input rather than throwing', () => {
    expect(linePath([])).toBe('');
    expect(areaPath([], 0)).toBe('');
    expect(bandPath([], [])).toBe('');
  });
});

describe('hitBands', () => {
  it('never extends past the plot area', () => {
    const bands = hitBands(TREND_BOX, 4);
    expect(bands).toHaveLength(4);
    expect(bands[0].x).toBeGreaterThanOrEqual(TREND_BOX.left);
    const last = bands[bands.length - 1];
    expect(last.x + last.width).toBeLessThanOrEqual(TREND_BOX.width - TREND_BOX.right + 0.001);
  });

  it('returns nothing for an empty series', () => {
    expect(hitBands(TREND_BOX, 0)).toEqual([]);
  });
});

describe('sparklineGeometry', () => {
  it('reports a flat series as unusable rather than drawing a fake trend', () => {
    const flat = sparklineGeometry([5, 5, 5, 5], 76, 22, 3);
    expect(flat.usable).toBe(false);
    expect(flat.direction).toBe('flat');
    expect(flat.d).not.toMatch(/NaN/);
  });

  it('treats a cumulative jump as readable movement', () => {
    expect(sparklineGeometry([0, 0, 0, 3], 76, 22, 3).usable).toBe(true);
    expect(sparklineGeometry([0, 0, 0, 0], 76, 22, 3).usable).toBe(false);
  });

  it('reports direction from first to last', () => {
    expect(sparklineGeometry([1, 2, 3, 9], 76, 22, 3).direction).toBe('rising');
    expect(sparklineGeometry([9, 3, 2, 1], 76, 22, 3).direction).toBe('falling');
  });
});

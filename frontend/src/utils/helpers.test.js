import { describe, expect, it } from 'vitest';
import { formatDate, getIntensityClass, getSentimentInfo, timeAgo } from './helpers';

describe('formatDate', () => {
  it('formats an ISO date string as "Mon D, YYYY"', () => {
    expect(formatDate('2026-03-15T00:00:00Z')).toBe('Mar 15, 2026');
  });
});

describe('timeAgo', () => {
  it('returns "just now" for the current moment', () => {
    expect(timeAgo(new Date().toISOString())).toBe('just now');
  });

  it('returns minutes ago for a few minutes back', () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    expect(timeAgo(fiveMinAgo)).toBe('5m ago');
  });
});

describe('getSentimentInfo', () => {
  it('labels a high compound score as Positive', () => {
    expect(getSentimentInfo(0.5).label).toBe('Positive');
  });

  it('labels a mid compound score as Neutral', () => {
    expect(getSentimentInfo(0).label).toBe('Neutral');
  });

  it('labels a low compound score as Negative', () => {
    expect(getSentimentInfo(-0.5).label).toBe('Negative');
  });
});

describe('getIntensityClass', () => {
  it('buckets low intensities', () => {
    expect(getIntensityClass(2)).toBe('intensity-low');
  });

  it('buckets medium intensities', () => {
    expect(getIntensityClass(5)).toBe('intensity-medium');
  });

  it('buckets high intensities', () => {
    expect(getIntensityClass(9)).toBe('intensity-high');
  });
});

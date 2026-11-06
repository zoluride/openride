import { describe, expect, it } from 'vitest';

import {
  calculateTopUp,
  STABILISATION_GROSS_TARGET_KOBO,
  STABILISATION_MAX_TOP_UP_KOBO,
} from './stabilisation';

describe('calculateTopUp', () => {
  it('requires at least ten online hours and eight completed trips', () => {
    expect(calculateTopUp(1_000_000, 9.99, 8)).toBe(0);
    expect(calculateTopUp(1_000_000, 10, 7)).toBe(0);
  });

  it('allows the maximum allocation at the eligibility boundaries', () => {
    expect(calculateTopUp(1_700_000, 10, 8)).toBe(STABILISATION_MAX_TOP_UP_KOBO);
  });

  it('limits allocation to the remaining target gap when that is lower than the cap', () => {
    expect(calculateTopUp(1_850_000, 12, 9)).toBe(150_000);
    expect(calculateTopUp(STABILISATION_GROSS_TARGET_KOBO - 1, 10, 8)).toBe(1);
  });

  it('returns no allocation at or above the gross target', () => {
    expect(calculateTopUp(STABILISATION_GROSS_TARGET_KOBO, 10, 8)).toBe(0);
    expect(calculateTopUp(STABILISATION_GROSS_TARGET_KOBO + 1, 10, 8)).toBe(0);
  });
});
import { describe, expect, it } from 'vitest';

import {
  calculateTopUp,
  STABILISATION_GROSS_TARGET_KOBO,
  STABILISATION_MAX_TOP_UP_KOBO,
  STABILISATION_MIN_HOURS_ONLINE,
  STABILISATION_MIN_TRIPS,
} from './stabilisation';

describe('calculateTopUp', () => {
  it('requires at least eight online hours and six completed trips', () => {
    expect(calculateTopUp(1_000_000, STABILISATION_MIN_HOURS_ONLINE - 0.01, 6)).toBe(0);
    expect(calculateTopUp(1_000_000, 8, STABILISATION_MIN_TRIPS - 1)).toBe(0);
  });

  it('allows the maximum allocation at the eligibility boundaries', () => {
    expect(calculateTopUp(1_700_000, STABILISATION_MIN_HOURS_ONLINE, STABILISATION_MIN_TRIPS)).toBe(
      STABILISATION_MAX_TOP_UP_KOBO,
    );
  });

  it('allocates the maximum top-up for the requested demo scenario', () => {
    expect(calculateTopUp(1_400_000, 8.5, 6)).toBe(STABILISATION_MAX_TOP_UP_KOBO);
  });

  it('limits allocation to the remaining target gap when that is lower than the cap', () => {
    expect(calculateTopUp(1_850_000, 12, 9)).toBe(150_000);
    expect(
      calculateTopUp(STABILISATION_GROSS_TARGET_KOBO - 1, STABILISATION_MIN_HOURS_ONLINE, STABILISATION_MIN_TRIPS),
    ).toBe(1);
  });

  it('returns no allocation at or above the gross target', () => {
    expect(
      calculateTopUp(STABILISATION_GROSS_TARGET_KOBO, STABILISATION_MIN_HOURS_ONLINE, STABILISATION_MIN_TRIPS),
    ).toBe(0);
    expect(
      calculateTopUp(
        STABILISATION_GROSS_TARGET_KOBO + 1,
        STABILISATION_MIN_HOURS_ONLINE,
        STABILISATION_MIN_TRIPS,
      ),
    ).toBe(0);
  });
});
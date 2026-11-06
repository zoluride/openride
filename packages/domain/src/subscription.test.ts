import { describe, expect, it } from 'vitest';

import { calculateDailyDeduction, isFreeDay, remainingCapForDay } from './subscription';

describe('calculateDailyDeduction', () => {
  it.each([
    [0, 0],
    [399_900, 0],
    [400_000, 50_000],
    [699_900, 50_000],
    [700_000, 100_000],
    [999_900, 100_000],
    [1_000_000, 150_000],
    [5_000_000, 150_000],
  ])('gross earnings of %i kobo yield a deduction of %i kobo', (grossKobo, deductionKobo) => {
    expect(calculateDailyDeduction(grossKobo)).toBe(deductionKobo);
  });
});

describe('remainingCapForDay', () => {
  it('subtracts deductions already taken from the daily cap', () => {
    expect(remainingCapForDay(50_000)).toBe(100_000);
  });

  it('does not return a negative remaining cap', () => {
    expect(remainingCapForDay(200_000)).toBe(0);
  });
});

describe('isFreeDay', () => {
  it('is free below the threshold but not at the threshold', () => {
    expect(isFreeDay(399_999)).toBe(true);
    expect(isFreeDay(400_000)).toBe(false);
  });
});
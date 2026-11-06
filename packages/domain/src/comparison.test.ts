import { describe, expect, it } from 'vitest';

import { calculateCompetitorComparison } from './comparison';

describe('calculateCompetitorComparison', () => {
  it.each([
    [0, 0, 0, 0, 0, 0, 0],
    [300_000, 0, 300_000, 225_000, 240_000, 75_000, 60_000],
    [1_000_000, 150_000, 850_000, 750_000, 800_000, 100_000, 50_000],
    [3_000_000, 150_000, 2_850_000, 2_250_000, 2_400_000, 600_000, 450_000],
  ])(
    'compares gross earnings of %i kobo',
    (grossKobo, zoluFeeKobo, zoluNetKobo, uberNetKobo, boltNetKobo, savingsVsUberKobo, savingsVsBoltKobo) => {
      expect(calculateCompetitorComparison(grossKobo)).toEqual({
        zoluFeeKobo,
        zoluNetKobo,
        uberNetKobo,
        boltNetKobo,
        savingsVsUberKobo,
        savingsVsBoltKobo,
      });
    },
  );

  it('rounds percentage-based nets to integer kobo', () => {
    expect(calculateCompetitorComparison(3)).toEqual({
      zoluFeeKobo: 0,
      zoluNetKobo: 3,
      uberNetKobo: 2,
      boltNetKobo: 2,
      savingsVsUberKobo: 1,
      savingsVsBoltKobo: 1,
    });
  });
});
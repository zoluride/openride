import { describe, expect, it } from 'vitest';

import { calculateVestingPercentage, getVestingMilestoneStatus, VESTING_TARGET_TRIPS } from './vesting';

describe('calculateVestingPercentage', () => {
  it.each([
    [-1, 0],
    [0, 0],
    [149, 0],
    [150, 25],
    [299, 25],
    [300, 50],
    [499, 50],
    [500, 75],
    [749, 75],
    [750, 100],
    [1000, 100],
  ])('returns %i percent at %i completed trips', (trips, percentage) => {
    expect(calculateVestingPercentage(trips)).toBe(percentage);
  });
});

describe('getVestingMilestoneStatus', () => {
  it('reports the next milestone before the first threshold', () => {
    expect(getVestingMilestoneStatus(0)).toEqual({
      achievedMilestoneTrips: 0,
      nextMilestoneTrips: 150,
      tripsToNextMilestone: 150,
      isFullyVested: false,
    });
  });

  it('reports the reached and next milestone between thresholds', () => {
    expect(getVestingMilestoneStatus(350)).toEqual({
      achievedMilestoneTrips: 300,
      nextMilestoneTrips: 500,
      tripsToNextMilestone: 150,
      isFullyVested: false,
    });
  });

  it('marks the target as fully vested', () => {
    expect(getVestingMilestoneStatus(VESTING_TARGET_TRIPS)).toEqual({
      achievedMilestoneTrips: 750,
      nextMilestoneTrips: null,
      tripsToNextMilestone: 0,
      isFullyVested: true,
    });
  });
});
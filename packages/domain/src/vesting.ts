export const VESTING_MILESTONES = [150, 300, 500, 750] as const;
export const VESTING_TARGET_TRIPS = 750;

export interface VestingMilestoneStatus {
  achievedMilestoneTrips: number;
  nextMilestoneTrips: number | null;
  tripsToNextMilestone: number;
  isFullyVested: boolean;
}

function normalizedTrips(trips: number): number {
  return Number.isFinite(trips) ? Math.max(0, Math.trunc(trips)) : 0;
}

export function calculateVestingPercentage(trips: number): number {
  const completedTrips = normalizedTrips(trips);
  if (completedTrips < 150) {
    return 0;
  }
  if (completedTrips < 300) {
    return 25;
  }
  if (completedTrips < 500) {
    return 50;
  }
  if (completedTrips < VESTING_TARGET_TRIPS) {
    return 75;
  }
  return 100;
}

export function getVestingMilestoneStatus(trips: number): VestingMilestoneStatus {
  const completedTrips = normalizedTrips(trips);
  const achievedMilestoneTrips = [...VESTING_MILESTONES]
    .reverse()
    .find((milestone) => completedTrips >= milestone) ?? 0;
  const nextMilestoneTrips = VESTING_MILESTONES.find((milestone) => completedTrips < milestone) ?? null;

  return {
    achievedMilestoneTrips,
    nextMilestoneTrips,
    tripsToNextMilestone: nextMilestoneTrips === null ? 0 : nextMilestoneTrips - completedTrips,
    isFullyVested: nextMilestoneTrips === null,
  };
}

export function calculateVestingPercentage(trips: number): number {
  if (trips < 150) {
    return 0;
  }
  if (trips < 300) {
    return 25;
  }
  if (trips < 500) {
    return 50;
  }
  if (trips < 750) {
    return 75;
  }
  return 100;
}

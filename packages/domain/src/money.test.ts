import { describe, expect, it } from 'vitest';

import { formatKobo } from './money';

describe('formatKobo', () => {
  it('formats kobo as Nigerian naira', () => {
    expect(formatKobo(500_000)).toContain('5,000.00');
    expect(formatKobo(500_000)).toContain('₦');
  });
});
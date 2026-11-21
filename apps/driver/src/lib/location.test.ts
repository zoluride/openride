import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock expo-location before importing
vi.mock('expo-location', () => ({
  default: {},
  requestForegroundPermissionsAsync: vi.fn(),
  getCurrentPositionAsync: vi.fn(),
  watchPositionAsync: vi.fn(),
  Accuracy: { High: 4 },
}));

// Mock supabase
vi.mock('./supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      upsert: vi.fn(() => Promise.resolve({ data: null, error: null })),
    })),
  },
}));

// Now import the module after mocking
import { LocationError } from './location';

describe('LocationError', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a LocationError with permission_denied code', () => {
    const error = new LocationError('Permission denied', 'permission_denied');
    expect(error.name).toBe('LocationError');
    expect(error.code).toBe('permission_denied');
    expect(error.message).toBe('Permission denied');
    expect(error).toBeInstanceOf(Error);
  });

  it('creates a LocationError with push_failed code', () => {
    const error = new LocationError('Push failed', 'push_failed');
    expect(error.name).toBe('LocationError');
    expect(error.code).toBe('push_failed');
    expect(error.message).toBe('Push failed');
    expect(error).toBeInstanceOf(Error);
  });

  it('creates a LocationError with unknown code', () => {
    const error = new LocationError('Test error', 'unknown');
    expect(error.code).toBe('unknown');
    expect(error).toBeInstanceOf(Error);
  });
});



import { describe, it, expect } from 'vitest';
import type { DriverError } from './driver-state';

describe('DriverError types', () => {
  it('creates a location permission denied error', () => {
    const error: DriverError = {
      code: 'location_permission_denied',
      message: 'Location permission is required',
      timestamp: Date.now(),
    };
    expect(error.code).toBe('location_permission_denied');
    expect(error.message).toBe('Location permission is required');
  });

  it('creates a location push failed error', () => {
    const error: DriverError = {
      code: 'location_push_failed',
      message: 'Failed to push location',
      timestamp: Date.now(),
    };
    expect(error.code).toBe('location_push_failed');
  });

  it('creates an api error', () => {
    const error: DriverError = {
      code: 'api_error',
      message: 'API request failed',
      timestamp: Date.now(),
    };
    expect(error.code).toBe('api_error');
  });

  it('creates a state refresh failed error', () => {
    const error: DriverError = {
      code: 'state_refresh_failed',
      message: 'Failed to refresh state',
      timestamp: Date.now(),
    };
    expect(error.code).toBe('state_refresh_failed');
  });
});

import { describe, it, expect } from 'vitest';
import type { DriverError, DriverDocument } from './driver-state';

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

describe('DriverDocument', () => {
  it('creates a document with basic properties', () => {
    const doc: DriverDocument = {
      type: 'License',
      docType: 'license',
      status: 'pending',
      uploaded: false,
    };
    expect(doc.type).toBe('License');
    expect(doc.docType).toBe('license');
    expect(doc.status).toBe('pending');
  });

  it('tracks expiry information', () => {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 15);
    const doc: DriverDocument = {
      type: 'License',
      docType: 'license',
      status: 'approved',
      uploaded: true,
      expiresOn: expiryDate.toISOString(),
      expiringSoon: true,
      expiryLabel: 'expires in 15 days',
    };
    expect(doc.expiringSoon).toBe(true);
    expect(doc.expiryLabel).toContain('expires');
  });
});

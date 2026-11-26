import { channels } from '@openride/realtime';
import type { Database } from '@openride/db';
import type { Session } from '@supabase/supabase-js';
import { useCallback, useEffect, useState } from 'react';

import { api } from './api';
import type { DocumentFile } from './file-upload';
import { LocationError, startLocationStreaming, stopLocationStreaming } from './location';
import { supabase } from './supabase';
import { retryPendingDrafts } from './offline-drafts';

export interface Vehicle {
  id: string;
  rego: string;
  make: string;
  model: string;
  vehicle_type: string;
}

export const REQUIRED_DRIVER_DOCUMENTS = [
  { type: 'License', docType: 'license' },
  { type: 'LASDRI', docType: 'lasdri' },
  { type: 'NHIA', docType: 'nhia' },
] as const;

export type RequiredDocumentName = (typeof REQUIRED_DRIVER_DOCUMENTS)[number]['type'];
export type DriverDocumentType = RequiredDocumentName | 'Hackney Permit' | 'Motor Insurance' | string;

export interface DriverDocument {
  id?: string;
  type: DriverDocumentType;
  docType: Database['public']['Enums']['driver_doc_type'];
  label?: string;
  status: 'verified' | 'pending' | 'approved' | 'rejected' | 'expired';
  uploaded: boolean;
  issuedOn?: string | null;
  expiresOn?: string | null;
  expiryLabel?: string;
  expiringSoon?: boolean;
  renewalSubmitted?: boolean;
  storageFile?: DocumentFile;
}

export interface ActiveTrip {
  id: string;
  status: string;
  pickup_address: string;
  dropoff_address: string;
  estimated_fare_cents: number | null;
  final_fare_cents: number | null;
}

export interface PendingOffer {
  id: string;
  trip_id: string;
  responds_by: string;
  pickup_eta_s: number | null;
  distance_to_pickup_m: number | null;
  trips: { pickup_address: string; dropoff_address: string; estimated_fare_cents: number | null } | null;
}

const ACTIVE_STATUSES = ['assigned', 'driver_en_route', 'arrived_at_pickup', 'in_progress'] as const;

export interface DriverError {
  code: 'location_permission_denied' | 'location_push_failed' | 'state_refresh_failed' | 'api_error';
  message: string;
  timestamp: number;
}

export interface DriverState {
  loading: boolean;
  online: boolean;
  vehicleId: string | null;
  grossEarningsNaira: number | null;
  completedTrips: number | null;
  completedTripsToday: number | null;
  hoursOnlineToday: number | null;
  driverDocuments: DriverDocument[];
  activeTrip: ActiveTrip | null;
  pendingOffer: PendingOffer | null;
  error: DriverError | null;
  refresh: () => Promise<void>;
  goOnline: (vehicleId: string) => Promise<void>;
  goOffline: () => Promise<void>;
  clearError: () => void;
}

export function useDriverState(session: Session | null): DriverState {
  const driverId = session?.user.id ?? null;
  const [loading, setLoading] = useState(true);
  const [online, setOnline] = useState(false);
  const [vehicleId, setVehicleId] = useState<string | null>(null);
  const [grossEarningsNaira, setGrossEarningsNaira] = useState<number | null>(null);
  const [completedTrips, setCompletedTrips] = useState<number | null>(null);
  const [completedTripsToday, setCompletedTripsToday] = useState<number | null>(null);
  const [hoursOnlineToday, setHoursOnlineToday] = useState<number | null>(null);
  const [driverDocuments, setDriverDocuments] = useState<DriverDocument[]>(
    REQUIRED_DRIVER_DOCUMENTS.map(({ type, docType }) => ({ type, docType, status: 'pending', uploaded: false })),
  );
  const [activeTrip, setActiveTrip] = useState<ActiveTrip | null>(null);
  const [pendingOffer, setPendingOffer] = useState<PendingOffer | null>(null);
  const [error, setError] = useState<DriverError | null>(null);

  const refresh = useCallback(async () => {
    if (!driverId) return;
    try {
      const nowIso = new Date().toISOString();
      const dayStart = new Date();
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);
      const [statusRes, tripRes, offerRes, earningsRes, completedTripsRes, shiftsRes, documentsRes] = await Promise.all([
        supabase
          .from('driver_status')
          .select('status, vehicle_id')
          .eq('driver_id', driverId)
          .is('ended_at', null)
          .maybeSingle(),
        supabase
          .from('trips')
          .select('id, status, pickup_address, dropoff_address, estimated_fare_cents, final_fare_cents')
          .eq('driver_id', driverId)
          .in('status', ACTIVE_STATUSES)
          .order('assigned_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('trip_offers')
          .select('id, trip_id, responds_by, pickup_eta_s, distance_to_pickup_m, trips(pickup_address, dropoff_address, estimated_fare_cents)')
          .eq('driver_id', driverId)
          .eq('status', 'pending')
          .gt('responds_by', nowIso)
          .order('sent_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('trips')
          .select('final_fare_cents')
          .eq('driver_id', driverId)
          .eq('status', 'completed')
          .gte('completed_at', dayStart.toISOString())
          .lt('completed_at', dayEnd.toISOString()),
        supabase
          .from('trips')
          .select('id', { count: 'exact', head: true })
          .eq('driver_id', driverId)
          .eq('status', 'completed'),
        supabase
          .from('driver_status')
          .select('started_at, ended_at')
          .lte('started_at', nowIso)
          .or(`ended_at.is.null,ended_at.gt.${dayStart.toISOString()}`),
        supabase
          .from('driver_documents')
          .select('id, doc_type, status, issued_on, expires_on')
          .eq('driver_id', driverId),
      ]);

      const status = statusRes.data as { status?: string; vehicle_id?: string } | null;
      setOnline(Boolean(status) && status?.status !== 'offline');
      setVehicleId(status?.vehicle_id ?? null);
      setActiveTrip((tripRes.data as ActiveTrip) ?? null);
      setPendingOffer((offerRes.data as unknown as PendingOffer) ?? null);
      if (earningsRes.error) {
        setGrossEarningsNaira(null);
        setCompletedTripsToday(null);
      } else {
        const earningsRows = (earningsRes.data ?? []) as { final_fare_cents: number | null }[];
        const grossEarningsCents = earningsRows.reduce((total, trip) => total + (trip.final_fare_cents ?? 0), 0);
        setGrossEarningsNaira(grossEarningsCents / 100);
        setCompletedTripsToday(earningsRows.length);
      }
      setCompletedTrips(completedTripsRes.error ? null : completedTripsRes.count ?? 0);
      if (shiftsRes.error) {
        setHoursOnlineToday(null);
      } else {
        const currentTimeMs = Date.now();
        const dayStartMs = dayStart.getTime();
        const onlineMilliseconds = (shiftsRes.data ?? []).reduce((total, shift) => {
          const startedAtMs = Math.max(new Date(shift.started_at).getTime(), dayStartMs);
          const endedAtMs = Math.min(shift.ended_at ? new Date(shift.ended_at).getTime() : currentTimeMs, currentTimeMs);
          return total + Math.max(0, endedAtMs - startedAtMs);
        }, 0);
        setHoursOnlineToday(onlineMilliseconds / 3_600_000);
      }
      const documentRows = documentsRes.data ?? [];
      // Build a map of doc_type to their latest documents
      const docMap = new Map<
        string,
        Array<{ id: string; status: string; issued_on: string | null; expires_on: string | null }>
      >();
      for (const doc of documentRows) {
        if (!docMap.has(doc.doc_type)) {
          docMap.set(doc.doc_type, []);
        }
        docMap.get(doc.doc_type)?.push(doc);
      }

      // Map required documents with status and expiry info
      const mappedDocs: DriverDocument[] = REQUIRED_DRIVER_DOCUMENTS.map(({ type, docType }) => {
        const docs = docMap.get(docType) || [];
        const approvedDoc = docs.find((d) => d.status === 'approved');
        const pendingDoc = docs.length > 0 ? docs[0] : null;
        const latestDoc = approvedDoc || pendingDoc;

        const status = approvedDoc
          ? latestDoc?.expires_on && new Date(latestDoc.expires_on) < new Date()
            ? 'expired'
            : 'verified'
          : pendingDoc
            ? pendingDoc.status === 'pending'
              ? 'pending'
              : (pendingDoc.status as 'rejected' | 'approved' | 'expired')
            : 'pending';

        const finalStatus: 'verified' | 'pending' | 'approved' | 'rejected' | 'expired' = status as 
          | 'verified'
          | 'pending'
          | 'approved'
          | 'rejected'
          | 'expired';
        return {
          type,
          docType,
          status: finalStatus,
          uploaded: docs.length > 0,
          issuedOn: latestDoc?.issued_on,
          expiresOn: latestDoc?.expires_on,
          expiryLabel: formatExpiryLabel(latestDoc?.expires_on ?? null),
          expiringSoon: isExpiringsoon(latestDoc?.expires_on ?? null),
        };
      });

      setDriverDocuments(mappedDocs);
      setError(null);
      setLoading(false);

      // Attempt to retry any pending offline incident drafts
      try {
        await retryPendingDrafts(api.reportIncident.bind(api));
      } catch (retryErr) {
        console.warn('Error retrying incident drafts:', retryErr);
        // Don't fail the entire refresh if retry fails
      }
    } catch (err) {
      setError({
        code: 'state_refresh_failed',
        message: err instanceof Error ? err.message : 'Failed to refresh driver state',
        timestamp: Date.now(),
      });
      setLoading(false);
    }
  }, [driverId]);

  // Initial load + realtime subscription on the driver's own rows.
  useEffect(() => {
    if (!driverId) return;
    void refresh();
    const channel = supabase.channel(channels.driver(driverId));
    for (const table of ['driver_status', 'trips', 'trip_offers', 'driver_documents']) {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table, filter: `driver_id=eq.${driverId}` },
        () => void refresh(),
      );
    }
    channel.subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [driverId, refresh]);

  // Stream location while online; stop when offline or signed out.
  useEffect(() => {
    if (online && driverId) {
      void startLocationStreaming(driverId).catch((err) => {
        const locationErr = err instanceof LocationError ? err : null;
        setError({
          code: locationErr?.code === 'permission_denied' ? 'location_permission_denied' : 'location_push_failed',
          message: err instanceof Error ? err.message : 'Location streaming failed',
          timestamp: Date.now(),
        });
      });
      return () => stopLocationStreaming();
    }
    stopLocationStreaming();
    return undefined;
  }, [online, driverId]);

  const goOnline = useCallback(
    async (vId: string) => {
      try {
        await api.driverGoOnline(vId);
        await refresh();
        setError(null);
      } catch (err) {
        setError({
          code: 'api_error',
          message: err instanceof Error ? err.message : 'Failed to go online',
          timestamp: Date.now(),
        });
        throw err;
      }
    },
    [refresh],
  );

  const goOffline = useCallback(async () => {
    try {
      await api.driverGoOffline();
      stopLocationStreaming();
      await refresh();
      setError(null);
    } catch (err) {
      setError({
        code: 'api_error',
        message: err instanceof Error ? err.message : 'Failed to go offline',
        timestamp: Date.now(),
      });
      throw err;
    }
  }, [refresh]);

  return {
    loading,
    online,
    vehicleId,
    grossEarningsNaira,
    completedTrips,
    completedTripsToday,
    hoursOnlineToday,
    driverDocuments,
    activeTrip,
    pendingOffer,
    error,
    refresh,
    goOnline,
    goOffline,
    clearError: () => setError(null),
  };
}

export async function submitDriverDocuments(
  driverId: string,
  documents: DriverDocument[],
  options?: { useMockPath?: boolean },
): Promise<void> {
  const isMockMode = options?.useMockPath ?? __DEV__;

  for (const doc of documents) {
    // If in dev/preview mode without actual file, use mock path
    let storagePath = isMockMode && !doc.storageFile ? `mock/${driverId}/${doc.docType}/${Date.now()}` : null;

    // If we have a real file, upload it first
    if (doc.storageFile && !storagePath) {
      try {
        const { uploadFileToStorage } = await import('./file-upload');
        storagePath = await uploadFileToStorage(supabase, 'driver_documents', doc.storageFile, driverId, doc.docType);
      } catch (error) {
        throw new Error(
          `Failed to upload ${doc.type}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    }

    if (!storagePath) {
      throw new Error(`No storage path for ${doc.type}`);
    }

    const { error } = await supabase.rpc('submit_driver_document', {
      p_doc_type: doc.docType,
      p_storage_path: storagePath,
      p_issued_on: doc.issuedOn
        ? new Date(doc.issuedOn).toISOString().split('T')[0]
        : undefined,
      p_expires_on: doc.expiresOn
        ? new Date(doc.expiresOn).toISOString().split('T')[0]
        : undefined,
    });
    if (error) throw error;
  }
}

/**
 * Fetch the driver's required document types based on jurisdiction/compliance rules
 */
export async function fetchRequiredDocumentTypes(driverId: string): Promise<DriverDocument[]> {
  const { data: profile } = await supabase
    .from('driver_profiles')
    .select('operator_id')
    .eq('user_id', driverId)
    .single();

  if (!profile?.operator_id) {
    throw new Error('Driver profile not found');
  }

  const { data: operator } = await supabase
    .from('operators')
    .select('country, state')
    .eq('id', profile.operator_id)
    .single();

  if (!operator?.country) {
    throw new Error('Operator not found');
  }

  // Fetch required document types from compliance rules
  const stateFilter = operator.state ? `state.is.null,state.eq.${operator.state}` : 'state.is.null';
  const { data: rules } = await supabase
    .from('compliance_rules')
    .select('doc_type')
    .eq('operator_id', profile.operator_id)
    .eq('country', operator.country)
    .eq('applies_to', 'driver')
    .eq('is_required', true)
    .or(stateFilter);

  if (!rules) {
    return REQUIRED_DRIVER_DOCUMENTS.map(({ type, docType }) => ({
      type,
      docType,
      status: 'pending',
      uploaded: false,
    }));
  }

  // Map doc_type strings to DriverDocument entries
  return rules.map((rule: { doc_type: string }) => {
    const matchedRequired = REQUIRED_DRIVER_DOCUMENTS.find((r) => r.docType === rule.doc_type);
    return {
      type: (matchedRequired?.type ?? rule.doc_type) as string,
      docType: rule.doc_type as Database['public']['Enums']['driver_doc_type'],
      status: 'pending' as const,
      uploaded: false,
    };
  });
}

/**
 * Calculate if a document is expiring soon (within 30 days)
 */
function isExpiringsoon(expiresOn: string | null): boolean {
  if (!expiresOn) return false;
  const expiryDate = new Date(expiresOn);
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
  return expiryDate <= thirtyDaysFromNow && expiryDate >= new Date();
}

/**
 * Format expiry date to readable label
 */
function formatExpiryLabel(expiresOn: string | null): string | undefined {
  if (!expiresOn) return undefined;
  const expiryDate = new Date(expiresOn);
  const now = new Date();
  const daysRemaining = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (daysRemaining < 0) {
    return 'expired';
  }
  if (daysRemaining === 0) {
    return 'expires today';
  }
  if (daysRemaining === 1) {
    return 'expires tomorrow';
  }
  if (daysRemaining <= 30) {
    return `expires in ${daysRemaining} days`;
  }
  if (daysRemaining <= 365) {
    const months = Math.ceil(daysRemaining / 30);
    return `expires in ${months} month${months > 1 ? 's' : ''}`;
  }
  return `expires in ${Math.ceil(daysRemaining / 365)} year${Math.ceil(daysRemaining / 365) > 1 ? 's' : ''}`;
}

/** Vehicles this driver can operate (their default vehicle(s)). */
export async function fetchMyVehicles(driverId: string): Promise<Vehicle[]> {
  const { data } = await supabase
    .from('vehicles')
    .select('id, rego, make, model, vehicle_type')
    .eq('default_driver_id', driverId)
    .eq('status', 'active');
  return (data as Vehicle[]) ?? [];
}

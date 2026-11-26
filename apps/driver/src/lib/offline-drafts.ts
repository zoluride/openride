import * as SecureStore from 'expo-secure-store';
import { supabase } from './supabase';
import { uploadFileToStorage } from './file-upload';

export interface IncidentDraft {
  id: string;
  category: string;
  severity: string;
  description: string;
  tripId?: string;
  vehicleId?: string;
  locationLat?: number;
  locationLng?: number;
  attachments: Array<{ path: string; mimeType: string }>;
  createdAt: string;
  failedAttempts: number;
}

const DRAFTS_KEY = 'incident_drafts_v1';
const MAX_RETRY_ATTEMPTS = 5;

async function getDraftsFromStorage(): Promise<IncidentDraft[]> {
  try {
    const stored = await SecureStore.getItemAsync(DRAFTS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

async function saveDraftsToStorage(drafts: IncidentDraft[]): Promise<void> {
  try {
    await SecureStore.setItemAsync(DRAFTS_KEY, JSON.stringify(drafts));
  } catch (e) {
    console.warn('Failed to save incident drafts:', e);
  }
}

export async function addDraft(draft: Omit<IncidentDraft, 'id' | 'createdAt' | 'failedAttempts'>): Promise<IncidentDraft> {
  const drafts = await getDraftsFromStorage();
  const newDraft: IncidentDraft = {
    ...draft,
    id: `draft_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    createdAt: new Date().toISOString(),
    failedAttempts: 0,
  };
  drafts.push(newDraft);
  await saveDraftsToStorage(drafts);
  return newDraft;
}

export async function getDrafts(): Promise<IncidentDraft[]> {
  return getDraftsFromStorage();
}

export async function removeDraft(draftId: string): Promise<void> {
  const drafts = await getDraftsFromStorage();
  const filtered = drafts.filter((d) => d.id !== draftId);
  await saveDraftsToStorage(filtered);
}

export async function incrementFailedAttempts(draftId: string): Promise<void> {
  const drafts = await getDraftsFromStorage();
  const draft = drafts.find((d) => d.id === draftId);
  if (draft) {
    draft.failedAttempts += 1;
  }
  await saveDraftsToStorage(drafts);
}

export async function clearDrafts(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(DRAFTS_KEY);
  } catch (e) {
    console.warn('Failed to clear incident drafts:', e);
  }
}

/**
 * Retry submitting all queued offline drafts.
 * This should be called when the driver comes back online or when driver state refreshes.
 * Returns an object with counts of succeeded and failed retries.
 */
export async function retryPendingDrafts(reportIncidentFn: (payload: {
  category: string;
  severity: string;
  description: string;
  trip_id?: string;
  vehicle_id?: string;
  location_lat?: number;
  location_lng?: number;
  attachments: Array<{ path: string; mime_type: string }>;
}) => Promise<unknown>): Promise<{ succeeded: number; failed: number }> {
  const drafts = await getDraftsFromStorage();
  let succeeded = 0;
  let failed = 0;

  for (const draft of drafts) {
    try {
      // Skip if max retries reached
      if (draft.failedAttempts >= MAX_RETRY_ATTEMPTS) {
        console.warn(`Draft ${draft.id} reached max retry attempts, skipping`);
        failed += 1;
        continue;
      }

      // Re-upload any local file attachments
      const attachments: Array<{ path: string; mime_type: string }> = [];
      const { data: u } = await supabase.auth.getUser();
      const userId = u.user?.id;

      if (!userId) {
        // Can't retry without auth
        await incrementFailedAttempts(draft.id);
        failed += 1;
        continue;
      }

      for (const attachment of draft.attachments) {
        try {
          // Check if attachment is a local file path (starts with file://) or already uploaded
          if (attachment.path.startsWith('file://') || !attachment.path.includes('/')) {
            const storagePath = await uploadFileToStorage(
              supabase,
              'incident_evidence',
              { uri: attachment.path, name: `evidence_${Date.now()}`, mimeType: attachment.mimeType },
              userId,
              'incident_evidence',
            );
            attachments.push({ path: storagePath, mime_type: attachment.mimeType });
          } else {
            // Already uploaded, reuse the path
            attachments.push({ path: attachment.path, mime_type: attachment.mimeType });
          }
        } catch (uploadErr) {
          console.warn(`Failed to upload attachment for draft ${draft.id}:`, uploadErr);
          // Continue with other attachments; don't fail entire draft
        }
      }

      // Submit the incident report
      await reportIncidentFn({
        category: draft.category,
        severity: draft.severity,
        description: draft.description,
        trip_id: draft.tripId,
        vehicle_id: draft.vehicleId,
        location_lat: draft.locationLat,
        location_lng: draft.locationLng,
        attachments,
      });

      // Success: remove the draft
      await removeDraft(draft.id);
      succeeded += 1;
    } catch (err) {
      // Increment failed attempts and keep the draft for retry later
      await incrementFailedAttempts(draft.id);
      failed += 1;
      console.warn(`Failed to retry draft ${draft.id}:`, err);
    }
  }

  return { succeeded, failed };
}

import * as SecureStore from 'expo-secure-store';

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

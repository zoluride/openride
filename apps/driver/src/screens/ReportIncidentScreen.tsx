import { colors, spacing, typography } from '@openride/ui';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ZoluLogo } from '../components/ZoluLogo';
import { api } from '../lib/api';
import { supabase } from '../lib/supabase';
import { pickImageFile, takeCameraPhoto } from '../lib/file-upload';
import { uploadFileToStorage } from '../lib/file-upload';
import { addDraft } from '../lib/offline-drafts';

const CATEGORIES = [
  { key: 'safety', label: 'Safety' },
  { key: 'vehicle_damage', label: 'Vehicle damage' },
  { key: 'abuse', label: 'Abuse' },
  { key: 'medical', label: 'Medical' },
  { key: 'other', label: 'Other' },
] as const;

const HIGH = new Set(['safety', 'medical', 'abuse']);

interface Evidence {
  id: string;
  uri: string;
  name: string;
  mimeType: string;
  storagePath?: string;
}

interface SubmittedReport {
  id: string;
  category: string;
  severity: string;
  description: string;
  status: string;
  resolution_notes: string | null;
  created_at: string;
}

type TabType = 'report' | 'history';

export function ReportIncidentScreen({
  onDone,
  devPreview = false,
  tripId,
  vehicleId,
  locationLat,
  locationLng,
}: {
  onDone: () => void;
  devPreview?: boolean;
  tripId?: string;
  vehicleId?: string;
  locationLat?: number;
  locationLng?: number;
}) {
  const [tab, setTab] = useState<TabType>('report');
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]['key']>('safety');
  const [description, setDescription] = useState('');
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedReports, setSubmittedReports] = useState<SubmittedReport[]>([]);
  const [loadingReports, setLoadingReports] = useState(false);

  useEffect(() => {
    if (tab === 'history') {
      loadSubmittedReports();
    }
  }, [tab]);

  async function loadSubmittedReports(): Promise<void> {
    setLoadingReports(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const userId = u.user?.id;
      if (!userId) throw new Error('Not signed in');

      const { data, error } = await supabase
        .from('incident_reports')
        .select('id, category, severity, description, status, resolution_notes, created_at')
        .eq('reported_by', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSubmittedReports((data as SubmittedReport[]) || []);
    } catch (err) {
      Alert.alert('Could not load reports', (err as Error).message);
    } finally {
      setLoadingReports(false);
    }
  }

  async function attachImage(): Promise<void> {
    try {
      const file = await pickImageFile();
      if (!file) return;
      setEvidence((prev) => [
        ...prev,
        {
          id: `evidence_${Date.now()}`,
          uri: file.uri,
          name: file.name,
          mimeType: file.mimeType,
        },
      ]);
    } catch (e) {
      Alert.alert('Could not attach image', (e as Error).message);
    }
  }

  async function capturePhoto(): Promise<void> {
    try {
      const file = await takeCameraPhoto();
      if (!file) return;
      setEvidence((prev) => [
        ...prev,
        {
          id: `evidence_${Date.now()}`,
          uri: file.uri,
          name: file.name,
          mimeType: file.mimeType,
        },
      ]);
    } catch (e) {
      Alert.alert('Could not capture photo', (e as Error).message);
    }
  }

  async function submit(): Promise<void> {
    setBusy(true);
    try {
      if (devPreview) {
        setSubmitted(true);
        return;
      }

      const { data: u } = await supabase.auth.getUser();
      const userId = u.user?.id;
      if (!userId) throw new Error('Not signed in');

      const severity = HIGH.has(category) ? 'high' : 'low';

      // Upload evidence files if any
      const attachments: Array<{ path: string; mime_type: string }> = [];
      for (const ev of evidence) {
        try {
          if (!ev.storagePath) {
            const path = await uploadFileToStorage(
              supabase,
              'incident_evidence',
              { uri: ev.uri, name: ev.name, mimeType: ev.mimeType },
              userId,
              'incident_evidence',
            );
            ev.storagePath = path;
          }
          attachments.push({ path: ev.storagePath, mime_type: ev.mimeType });
        } catch (uploadErr) {
          console.warn(`Failed to upload evidence ${ev.name}:`, uploadErr);
          // Continue with other evidence; don't fail the entire report
        }
      }

      // Submit incident report via Edge Function
      await api.reportIncident({
        category,
        severity,
        description: description.trim(),
        trip_id: tripId,
        vehicle_id: vehicleId,
        location_lat: locationLat,
        location_lng: locationLng,
        attachments,
      });

      Alert.alert('Thank you', 'Your report has been submitted.');
      onDone();
    } catch (e) {
      const errorMessage = (e as Error).message;
      // Save as offline draft if submission failed
      try {
        await addDraft({
          category,
          severity: HIGH.has(category) ? 'high' : 'low',
          description: description.trim(),
          tripId,
          vehicleId,
          locationLat,
          locationLng,
          attachments: evidence.map((ev) => ({ path: ev.uri, mimeType: ev.mimeType })),
        });
        Alert.alert(
          'Saved offline',
          'Could not submit right now, but your report has been saved. It will be submitted when you are back online.',
        );
        onDone();
      } catch {
        Alert.alert('Could not submit', errorMessage);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'right', 'bottom', 'left']}>
      <View style={styles.header}>
        <View style={styles.titleHeader}>
          <ZoluLogo size={28} />
          <Text style={styles.title}>Report an issue</Text>
        </View>
        <Pressable onPress={onDone} hitSlop={8}>
          <Text style={styles.cancel}>Close</Text>
        </Pressable>
      </View>

      <View style={styles.tabs}>
        <Pressable style={[styles.tab, tab === 'report' && styles.tabActive]} onPress={() => setTab('report')}>
          <Text style={tab === 'report' ? styles.tabTextActive : styles.tabText}>New Report</Text>
        </Pressable>
        <Pressable style={[styles.tab, tab === 'history' && styles.tabActive]} onPress={() => setTab('history')}>
          <Text style={tab === 'history' ? styles.tabTextActive : styles.tabText}>History</Text>
        </Pressable>
      </View>

      {tab === 'report' ? (
        <>
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            <Text style={styles.sectionTitle}>Category</Text>
            <View style={styles.chips}>
              {CATEGORIES.map((c) => (
                <Pressable
                  key={c.key}
                  style={[styles.chip, category === c.key && styles.chipActive]}
                  onPress={() => setCategory(c.key)}
                  disabled={submitted}
                >
                  <Text style={category === c.key ? styles.chipTextActive : styles.chipText}>{c.label}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.sectionTitle}>Description</Text>
            <TextInput
              style={styles.input}
              placeholder="Describe what happened…"
              value={description}
              onChangeText={setDescription}
              multiline
              textAlignVertical="top"
              editable={!submitted}
              placeholderTextColor={colors.textMuted}
            />

            {evidence.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Evidence ({evidence.length})</Text>
                <View style={styles.evidenceList}>
                  {evidence.map((ev) => (
                    <View key={ev.id} style={styles.evidenceItem}>
                      <Text style={styles.evidenceName}>{ev.name}</Text>
                      <Pressable onPress={() => setEvidence((prev) => prev.filter((e) => e.id !== ev.id))} disabled={submitted}>
                        <Text style={styles.removeButton}>✕</Text>
                      </Pressable>
                    </View>
                  ))}
                </View>
              </>
            )}

            {!submitted && (
              <>
                <Text style={styles.sectionTitle}>Attach evidence (optional)</Text>
                <View style={styles.attachmentButtons}>
                  <Pressable style={styles.attachButton} onPress={() => void capturePhoto()} disabled={busy}>
                    <Text style={styles.attachButtonText}>📷 Camera</Text>
                  </Pressable>
                  <Pressable style={styles.attachButton} onPress={() => void attachImage()} disabled={busy}>
                    <Text style={styles.attachButtonText}>🖼️ Gallery</Text>
                  </Pressable>
                </View>
              </>
            )}

            {submitted ? (
              <Text style={styles.success}>Report saved. It will be submitted when you are back online if needed.</Text>
            ) : null}
          </ScrollView>

          <Pressable
            style={[styles.button, (busy || submitted || description.trim().length < 5) && styles.disabled]}
            onPress={() => void submit()}
            disabled={busy || submitted || description.trim().length < 5}
          >
            <Text style={styles.buttonText}>
              {busy ? 'Submitting…' : submitted ? 'Done' : 'Submit report'}
            </Text>
          </Pressable>
        </>
      ) : (
        <>
          {loadingReports ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Loading your reports…</Text>
            </View>
          ) : submittedReports.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No incident reports yet</Text>
            </View>
          ) : (
            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
              {submittedReports.map((report) => (
                <View key={report.id} style={styles.reportCard}>
                  <View style={styles.reportHeader}>
                    <View style={styles.reportMeta}>
                      <Text style={styles.reportCategory}>{report.category.replace(/_/g, ' ')}</Text>
                      <Text style={styles.reportDate}>{new Date(report.created_at).toLocaleDateString()}</Text>
                    </View>
                    <View style={[styles.severityBadge, report.severity === 'high' && styles.severityHigh]}>
                      <Text style={styles.severityText}>{report.severity}</Text>
                    </View>
                  </View>
                  <Text style={styles.reportDescription}>{report.description}</Text>
                  <View style={styles.reportFooter}>
                    <View style={[styles.statusBadge, getStatusStyle(report.status)]}>
                      <Text style={styles.statusText}>{report.status}</Text>
                    </View>
                    {report.resolution_notes && <Text style={styles.resolutionNotes}>{report.resolution_notes}</Text>}
                  </View>
                </View>
              ))}
            </ScrollView>
          )}
        </>
      )}
    </SafeAreaView>
  );
}

function getStatusStyle(status: string): Record<string, unknown> {
  const statusColors: Record<string, string> = {
    open: '#fff3cd',
    in_progress: '#cfe2ff',
    closed: '#d1e7dd',
  };
  return { backgroundColor: statusColors[status] || '#f6f8fa' };
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.xl, paddingVertical: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
  titleHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { fontSize: typography.size.xl, fontWeight: '600' },
  cancel: { color: colors.textMuted, fontWeight: '600' },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border },
  tab: { flex: 1, paddingVertical: spacing.md, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: colors.brandDark },
  tabText: { fontSize: typography.size.md, fontWeight: '500', color: colors.textMuted },
  tabTextActive: { fontSize: typography.size.md, fontWeight: '600', color: colors.brandDark },
  content: { flex: 1, paddingHorizontal: spacing.xl, paddingVertical: spacing.lg },
  sectionTitle: { fontSize: typography.size.md, fontWeight: '600', marginBottom: spacing.sm, marginTop: spacing.md, color: colors.text },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
  chip: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: 999, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.brandDark, borderColor: colors.brandDark },
  chipText: { color: colors.text, fontSize: typography.size.sm },
  chipTextActive: { color: '#fff', fontWeight: '600', fontSize: typography.size.sm },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: spacing.md, fontSize: typography.size.md, minHeight: 100, color: colors.text, textAlignVertical: 'top' },
  evidenceList: { gap: spacing.sm, marginBottom: spacing.lg },
  evidenceItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: 8, backgroundColor: colors.surfaceMuted },
  evidenceName: { fontSize: typography.size.sm, color: colors.text, flex: 1 },
  removeButton: { fontSize: typography.size.lg, color: colors.danger, fontWeight: '600' },
  attachmentButtons: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  attachButton: { flex: 1, paddingVertical: spacing.md, borderWidth: 1, borderColor: colors.brandDark, borderRadius: 8, alignItems: 'center' },
  attachButtonText: { color: colors.brandDark, fontWeight: '600', fontSize: typography.size.sm },
  success: { color: colors.online, fontSize: typography.size.sm, fontWeight: '600', marginBottom: spacing.lg },
  button: { backgroundColor: colors.brandDark, padding: spacing.lg, borderRadius: 8, alignItems: 'center', marginHorizontal: spacing.xl, marginBottom: spacing.xl },
  disabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: typography.size.lg },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontSize: typography.size.md, color: colors.textMuted },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: typography.size.md, color: colors.textMuted },
  reportCard: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: spacing.md, marginBottom: spacing.md, backgroundColor: colors.surfaceMuted },
  reportHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.md },
  reportMeta: { flex: 1 },
  reportCategory: { fontSize: typography.size.md, fontWeight: '600', color: colors.text, textTransform: 'capitalize', marginBottom: spacing.xs },
  reportDate: { fontSize: typography.size.sm, color: colors.textMuted },
  severityBadge: { paddingVertical: spacing.xs, paddingHorizontal: spacing.sm, borderRadius: 4, backgroundColor: colors.border },
  severityHigh: { backgroundColor: colors.danger },
  severityText: { fontSize: typography.size.xs, fontWeight: '600', color: '#fff', textTransform: 'capitalize' },
  reportDescription: { fontSize: typography.size.sm, color: colors.text, marginBottom: spacing.md },
  reportFooter: { gap: spacing.sm },
  statusBadge: { paddingVertical: spacing.xs, paddingHorizontal: spacing.sm, borderRadius: 4, alignSelf: 'flex-start' },
  statusText: { fontSize: typography.size.xs, fontWeight: '600', color: colors.text, textTransform: 'capitalize' },
  resolutionNotes: { fontSize: typography.size.sm, color: colors.text, fontStyle: 'italic' },
});

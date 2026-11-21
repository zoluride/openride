import { colors, spacing, typography } from '@openride/ui';
import { useState } from 'react';
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
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]['key']>('safety');
  const [description, setDescription] = useState('');
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);

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
          <Text style={styles.cancel}>{submitted ? 'Done' : 'Cancel'}</Text>
        </Pressable>
      </View>

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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.xl, paddingVertical: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
  titleHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { fontSize: typography.size.xl, fontWeight: '600' },
  cancel: { color: colors.textMuted, fontWeight: '600' },
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
});

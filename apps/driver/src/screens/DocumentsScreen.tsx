import { colors, spacing, typography } from '@openride/ui';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  REQUIRED_DRIVER_DOCUMENTS,
  type DriverDocument,
  type RequiredDocumentName,
} from '../lib/driver-state';

interface Props {
  driverId: string;
  documents: DriverDocument[];
  onBack: () => void;
  onSubmit: (uploadedTypes: RequiredDocumentName[]) => Promise<void>;
  onMockAdminVerify: () => Promise<void>;
}

export function DocumentsScreen({ documents, onBack, onSubmit, onMockAdminVerify }: Props) {
  const [uploaded, setUploaded] = useState<Set<RequiredDocumentName>>(
    () => new Set(documents.filter((document) => document.uploaded && document.status !== 'verified').map((document) => document.type)),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function mockUpload(type: RequiredDocumentName): void {
    setUploaded((current) => new Set(current).add(type));
  }

  async function submit(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      await onSubmit([...uploaded]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function mockAdminVerify(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      await onMockAdminVerify();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'right', 'bottom', 'left']}>
      <Pressable onPress={onBack} hitSlop={8} style={styles.back}>
        <Text style={styles.backText}>Back</Text>
      </Pressable>
      <Text style={styles.title}>Driver documents</Text>
      <Text style={styles.muted}>Submit all three documents for admin review.</Text>

      <View style={styles.list}>
        {REQUIRED_DRIVER_DOCUMENTS.map(({ type }) => {
          const document = documents.find((item) => item.type === type);
          const verified = document?.status === 'verified';
          const isUploaded = uploaded.has(type);
          return (
            <View key={type} style={styles.documentRow}>
              <View style={styles.documentInfo}>
                <Text style={styles.documentName}>{type}</Text>
                <Text style={verified ? styles.verified : styles.muted}>
                  {verified ? 'Verified' : isUploaded ? 'Uploaded' : document?.uploaded ? 'Pending review' : 'Required'}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                style={[styles.uploadButton, (verified || isUploaded || busy) && styles.disabled]}
                disabled={verified || isUploaded || busy}
                onPress={() => mockUpload(type)}
              >
                <Text style={styles.uploadText}>{verified ? 'Verified' : isUploaded ? 'Uploaded' : 'Mock Upload'}</Text>
              </Pressable>
            </View>
          );
        })}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          style={[styles.submitButton, (busy || uploaded.size === 0) && styles.disabled]}
          disabled={busy || uploaded.size === 0}
          onPress={() => void submit()}
        >
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Submit for Review</Text>}
        </Pressable>
        {__DEV__ ? (
          <Pressable
            accessibilityRole="button"
            style={[styles.verifyButton, busy && styles.disabled]}
            disabled={busy}
            onPress={() => void mockAdminVerify()}
          >
            <Text style={styles.submitText}>Mock Admin Verify</Text>
          </Pressable>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.xl, backgroundColor: colors.surface },
  back: { alignSelf: 'flex-start', marginBottom: spacing.lg },
  backText: { color: colors.brandDark, fontSize: typography.size.md, fontWeight: '600' },
  title: { fontSize: typography.size.xl, fontWeight: '700', marginBottom: spacing.xs },
  muted: { color: colors.textMuted, fontSize: typography.size.sm },
  list: { marginTop: spacing.xl, borderTopWidth: 1, borderColor: colors.border },
  documentRow: {
    minHeight: 72,
    borderBottomWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  documentInfo: { gap: spacing.xs },
  documentName: { color: colors.text, fontSize: typography.size.md, fontWeight: '600' },
  verified: { color: colors.online, fontSize: typography.size.sm, fontWeight: '600' },
  uploadButton: { backgroundColor: colors.brandDark, borderRadius: 8, paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  uploadText: { color: '#fff', fontSize: typography.size.sm, fontWeight: '600' },
  disabled: { opacity: 0.55 },
  error: { color: colors.danger, fontSize: typography.size.sm, marginTop: spacing.md },
  actions: { marginTop: 'auto' },
  submitButton: { backgroundColor: colors.brandDark, borderRadius: 8, padding: spacing.lg, alignItems: 'center' },
  verifyButton: { backgroundColor: colors.online, borderRadius: 8, padding: spacing.md, alignItems: 'center', marginTop: spacing.sm },
  submitText: { color: '#fff', fontSize: typography.size.md, fontWeight: '600' },
});

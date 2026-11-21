import { colors, spacing, typography } from '@openride/ui';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ZoluLogo } from '../components/ZoluLogo';
import type { DocumentFile } from '../lib/file-upload';
import { pickDocumentFile, pickImageFile, takeCameraPhoto } from '../lib/file-upload';
import { type DriverDocument } from '../lib/driver-state';

interface Props {
  driverId: string;
  documents: DriverDocument[];
  onBack: () => void;
  onSubmit: (documents: DriverDocument[]) => Promise<void>;
  onPreviewVerify?: () => Promise<void>;
  preview?: boolean;
}

export function DocumentsScreen({ documents, onBack, onSubmit, onPreviewVerify, preview = false }: Props) {
  // Track local file uploads for each document
  const [localFiles, setLocalFiles] = useState<Record<string, DocumentFile>>();
  const [busy, setBusy] = useState(false);
  const [pickingDocType, setPickingDocType] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const isDocSelected = useCallback(
    (docType: string) => {
      return localFiles?.[docType] !== undefined;
    },
    [localFiles],
  );

  const handlePickDocument = useCallback(
    async (docType: string) => {
      setPickingDocType(docType);
      setError(null);
      try {
        const file = await pickDocumentFile();
        if (file) {
          setLocalFiles((current) => ({ ...current, [docType]: file }));
        }
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setPickingDocType(null);
      }
    },
    [],
  );

  const handlePickImage = useCallback(
    async (docType: string) => {
      setPickingDocType(docType);
      setError(null);
      try {
        const file = await pickImageFile();
        if (file) {
          setLocalFiles((current) => ({ ...current, [docType]: file }));
        }
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setPickingDocType(null);
      }
    },
    [],
  );

  const handleTakePhoto = useCallback(
    async (docType: string) => {
      setPickingDocType(docType);
      setError(null);
      try {
        const file = await takeCameraPhoto();
        if (file) {
          setLocalFiles((current) => ({ ...current, [docType]: file }));
        }
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setPickingDocType(null);
      }
    },
    [],
  );

  async function submit(): Promise<void> {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      // Prepare documents with local file data
      const docsToSubmit = documents.map((doc) => ({
        ...doc,
        storageFile: localFiles?.[doc.docType],
      }));

      await onSubmit(docsToSubmit);
      setLocalFiles(undefined);
      setMessage(preview ? 'Renewal submitted and saved in this preview.' : 'Documents submitted for review.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function simulatePreviewVerification(): Promise<void> {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await onPreviewVerify?.();
      setMessage('Preview verification simulated locally. No review record was changed.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // Count selected documents
  const selectedCount = documents.filter((doc) => isDocSelected(doc.docType)).length;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'right', 'bottom', 'left']}>
      <Pressable onPress={onBack} hitSlop={8} style={styles.back}>
        <Text style={styles.backText}>Back</Text>
      </Pressable>
      <View style={styles.titleHeader}>
        <ZoluLogo size={28} />
        <Text style={styles.title}>Driver documents</Text>
      </View>
      <Text style={styles.muted}>
        {preview ? 'Lagos driver compliance records' : 'Upload your documents for admin review.'}
      </Text>

      <View style={styles.list}>
        {documents.map((document) => {
          const { docType } = document;
          const verified = document?.status === 'verified';
          const isSelected = isDocSelected(docType);
          const expiringSoon = document.expiringSoon ?? false;
          const statusLabel = document.renewalSubmitted
            ? 'Renewal submitted'
            : expiringSoon
              ? 'Expiring Soon'
              : verified
                ? 'Verified'
                : isSelected
                  ? 'Selected'
                  : document.uploaded
                    ? 'Pending review'
                    : 'Required';
          const statusStyle = expiringSoon ? styles.warning : verified ? styles.verified : styles.muted;
          const canRenew = expiringSoon && !document.renewalSubmitted;
          const isLoading = pickingDocType === docType;

          return (
            <View key={docType} style={styles.documentRow}>
              <View style={styles.documentInfo}>
                <Text style={styles.documentName}>{document.label ?? document.type}</Text>
                <Text style={statusStyle}>
                  {statusLabel}
                  {document.expiryLabel ? ` · ${document.expiryLabel}` : ''}
                </Text>
              </View>
              <View style={styles.uploadOptions}>
                {(verified && !canRenew) || isLoading || busy ? (
                  <Pressable
                    accessibilityRole="button"
                    style={[styles.uploadButton, styles.disabled]}
                    disabled
                  >
                    {isLoading ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.uploadText}>
                        {document.renewalSubmitted ? 'Submitted' : isSelected ? 'Selected' : verified ? 'Verified' : 'Upload'}
                      </Text>
                    )}
                  </Pressable>
                ) : (
                  <>
                    {Platform.OS !== 'web' && (
                      <>
                        <Pressable
                          accessibilityRole="button"
                          style={[styles.smallButton, isSelected && styles.selected]}
                          onPress={() => void handleTakePhoto(docType)}
                        >
                          <Text style={styles.smallButtonText}>📷</Text>
                        </Pressable>
                        <Pressable
                          accessibilityRole="button"
                          style={[styles.smallButton, isSelected && styles.selected]}
                          onPress={() => void handlePickImage(docType)}
                        >
                          <Text style={styles.smallButtonText}>🖼️</Text>
                        </Pressable>
                      </>
                    )}
                    <Pressable
                      accessibilityRole="button"
                      style={[styles.smallButton, isSelected && styles.selected]}
                      onPress={() => void handlePickDocument(docType)}
                    >
                      <Text style={styles.smallButtonText}>📄</Text>
                    </Pressable>
                  </>
                )}
              </View>
            </View>
          );
        })}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {message ? <Text style={styles.success}>{message}</Text> : null}
      <View style={styles.actions}>
        {selectedCount > 0 ? (
          <Pressable
            accessibilityRole="button"
            style={[styles.submitButton, busy && styles.disabled]}
            disabled={busy}
            onPress={() => void submit()}
          >
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Submit {selectedCount} document{selectedCount > 1 ? 's' : ''}</Text>}
          </Pressable>
        ) : null}
        {__DEV__ && preview && onPreviewVerify ? (
          <Pressable
            accessibilityRole="button"
            style={[styles.verifyButton, busy && styles.disabled]}
            disabled={busy}
            onPress={() => void simulatePreviewVerification()}
          >
            <Text style={styles.submitText}>Simulate Verification (Preview Only)</Text>
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
  titleHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { fontSize: typography.size.xl, fontWeight: '700', marginBottom: spacing.xs },
  muted: { color: colors.textMuted, fontSize: typography.size.sm },
  list: { marginTop: spacing.xl, borderTopWidth: 1, borderColor: colors.border, flex: 1 },
  documentRow: {
    minHeight: 72,
    borderBottomWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  documentInfo: { gap: spacing.xs, flex: 1 },
  documentName: { color: colors.text, fontSize: typography.size.md, fontWeight: '600' },
  verified: { color: colors.online, fontSize: typography.size.sm, fontWeight: '600' },
  warning: { color: '#b45309', fontSize: typography.size.sm, fontWeight: '700' },
  uploadOptions: { flexDirection: 'row', gap: spacing.xs, alignItems: 'center' },
  uploadButton: { backgroundColor: colors.brandDark, borderRadius: 8, paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  uploadText: { color: '#fff', fontSize: typography.size.sm, fontWeight: '600' },
  smallButton: { width: 44, height: 44, borderRadius: 8, backgroundColor: colors.brandDark, alignItems: 'center', justifyContent: 'center' },
  smallButtonText: { fontSize: typography.size.lg },
  selected: { backgroundColor: colors.online },
  disabled: { opacity: 0.55 },
  error: { color: colors.danger, fontSize: typography.size.sm, marginTop: spacing.md },
  success: { color: colors.online, fontSize: typography.size.sm, fontWeight: '600', marginTop: spacing.md },
  actions: { marginTop: spacing.lg, gap: spacing.sm },
  submitButton: { backgroundColor: colors.brandDark, borderRadius: 8, padding: spacing.lg, alignItems: 'center' },
  verifyButton: { backgroundColor: colors.online, borderRadius: 8, padding: spacing.md, alignItems: 'center' },
  submitText: { color: '#fff', fontSize: typography.size.md, fontWeight: '600' },
});

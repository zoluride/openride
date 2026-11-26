import { formatKobo } from '@openride/domain';
import { colors, spacing, typography } from '@openride/ui';
import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { ActiveTrip, DriverError } from '../lib/driver-state';
import { api } from '../lib/api';

type Event = 'en-route' | 'arrived' | 'start' | 'complete' | 'cancel';

interface Props {
  trip: ActiveTrip;
  error?: DriverError | null;
  onEvent: (event: Event, reason?: string) => Promise<void>;
  onClearError?: () => void;
  onSOS?: () => void;
}

const STATUS_LABEL: Record<string, string> = {
  assigned: 'Head to pickup',
  driver_en_route: 'Heading to pickup',
  arrived_at_pickup: 'At pickup',
  in_progress: 'Trip in progress',
};

const CANCEL_REASONS = [
  'Vehicle breakdown',
  'Traffic congestion',
  'Wrong address',
  'Rider not ready',
  'Safety concern',
  'Other',
] as const;

export function ActiveTripScreen({ trip, error, onEvent, onClearError, onSOS }: Props) {
  const [busy, setBusy] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [customReason, setCustomReason] = useState('');
  const [showError, setShowError] = useState(error !== null);

  useEffect(() => {
    setShowError(error !== null);
  }, [error]);

  async function handleSOS(): Promise<void> {
    Alert.alert(
      'Emergency Report',
      'Report an emergency to support immediately. Your location will be included.',
      [
        { text: 'Cancel', onPress: () => {} },
        {
          text: 'Report Emergency',
          onPress: async () => {
            try {
              const { status } = await Location.requestForegroundPermissionsAsync();
              let locationLat: number | undefined;
              let locationLng: number | undefined;
              if (status === 'granted') {
                const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
                locationLat = pos.coords.latitude;
                locationLng = pos.coords.longitude;
              }
              await api.reportIncident({
                category: 'safety',
                severity: 'critical',
                description: 'Emergency/SOS triggered during active trip',
                trip_id: trip.id,
                location_lat: locationLat,
                location_lng: locationLng,
              });
              Alert.alert('Emergency reported', 'Support has been notified of your emergency.');
              onSOS?.();
            } catch (e) {
              Alert.alert('Could not report emergency', (e as Error).message);
            }
          },
          style: 'destructive',
        },
      ],
    );
  }

  useEffect(() => {
    if (error && showError) {
      const errorMessages: Record<string, string> = {
        location_permission_denied: 'Location access denied. Enable location permissions to continue the trip.',
        location_push_failed: 'Failed to send your location. Check your connection and try again.',
        state_refresh_failed: 'Failed to sync trip data. Check your connection.',
        api_error: 'Trip action failed. Please try again.',
      };
      Alert.alert('Trip Connection Issue', errorMessages[error.code] || error.message, [
        {
          text: 'Dismiss',
          onPress: () => {
            setShowError(false);
            onClearError?.();
          },
        },
      ]);
    }
  }, [error, showError, onClearError]);

  function navigateTo(address: string): void {
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
    void Linking.openURL(url);
  }

  async function run(event: Event, reason?: string): Promise<void> {
    setBusy(true);
    try {
      await onEvent(event, reason);
    } catch (e) {
      Alert.alert('Action failed', (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleCancel(): Promise<void> {
    if (!selectedReason) {
      Alert.alert('Select reason', 'Please select a cancellation reason');
      return;
    }
    const reason = selectedReason === 'Other' ? customReason : selectedReason;
    if (!reason.trim()) {
      Alert.alert('Reason required', 'Please provide a cancellation reason');
      return;
    }
    setShowCancelModal(false);
    await run('cancel', reason);
  }

  const inProgress = trip.status === 'in_progress';
  const target = inProgress ? trip.dropoff_address : trip.pickup_address;
  const fareKobo = trip.final_fare_cents ?? trip.estimated_fare_cents;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'right', 'bottom', 'left']}>
      <Text style={styles.status}>{STATUS_LABEL[trip.status] ?? trip.status}</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Pickup</Text>
        <Text style={styles.value}>{trip.pickup_address}</Text>
        <Text style={[styles.label, { marginTop: spacing.md }]}>Dropoff</Text>
        <Text style={styles.value}>{trip.dropoff_address}</Text>
        {fareKobo != null ? <Text style={styles.fare}>{formatKobo(fareKobo)}</Text> : null}
      </View>

      <Pressable style={styles.navButton} onPress={() => navigateTo(target)}>
        <Text style={styles.navText}>Navigate to {inProgress ? 'destination' : 'pickup'}</Text>
      </Pressable>

      <View style={styles.actions}>
        {trip.status === 'assigned' && (
          <PrimaryButton label="Head to pickup" busy={busy} onPress={() => run('en-route')} />
        )}
        {(trip.status === 'assigned' || trip.status === 'driver_en_route') && (
          <PrimaryButton label="Arrived at pickup" busy={busy} onPress={() => run('arrived')} />
        )}
        {trip.status === 'arrived_at_pickup' && (
          <PrimaryButton label="Start trip" busy={busy} onPress={() => run('start')} />
        )}
        {trip.status === 'in_progress' && (
          <PrimaryButton label="Complete trip" busy={busy} onPress={() => run('complete')} />
        )}
        {!inProgress && (
          <Pressable style={styles.cancel} onPress={() => setShowCancelModal(true)} disabled={busy}>
            <Text style={styles.cancelText}>Cancel trip</Text>
          </Pressable>
        )}
        <Pressable style={styles.sos} onPress={() => void handleSOS()} disabled={busy}>
          <Text style={styles.sosText}>🚨 Emergency / SOS</Text>
        </Pressable>
      </View>

      <Modal visible={showCancelModal} animationType="slide" transparent onRequestClose={() => setShowCancelModal(false)}>
        <View style={styles.modalOverlay}>
          <SafeAreaView style={styles.modalContent} edges={['top', 'right', 'bottom', 'left']}>
            <Text style={styles.modalTitle}>Why are you cancelling?</Text>

            {CANCEL_REASONS.map((reason) => (
              <Pressable
                key={reason}
                style={[styles.reasonButton, selectedReason === reason && styles.reasonButtonSelected]}
                onPress={() => {
                  setSelectedReason(reason);
                  if (reason !== 'Other') setCustomReason('');
                }}
              >
                <View style={[styles.radioCircle, selectedReason === reason && styles.radioCircleSelected]} />
                <Text style={styles.reasonText}>{reason}</Text>
              </Pressable>
            ))}

            {selectedReason === 'Other' && (
              <TextInput
                style={styles.customReasonInput}
                placeholder="Please describe the reason..."
                placeholderTextColor={colors.textMuted}
                value={customReason}
                onChangeText={setCustomReason}
                multiline
                numberOfLines={3}
              />
            )}

            <View style={styles.modalActions}>
              <Pressable
                style={[styles.button, styles.buttonSecondary]}
                onPress={() => setShowCancelModal(false)}
                disabled={busy}
              >
                <Text style={styles.buttonSecondaryText}>Keep trip</Text>
              </Pressable>
              <Pressable style={[styles.button, busy && styles.disabled]} onPress={() => void handleCancel()} disabled={busy}>
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Confirm cancellation</Text>}
              </Pressable>
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function PrimaryButton({ label, busy, onPress }: { label: string; busy: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.button, busy && styles.disabled]} onPress={onPress} disabled={busy}>
      {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{label}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.xl, backgroundColor: colors.surface },
  status: { fontSize: typography.size.xl, fontWeight: '700', marginBottom: spacing.lg },
  card: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: spacing.lg, marginBottom: spacing.lg },
  label: { fontSize: typography.size.sm, color: colors.textMuted },
  value: { fontSize: typography.size.md, fontWeight: '600' },
  fare: { fontSize: typography.size.xl, fontWeight: '700', color: colors.brand, marginTop: spacing.md },
  navButton: { borderWidth: 1, borderColor: colors.brandDark, borderRadius: 8, padding: spacing.md, alignItems: 'center', marginBottom: spacing.lg },
  navText: { color: colors.brandDark, fontWeight: '600', fontSize: typography.size.md },
  actions: { marginTop: 'auto', gap: spacing.sm },
  button: { backgroundColor: colors.brandDark, padding: spacing.lg, borderRadius: 8, alignItems: 'center' },
  disabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: typography.size.lg },
  buttonSecondary: { backgroundColor: colors.border },
  buttonSecondaryText: { color: colors.text, fontWeight: '600', fontSize: typography.size.lg },
  cancel: { padding: spacing.md, alignItems: 'center' },
  cancelText: { color: colors.danger, fontWeight: '600' },
  sos: { backgroundColor: colors.danger, padding: spacing.lg, borderRadius: 8, alignItems: 'center' },
  sosText: { color: '#fff', fontWeight: '700', fontSize: typography.size.lg },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: spacing.xl },
  modalTitle: { fontSize: typography.size.lg, fontWeight: '700', marginBottom: spacing.lg },
  reasonButton: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  reasonButtonSelected: { backgroundColor: colors.surfaceMuted },
  radioCircle: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.text, marginRight: spacing.md },
  radioCircleSelected: { backgroundColor: colors.brand, borderColor: colors.brand },
  reasonText: { fontSize: typography.size.md, fontWeight: '500' },
  customReasonInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
    fontSize: typography.size.md,
    color: colors.text,
    textAlignVertical: 'top',
  },
  modalActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
});

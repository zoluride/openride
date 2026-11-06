import {
  calculateSubscriptionFee,
  calculateVestingPercentage,
  checkDriverCompliance,
} from '@openride/domain';
import { colors, formatMoney, spacing, typography } from '@openride/ui';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { signOut } from '../lib/auth';
import { fetchMyVehicles, type DriverDocument, type Vehicle } from '../lib/driver-state';

interface Props {
  driverId: string;
  displayName?: string | null;
  online: boolean;
  grossEarnings: number | null;
  driverDocuments: DriverDocument[];
  onDocuments: () => void;
  mockVehicles?: Vehicle[];
  onSignOut?: () => void;
  onGoOnline: (vehicleId: string) => Promise<void>;
  onGoOffline: () => Promise<void>;
  onReport: () => void;
}

export function HomeScreen({
  driverId,
  displayName,
  online,
  grossEarnings,
  driverDocuments,
  onDocuments,
  mockVehicles,
  onSignOut,
  onGoOnline,
  onGoOffline,
  onReport,
}: Props) {
  const completedTrips = 350;
  const vestingPercentage = calculateVestingPercentage(completedTrips);
  const sharesEarned = (completedTrips / 750) * 1000;
  const compliance = checkDriverCompliance(driverDocuments);
  const [vehicles, setVehicles] = useState<Vehicle[]>(mockVehicles ?? []);
  const [selected, setSelected] = useState<string | null>(mockVehicles?.[0]?.id ?? null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (mockVehicles) return;
    let active = true;
    void fetchMyVehicles(driverId).then((vs) => {
      if (!active) return;
      setVehicles(vs);
      setSelected((cur) => cur ?? vs[0]?.id ?? null);
    });
    return () => {
      active = false;
    };
  }, [driverId, mockVehicles]);

  async function toggle(): Promise<void> {
    setBusy(true);
    try {
      if (online) {
        await onGoOffline();
      } else {
        if (!selected) throw new Error('Add an active vehicle before going online.');
        await onGoOnline(selected);
      }
    } catch (e) {
      Alert.alert(online ? 'Could not go offline' : 'Could not go online', (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'right', 'bottom', 'left']}>
      <View style={styles.header}>
        <Text style={styles.hi}>{displayName ?? 'Driver'}</Text>
        <View style={styles.headerLinks}>
          <Pressable onPress={onDocuments} hitSlop={8}>
            <Text style={styles.link}>Documents</Text>
          </Pressable>
          <Pressable onPress={onReport} hitSlop={8}>
            <Text style={styles.link}>Report</Text>
          </Pressable>
          <Pressable onPress={() => void (onSignOut ? onSignOut() : signOut())} hitSlop={8}>
            <Text style={styles.signOut}>Sign out</Text>
          </Pressable>
        </View>
      </View>

      <View style={[styles.statusPill, online ? styles.onlinePill : styles.offlinePill]}>
        <Text style={styles.statusText}>{online ? 'Online' : 'Offline'}</Text>
      </View>

      <Text style={styles.headline}>{online ? 'Waiting for an offer…' : 'You are offline'}</Text>

      <View style={styles.earnings}>
        <View style={styles.earningsRow}>
          <Text style={styles.earningLabel}>Gross earnings today</Text>
          <Text style={styles.earningValue}>
            {grossEarnings === null ? 'Unavailable' : formatMoney(grossEarnings * 100, 'NGN', 'en-NG')}
          </Text>
        </View>
        <View style={styles.earningsRow}>
          <Text style={styles.earningLabel}>Subscription fee today</Text>
          <Text style={styles.earningValue}>
            {grossEarnings === null
              ? 'Unavailable'
              : formatMoney(calculateSubscriptionFee(grossEarnings) * 100, 'NGN', 'en-NG')}
          </Text>
        </View>
      </View>

      <View style={styles.comparisonCard}>
        <View style={styles.comparisonColumns}>
          <View style={styles.comparisonColumn}>
            <Text style={styles.zoluLabel}>ZOLU</Text>
            <Text style={styles.comparisonCaption}>Net</Text>
            <Text style={styles.zoluFare}>₦2,500</Text>
          </View>
          <View style={styles.comparisonColumn}>
            <Text style={styles.competitorLabel}>Uber</Text>
            <Text style={styles.comparisonCaption}>Net</Text>
            <Text style={styles.competitorFare}>₦1,875</Text>
          </View>
          <View style={styles.comparisonColumn}>
            <Text style={styles.competitorLabel}>Bolt</Text>
            <Text style={styles.comparisonCaption}>Net</Text>
            <Text style={styles.competitorFare}>₦2,000</Text>
          </View>
        </View>
      </View>
      <Text style={styles.comparisonBanner}>You earned ₦625 more with ZOLU.</Text>

      <View style={styles.vesting}>
        <View style={styles.vestingHeader}>
          <Text style={styles.earningLabel}>Ownership vesting</Text>
          <Text style={styles.earningValue}>{vestingPercentage}%</Text>
        </View>
        <View
          style={styles.progressTrack}
          accessibilityRole="progressbar"
          accessibilityValue={{ min: 0, max: 100, now: vestingPercentage }}
        >
          <View style={[styles.progressFill, { width: `${vestingPercentage}%` }]} />
        </View>
        <View style={styles.vestingDetails}>
          <Text style={styles.vestingText}>{completedTrips} / 750 trips</Text>
          <Text style={styles.vestingText}>Shares Earned: {sharesEarned.toFixed(1)}</Text>
        </View>
      </View>

      {!online ? (
        <>
          <Text style={styles.label}>Vehicle</Text>
          {vehicles.length === 0 ? (
            <Text style={styles.muted}>
              No active vehicle assigned to you. An admin needs to add one before you can go online.
            </Text>
          ) : (
            vehicles.map((v) => (
              <Pressable
                key={v.id}
                style={[styles.vehicle, selected === v.id && styles.vehicleActive]}
                onPress={() => setSelected(v.id)}
              >
                <Text style={styles.vehicleRego}>{v.rego}</Text>
                <Text style={styles.muted}>
                  {v.make} {v.model} · {v.vehicle_type}
                </Text>
              </Pressable>
            ))
          )}
        </>
      ) : (
        <Text style={styles.muted}>
          Your location is shared while online (foreground). Offers will appear here automatically.
        </Text>
      )}

      <View style={styles.actions}>
        <Pressable
          style={[
            styles.button,
            online ? styles.danger : styles.primary,
            (!online && (!selected || !compliance.compliant)) && styles.disabled,
          ]}
          onPress={toggle}
          disabled={busy || (!online && (!selected || !compliance.compliant))}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>{online ? 'Go offline' : 'Go online'}</Text>
          )}
        </Pressable>
        {!compliance.compliant ? <Text style={styles.warning}>Verification Required</Text> : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.xl, backgroundColor: colors.surface },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xl },
  hi: { fontSize: typography.size.lg, fontWeight: '600' },
  headerLinks: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  link: { color: colors.brandDark, fontSize: typography.size.sm, fontWeight: '600' },
  signOut: { color: colors.danger, fontSize: typography.size.sm, fontWeight: '600' },
  statusPill: { alignSelf: 'flex-start', paddingVertical: spacing.xs, paddingHorizontal: spacing.md, borderRadius: 999, marginBottom: spacing.lg },
  onlinePill: { backgroundColor: colors.online },
  offlinePill: { backgroundColor: colors.offline },
  statusText: { color: '#fff', fontWeight: '600' },
  headline: { fontSize: typography.size.xl, fontWeight: '600', marginBottom: spacing.lg },
  earnings: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  earningsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md },
  earningLabel: { color: colors.textMuted, fontSize: typography.size.md, flexShrink: 1 },
  earningValue: { fontSize: typography.size.md, fontWeight: '600' },
  comparisonCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.sm,
  },
  comparisonColumns: { flexDirection: 'row', alignItems: 'stretch' },
  comparisonColumn: { flex: 1, minWidth: 0, alignItems: 'center', gap: spacing.xs },
  zoluLabel: { color: colors.success, fontSize: typography.size.sm, fontWeight: '700' },
  competitorLabel: { color: colors.textMuted, fontSize: typography.size.sm, fontWeight: '700' },
  comparisonCaption: { color: colors.textMuted, fontSize: typography.size.xs },
  zoluFare: { color: colors.success, fontSize: typography.size.md, fontWeight: '700' },
  competitorFare: { color: colors.textMuted, fontSize: typography.size.md, fontWeight: '600' },
  comparisonBanner: {
    color: colors.success,
    fontSize: typography.size.sm,
    fontWeight: '600',
    marginBottom: spacing.lg,
  },
  vesting: { marginBottom: spacing.lg, gap: spacing.sm },
  vestingHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressTrack: { height: 8, backgroundColor: colors.surfaceMuted, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.brand, borderRadius: 4 },
  vestingDetails: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md },
  vestingText: { color: colors.textMuted, fontSize: typography.size.sm },
  label: { fontSize: typography.size.sm, color: colors.textMuted, marginBottom: spacing.sm },
  muted: { color: colors.textMuted, fontSize: typography.size.md, lineHeight: 22 },
  vehicle: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: spacing.md, marginBottom: spacing.sm },
  vehicleActive: { borderColor: colors.brandDark, backgroundColor: colors.surfaceMuted },
  vehicleRego: { fontSize: typography.size.md, fontWeight: '600' },
  actions: { marginTop: 'auto' },
  button: { padding: spacing.lg, borderRadius: 8, alignItems: 'center' },
  primary: { backgroundColor: colors.brandDark },
  danger: { backgroundColor: colors.danger },
  disabled: { opacity: 0.5 },
  warning: { color: colors.danger, fontSize: typography.size.sm, fontWeight: '600', textAlign: 'center' },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: typography.size.lg },
});

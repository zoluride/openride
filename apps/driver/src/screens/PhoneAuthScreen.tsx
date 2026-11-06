import { colors, spacing, typography } from '@openride/ui';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { sendOtp, verifyOtp } from '../lib/auth';

export function PhoneAuthScreen({ onDevBypass }: { onDevBypass: () => void }) {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [stage, setStage] = useState<'phone' | 'code'>('phone');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSendOtp(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      await sendOtp(phone.trim());
      setStage('code');
    } catch (e) {
      setError((e as Error).message || 'Could not send code. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function onVerify(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      await verifyOtp(phone.trim(), code.trim());
    } catch (e) {
      setError((e as Error).message || 'Code did not match. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'right', 'bottom', 'left']}>
      <Text style={styles.title}>OpenRide Driver</Text>
      <Text style={styles.subtitle}>
        {stage === 'phone' ? 'Sign in with your driver phone number' : `Code sent to ${phone}`}
      </Text>
      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}

      {stage === 'phone' ? (
        <>
          <TextInput
            style={styles.input}
            placeholder="+61 400 000 000"
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
            editable={!busy}
          />
          <Pressable style={styles.button} onPress={onSendOtp} disabled={busy || phone.length < 6}>
            <Text style={styles.buttonText}>Send code</Text>
          </Pressable>
          {__DEV__ ? (
            <Pressable style={styles.devButton} onPress={onDevBypass}>
              <Text style={styles.devButtonText}>Dev Bypass Login</Text>
            </Pressable>
          ) : null}
        </>
      ) : (
        <>
          <TextInput
            style={styles.input}
            placeholder="6-digit code"
            keyboardType="number-pad"
            value={code}
            onChangeText={setCode}
            editable={!busy}
            maxLength={6}
          />
          <Pressable style={styles.button} onPress={onVerify} disabled={busy || code.length < 4}>
            <Text style={styles.buttonText}>Verify</Text>
          </Pressable>
          <Pressable onPress={() => setStage('phone')} disabled={busy}>
            <Text style={styles.link}>Use a different number</Text>
          </Pressable>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.xl, justifyContent: 'center', backgroundColor: colors.surface },
  title: { fontSize: typography.size.xxl, fontWeight: '700', color: colors.brandDark, marginBottom: spacing.sm },
  subtitle: { fontSize: typography.size.md, color: colors.textMuted, marginBottom: spacing.xl },
  error: {
    color: colors.danger,
    fontSize: typography.size.sm,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: spacing.md,
    fontSize: typography.size.md,
    marginBottom: spacing.md,
  },
  button: {
    backgroundColor: colors.brandDark,
    padding: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: typography.size.md },
  devButton: {
    borderWidth: 1,
    borderColor: colors.brandDark,
    padding: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  devButtonText: { color: colors.brandDark, fontWeight: '600', fontSize: typography.size.md },
  link: { color: colors.brandDark, textAlign: 'center', fontSize: typography.size.sm },
});

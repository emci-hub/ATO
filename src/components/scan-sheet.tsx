import { CameraView, useCameraPermissions } from 'expo-camera';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { AddPeerResult } from '@/lib/circle';
import { controlBorderColor } from '@/lib/theme/chrome';

type PendingPeer = { id: string; name: string; handle: string };

/**
 * Scan a friend's QR (or paste their @handle / ATO link) — the one gate that
 * opens Circle. A resolved peer always needs an explicit "Add" confirmation
 * tap before the connection is written; nothing auto-connects from a scan or
 * paste alone. Camera view is mounted only while the sheet is visible.
 */
export function ScanSheet({
  visible,
  onClose,
  onResolve,
  onConfirm,
  onConnected,
}: {
  visible: boolean;
  onClose: () => void;
  onResolve: (raw: string) => Promise<AddPeerResult>;
  onConfirm: (peer: PendingPeer) => Promise<AddPeerResult>;
  onConnected?: () => void;
}) {
  const theme = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [manual, setManual] = useState('');
  const [working, setWorking] = useState(false);
  const [pending, setPending] = useState<PendingPeer | null>(null);
  const [notice, setNotice] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const handledRef = useRef(false);

  useEffect(() => {
    if (!visible) {
      setWorking(false);
      setPending(null);
      setNotice(null);
      setManual('');
      handledRef.current = false;
    }
  }, [visible]);

  async function resolve(raw: string) {
    if (working) return;
    setWorking(true);
    setNotice(null);
    const result = await onResolve(raw);
    setWorking(false);
    if (result.ok) {
      setPending(result.peer);
    } else {
      setNotice({ tone: 'err', text: result.message });
      handledRef.current = false;
    }
  }

  function cancelPending() {
    setPending(null);
    setNotice(null);
    handledRef.current = false;
  }

  async function confirm() {
    if (!pending || working) return;
    setWorking(true);
    setNotice(null);
    const result = await onConfirm(pending);
    if (result.ok) {
      setPending(null);
      setNotice({ tone: 'ok', text: `Added ${result.peer.name} — Circle is open.` });
      handledRef.current = true;
      onConnected?.();
      setTimeout(onClose, 1200);
    } else {
      setNotice({ tone: 'err', text: result.message });
      handledRef.current = false;
      setWorking(false);
    }
  }

  const showCamera = visible && !pending && permission?.granted;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaProvider style={styles.provider}>
        <ThemedView style={styles.container}>
          <SafeAreaView style={styles.safe}>
          <View style={styles.header}>
            <ThemedText type="subtitle">Add a friend</ThemedText>
            <Pressable onPress={onClose} hitSlop={12} style={({ pressed }) => pressed && styles.pressed}>
              <MaterialCommunityIcons name="close" size={24} color={theme.text} />
            </Pressable>
          </View>

          {pending ? (
            <ThemedView type="backgroundElement" style={styles.confirmCard}>
              <ThemedText type="smallBold" style={styles.centerText}>
                Add {pending.name} (@{pending.handle}) to your Circle?
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
                They&apos;ll be able to see your Circle poster and Checks.
              </ThemedText>
              <View style={styles.confirmRow}>
                <Pressable
                  disabled={working}
                  onPress={cancelPending}
                  style={({ pressed }) => [
                    styles.secondaryButton,
                    { borderColor: controlBorderColor(theme) },
                    pressed && styles.pressed,
                    working && styles.disabled,
                  ]}>
                  <ThemedText type="smallBold">Cancel</ThemedText>
                </Pressable>
                <Pressable
                  disabled={working}
                  onPress={confirm}
                  style={({ pressed }) => [
                    styles.addButton,
                    { backgroundColor: '#3c87f7' },
                    pressed && styles.pressed,
                    working && styles.disabled,
                  ]}>
                  <ThemedText type="smallBold" style={styles.addButtonText}>
                    {working ? 'Adding…' : 'Add to Circle'}
                  </ThemedText>
                </Pressable>
              </View>
            </ThemedView>
          ) : (
            <>
              {showCamera ? (
                <View style={styles.cameraWrap}>
                  <CameraView
                    style={styles.camera}
                    facing="back"
                    barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                    onBarcodeScanned={({ data }) => {
                      if (!handledRef.current && data) {
                        handledRef.current = true;
                        resolve(data);
                      }
                    }}
                  />
                  <View style={styles.cameraHint} pointerEvents="none">
                    <ThemedText type="small" themeColor="textSecondary" style={styles.cameraHintText}>
                      Point at their QR
                    </ThemedText>
                  </View>
                </View>
              ) : permission && !permission.granted && !permission.canAskAgain ? (
                <ThemedView type="backgroundElement" style={styles.emptyBox}>
                  <ThemedText type="smallBold">Camera access is off</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
                    Turn on camera access for ATO in Settings, or paste their link below.
                  </ThemedText>
                </ThemedView>
              ) : null}

              {working ? (
                <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
                  Looking that up…
                </ThemedText>
              ) : null}

              {notice ? (
                <ThemedText
                  type="smallBold"
                  style={[styles.centerText, { color: notice.tone === 'ok' ? '#2E7D32' : '#E5484D' }]}>
                  {notice.text}
                </ThemedText>
              ) : null}

              <ThemedView type="backgroundElement" style={styles.manualCard}>
                <ThemedText type="smallBold">Can&apos;t scan?</ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
                  Paste their @handle or ATO link.
                </ThemedText>
                <View style={styles.inputRow}>
                  <TextInput
                    value={manual}
                    onChangeText={setManual}
                    placeholder="@handle or https://astrollogs.com/@…"
                    placeholderTextColor={theme.textSecondary}
                    autoCapitalize="none"
                    autoCorrect={false}
                    onSubmitEditing={() => manual.trim() && resolve(manual)}
                    style={[
                      styles.input,
                      { color: theme.text, backgroundColor: theme.backgroundSelected },
                    ]}
                  />
                  <Pressable
                    disabled={working || manual.trim().length === 0}
                    onPress={() => resolve(manual)}
                    style={({ pressed }) => [
                      styles.addButton,
                      { backgroundColor: '#3c87f7' },
                      pressed && styles.pressed,
                      (working || manual.trim().length === 0) && styles.disabled,
                    ]}>
                    <ThemedText type="smallBold" style={styles.addButtonText}>
                      Add
                    </ThemedText>
                  </Pressable>
                </View>
                {permission && !permission.granted && permission.canAskAgain ? (
                  <Pressable
                    onPress={requestPermission}
                    style={({ pressed }) => [styles.permissionButton, pressed && styles.pressed]}>
                    <ThemedText type="smallBold" themeColor="textSecondary">
                      Grant camera access
                    </ThemedText>
                  </Pressable>
                ) : null}
              </ThemedView>
            </>
          )}
        </SafeAreaView>
      </ThemedView>
      </SafeAreaProvider>
    </Modal>
  );
}

const styles = StyleSheet.create({
  provider: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  safe: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    gap: Spacing.three,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cameraWrap: {
    aspectRatio: 3 / 4,
    borderRadius: Spacing.four,
    overflow: 'hidden',
    position: 'relative',
  },
  camera: {
    flex: 1,
  },
  cameraHint: {
    position: 'absolute',
    bottom: Spacing.three,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: Spacing.five,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  cameraHintText: {
    color: '#ffffff',
  },
  emptyBox: {
    borderRadius: Spacing.four,
    padding: Spacing.four,
    gap: Spacing.two,
    alignItems: 'center',
  },
  manualCard: {
    borderRadius: Spacing.four,
    padding: Spacing.three,
    gap: Spacing.two,
    alignItems: 'center',
  },
  confirmCard: {
    borderRadius: Spacing.four,
    padding: Spacing.four,
    gap: Spacing.three,
    alignItems: 'center',
  },
  confirmRow: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    gap: Spacing.two,
  },
  secondaryButton: {
    flex: 1,
    borderRadius: Spacing.three,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    alignItems: 'center',
  },
  inputRow: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    gap: Spacing.two,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 14,
  },
  addButton: {
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  addButtonText: {
    color: '#ffffff',
  },
  permissionButton: {
    paddingVertical: Spacing.one,
  },
  centerText: {
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.8,
  },
  disabled: {
    opacity: 0.5,
  },
});

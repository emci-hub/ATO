import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedPressable } from '@/components/themed-pressable';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { fallbackCatchUpCard, offsetLabel, type OpenLogDay } from '@/lib/check-window';
import { controlBorderColor } from '@/lib/theme/chrome';
import { routeVoiceCard } from '@/lib/voice/router';
import { logJargonGuard } from '@/lib/voice/quota-server';
import { recordOwnDevTrace } from '@/lib/dev-trace-server';
import type { RouteVoiceCardInput, VoiceCard, VoiceSource } from '@/lib/voice/types';

export function MissedCheckCard({
  slot,
  routeInput,
  busy,
  onLog,
}: {
  slot: OpenLogDay;
  routeInput: Omit<RouteVoiceCardInput, 'day'>;
  busy: boolean;
  onLog: (status: 'done' | 'skipped', card: VoiceCard, source: VoiceSource) => void;
}) {
  const theme = useTheme();
  const [card, setCard] = useState<VoiceCard | null>(null);
  const [source, setSource] = useState<VoiceSource>('bank');

  useEffect(() => {
    let cancelled = false;
    routeVoiceCard({ ...routeInput, day: slot.day }, { logJargonHit: logJargonGuard, recordTrace: recordOwnDevTrace, traceSurface: 'sage' })
      .then((result) => {
        if (cancelled) return;
        if (result.card) {
          setCard(result.card);
          setSource(result.source === 'crisis' ? 'bank' : result.source);
          return;
        }
        if (result.consent === 'pending') {
          setCard(null);
          return;
        }
        setCard(fallbackCatchUpCard(slot.day));
        setSource('bank');
      })
      .catch(() => {
        if (!cancelled) {
          setCard(fallbackCatchUpCard(slot.day));
          setSource('bank');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [slot.day, routeInput.checkCount, routeInput.aiConsent]);

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <ThemedText type="code" themeColor="textSecondary" style={styles.kicker}>
        Day {slot.day} · {offsetLabel(slot.offset)}
      </ThemedText>
      {card ? (
        <>
          <ThemedText type="small">{card.read}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {card.do}
          </ThemedText>
          <View style={styles.row}>
            <ThemedPressable
              onPress={() => onLog('done', card, source)}
              disabled={busy}
              filled
              style={[styles.button, busy && styles.disabled]}>
              <ThemedText type="smallBold" style={{ color: theme.onAccent }}>
                Logged it
              </ThemedText>
            </ThemedPressable>
            <ThemedPressable
              onPress={() => onLog('skipped', card, source)}
              disabled={busy}
              style={[
                styles.button,
                { borderWidth: 1, borderColor: controlBorderColor(theme) },
                busy && styles.disabled,
              ]}>
              <ThemedText type="smallBold" themeColor="textSecondary">
                Skip
              </ThemedText>
            </ThemedPressable>
          </View>
        </>
      ) : (
        <ThemedText type="small" themeColor="textSecondary">
          Open Dawn to continue this day.
        </ThemedText>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Spacing.four,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  kicker: {
    textTransform: 'uppercase',
  },
  row: {
    gap: Spacing.two,
  },
  button: {
    borderRadius: Spacing.three,
    paddingVertical: Spacing.two,
    alignItems: 'center',
  },
  disabled: {
    opacity: 0.6,
  },
});

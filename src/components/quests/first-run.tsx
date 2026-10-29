import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { QUEST_TUTORIAL_KEY } from '@/lib/quests/run-store';
import { TUTORIAL_CARDS, UI_COPY, fmt } from '@/lib/quests/strings';
import { QT, QT_RADIUS, QT_SPACE, QT_TYPE } from '@/lib/quests/theme';

async function storage() {
  const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
  return AsyncStorage;
}

/**
 * The three first-run cards (ATO-BUILD PHASE-23), shown once on the Quests list.
 * `ato.quests.tutorial.v1` lives under `ato.quests.`, so sign-out clears it.
 * Nothing shows while Quests is off (`enabled` false) or while the flag is still
 * being read. A storage failure shows the cards (they are short) and never throws.
 */
export function QuestsFirstRun({ enabled }: { enabled: boolean }) {
  const [step, setStep] = useState<number | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    (async () => {
      let seen = false;
      try {
        seen = (await (await storage()).getItem(QUEST_TUTORIAL_KEY)) === '1';
      } catch {
        seen = false;
      }
      if (alive && !seen) setStep(0);
    })();
    return () => {
      alive = false;
    };
  }, [enabled]);

  if (!enabled || step === null) return null;
  const card = TUTORIAL_CARDS[step]!;
  const last = step === TUTORIAL_CARDS.length - 1;

  const next = () => {
    if (!last) {
      setStep(step + 1);
      return;
    }
    setStep(null);
    void storage()
      .then((s) => s.setItem(QUEST_TUTORIAL_KEY, '1'))
      .catch((err) => console.log('[quests] tutorial flag not saved:', err instanceof Error ? err.message : err));
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={next}>
      <View style={styles.backdrop}>
        <View style={styles.card} accessibilityViewIsModal>
          <Text style={styles.step}>{fmt(UI_COPY.tutorialStep, { n: step + 1, total: TUTORIAL_CARDS.length })}</Text>
          <Text style={styles.title} accessibilityRole="header">
            {card.title}
          </Text>
          <Text style={styles.body}>{card.body}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={last ? UI_COPY.tutorialDone : UI_COPY.tutorialNext}
            onPress={next}
            style={styles.button}>
            <Text style={styles.buttonText}>{last ? UI_COPY.tutorialDone : UI_COPY.tutorialNext}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: QT_SPACE.gutter },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: QT_RADIUS.card,
    backgroundColor: QT.bg,
    borderWidth: 1,
    borderColor: QT.glassBorder,
    padding: QT_SPACE.pad + 4,
    gap: 12,
  },
  step: { ...QT_TYPE.small, color: QT.sub },
  title: { ...QT_TYPE.h1, color: QT.text },
  body: { ...QT_TYPE.body, color: QT.sub },
  button: {
    minHeight: 48,
    borderRadius: QT_RADIUS.pill,
    backgroundColor: 'rgba(34,211,238,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(34,211,238,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { ...QT_TYPE.ui, color: QT.text },
});

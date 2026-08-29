import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { SettingsFold } from '@/components/settings-fold';
import { ThemedPressable } from '@/components/themed-pressable';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { updateTraits, type Me } from '@/lib/me';
import {
  QUESTIONS_EMPTY_CONSENT,
  QUESTIONS_EMPTY_CRISIS,
  QUESTIONS_EMPTY_DENIED,
  QUESTIONS_EMPTY_QUOTA,
  QUESTIONS_EMPTY_TRY,
  QUESTIONS_LABEL,
  QUESTIONS_LEDE,
} from '@/lib/questions/copy';
import { generateQuestionBatch } from '@/lib/questions/generate';
import { routeQuestions } from '@/lib/questions/route';
import {
  answerQuestionItem,
  fetchLatestQuestionPack,
  saveQuestionPack,
} from '@/lib/questions/store';
import type { QuestionItemRow, RouteQuestionsResult } from '@/lib/questions/types';
import { controlBorderColor } from '@/lib/theme/chrome';
import { VOICE_CONFIG } from '@/lib/voice/config';
import { claimQuestionsBatch } from '@/lib/voice/quota-server';
import type { CheckHistory } from '@/lib/voice/types';

function emptyCopy(kind: RouteQuestionsResult['kind']): string | null {
  switch (kind) {
    case 'consent-pending':
      return QUESTIONS_EMPTY_CONSENT;
    case 'consent-denied':
      return QUESTIONS_EMPTY_DENIED;
    case 'crisis':
      return QUESTIONS_EMPTY_CRISIS;
    case 'quota':
      return QUESTIONS_EMPTY_QUOTA;
    case 'empty':
      return QUESTIONS_EMPTY_TRY;
    default:
      return null;
  }
}

export function QuestionsFold({
  me,
  history,
  crisisToday,
  onUpdated,
}: {
  me: Me;
  history: CheckHistory[];
  crisisToday: boolean;
  onUpdated: () => Promise<void>;
}) {
  const theme = useTheme();
  const [result, setResult] = useState<RouteQuestionsResult | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const next = await routeQuestions(
      {
        me,
        history,
        aiConsent: me.ai_consent,
        crisisToday,
      },
      {
        loadLatestPack: fetchLatestQuestionPack,
        savePack: saveQuestionPack,
        claimBatch: claimQuestionsBatch,
        generateBatch: generateQuestionBatch,
        useLocal: VOICE_CONFIG.provider === 'local' || !VOICE_CONFIG.geminiApiKey,
      },
    );
    setResult(next);
  }, [me, history, crisisToday]);

  function handleOpen() {
    void load().catch((err) => {
      console.log('[questions] route error:', err);
      setResult({ kind: 'empty', pack: null, item: null });
    });
  }

  async function pick(item: QuestionItemRow, index: number) {
    const option = item.options[index];
    if (!option || busy) return;
    setBusy(true);
    try {
      if (!item.id.startsWith('local-')) {
        await answerQuestionItem(item.id, index);
      }
      await updateTraits(me.id, { [item.axis]: option.value }, 'self_situation', [item.axis]);
      await onUpdated();
      await load();
    } catch (err) {
      console.log('[questions] answer error:', err);
    } finally {
      setBusy(false);
    }
  }

  const empty = result ? emptyCopy(result.kind) : null;
  const item = result?.item ?? null;

  return (
    <SettingsFold title={QUESTIONS_LABEL} onOpen={handleOpen}>
      <View style={styles.body}>
          <ThemedText type="small" themeColor="textSecondary">
            {QUESTIONS_LEDE}
          </ThemedText>
          {empty ? (
            <ThemedText type="small" themeColor="textSecondary">
              {empty}
            </ThemedText>
          ) : item ? (
            <>
              <ThemedText>{item.prompt}</ThemedText>
              <View style={styles.options}>
                {item.options.map((option, index) => (
                  <ThemedPressable
                    key={`${item.id}-${index}`}
                    disabled={busy}
                    onPress={() => void pick(item, index)}
                    style={[
                      styles.option,
                      { borderColor: controlBorderColor(theme) },
                      busy && styles.disabled,
                    ]}>
                    <ThemedText type="smallBold">{option.text}</ThemedText>
                  </ThemedPressable>
                ))}
              </View>
            </>
          ) : (
            <ThemedText themeColor="textSecondary">Loading…</ThemedText>
          )}
        </View>
      </SettingsFold>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
  },
  options: {
    gap: Spacing.two,
  },
  option: {
    borderWidth: 1,
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
  },
  disabled: {
    opacity: 0.5,
  },
});

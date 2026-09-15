import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ChipGroup } from '@/components/intake-chips';
import { ThemedPressable } from '@/components/themed-pressable';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  CORE_INTAKE_QUESTIONS,
  INTAKE_SETTINGS_LABELS,
  TALK_STYLE_PREVIEWS,
  displayIntakeValue,
} from '@/lib/intake';
import { updateIntake, type IntakePatch, type Me, type TalkStyle } from '@/lib/me';

const TALK_STYLE_QUESTION = CORE_INTAKE_QUESTIONS.find((question) => question.field === 'talk_style')!;

/**
 * talk_style row. Same picker, preview, and updateIntake write as when it
 * lived as chip 1 of How you show up. Mounted in How Sage sounds on You.
 */
export function TalkStylePicker({
  me,
  onUpdated,
}: {
  me: Me;
  onUpdated: () => Promise<void>;
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewTalk, setPreviewTalk] = useState<TalkStyle | null>(null);

  async function save(patch: IntakePatch) {
    if (saving) return;
    setSaving(true);
    try {
      await updateIntake(me.id, patch);
      await onUpdated();
    } catch (err) {
      console.log('[intake-settings] save error:', err);
      setPreviewTalk(me.talk_style);
    } finally {
      setSaving(false);
    }
  }

  function onSelect(value: string) {
    setPreviewTalk(value as TalkStyle);
    if (me.talk_style === value) return;
    void save({ talk_style: value } as IntakePatch);
  }

  return (
    <View>
      <ThemedPressable
        accessibilityRole="button"
        accessibilityLabel={INTAKE_SETTINGS_LABELS.talk_style}
        accessibilityState={{ expanded: open }}
        onPress={() => {
          if (open) {
            setOpen(false);
            return;
          }
          setOpen(true);
          setPreviewTalk(me.talk_style);
        }}
        style={[styles.row, open && { backgroundColor: theme.backgroundSelected }]}>
        <ThemedText type="small" themeColor="textSecondary">
          {INTAKE_SETTINGS_LABELS.talk_style}
        </ThemedText>
        <ThemedText type="small" style={styles.value}>
          {displayIntakeValue('talk_style', me)}
        </ThemedText>
      </ThemedPressable>
      {open ? (
        <View style={styles.chips}>
          <ThemedText type="small" themeColor="textSecondary">
            {TALK_STYLE_QUESTION.prompt}
          </ThemedText>
          <ChipGroup
            chips={TALK_STYLE_QUESTION.chips}
            selected={[previewTalk ?? me.talk_style ?? 'even']}
            disabled={saving}
            inset
            onSelect={onSelect}
          />
          <ThemedText type="small" themeColor="textSecondary" style={styles.preview}>
            {TALK_STYLE_PREVIEWS[previewTalk ?? me.talk_style ?? 'even']}
          </ThemedText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    borderRadius: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  value: {
    flex: 1,
    textAlign: 'right',
  },
  chips: {
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
  },
  preview: {
    lineHeight: 20,
  },
});

/**
 * The Divecore Guide screen (v26, Part C) — renders `guideSections()` (every
 * number from the game's own constants). Section chips on top; a "?" button
 * elsewhere opens it straight at its section. Used in Pet → Info → Guide and
 * in the Dive Info sheet.
 */
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Fonts } from '@/constants/theme';
import { GUIDE_SECTIONS, GUIDE_TITLE, guideSections, type GuideSection } from '@/play/guide-content';
import { NeonChip, NeonLabel } from '@/play/neon-ui';
import { NEON } from '@/play/neon-viper';

export function GuideView({ initial = 'pet' }: { initial?: GuideSection | null }) {
  const [section, setSection] = useState<GuideSection>(initial ?? 'pet');
  useEffect(() => {
    if (initial) setSection(initial);
  }, [initial]);
  const shown = guideSections().find((s) => s.id === section);
  return (
    <View style={styles.wrap}>
      <View style={styles.chips}>
        {GUIDE_SECTIONS.map((id) => (
          <NeonChip key={id} label={GUIDE_TITLE[id]} selected={id === section} onPress={() => setSection(id)} />
        ))}
      </View>
      {shown ? (
        <>
          <NeonLabel>{shown.title}</NeonLabel>
          {shown.lines.map((line) => (
            <Text key={line} style={styles.body}>
              • {line}
            </Text>
          ))}
        </>
      ) : null}
    </View>
  );
}

/** A small "?" that opens the Guide at a section. */
export function GuideLink({ section, onOpen, label }: { section: GuideSection; onOpen: (s: GuideSection) => void; label?: string }) {
  return (
    <NeonChip
      label={`? ${label ?? GUIDE_TITLE[section]}`}
      onPress={() => onOpen(section)}
      accessibilityLabel={`Open the Guide: ${GUIDE_TITLE[section]}`}
    />
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  body: { fontFamily: Fonts.mono, fontSize: 12, lineHeight: 18, color: NEON.textMuted },
});

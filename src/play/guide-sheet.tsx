/**
 * The Divecore Guide — seven short cards. Each face is a mark, a title, and
 * one or two lines. More opens the full constants (the same numbers the game
 * rolls). It never blocks play.
 */
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { GUIDE_TITLE, guideSections, type GuideSection } from '@/play/guide-content';
import { NeonChip } from '@/play/neon-ui';
import { NEON } from '@/play/neon-viper';
import { PLAY_BODY_FONT, PLAY_HUD_FONT } from '@/play/play-fonts';

export function GuideView({ initial = null }: { initial?: GuideSection | null }) {
  const [openId, setOpenId] = useState<GuideSection | null>(initial ?? null);
  useEffect(() => {
    setOpenId(initial ?? null);
  }, [initial]);
  const cards = guideSections();
  return (
    <View style={styles.wrap}>
      {cards.map((card) => {
        const open = openId === card.id;
        return (
          <View key={card.id} style={styles.card}>
            <View style={styles.row}>
              <View style={styles.mark}>
                <Text style={styles.markText}>{card.mark}</Text>
              </View>
              <View style={styles.copy}>
                <Text style={styles.title} accessibilityRole="header">
                  {card.title}
                </Text>
                {card.face.map((line) => (
                  <Text key={line} style={styles.face}>
                    {line}
                  </Text>
                ))}
              </View>
            </View>
            <Pressable
              onPress={() => setOpenId(open ? null : card.id)}
              accessibilityRole="button"
              accessibilityLabel={open ? `Hide ${card.title}` : `More about ${card.title}`}
              style={styles.moreHit}>
              <Text style={styles.more}>{open ? 'Hide' : 'More'}</Text>
            </Pressable>
            {open
              ? card.lines.map((line) => (
                  <Text key={line} style={styles.body}>
                    {line}
                  </Text>
                ))
              : null}
          </View>
        );
      })}
    </View>
  );
}

/** A small "?" that opens the Guide at a section (More already open). */
export function GuideLink({ section, onOpen, label }: { section: GuideSection; onOpen: (s: GuideSection) => void; label?: string }) {
  return (
    <NeonChip
      label={label ?? `? ${GUIDE_TITLE[section]}`}
      onPress={() => onOpen(section)}
      accessibilityLabel={`Open the Guide: ${GUIDE_TITLE[section]}`}
    />
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  card: {
    gap: 8,
    padding: 14,
    borderWidth: 1,
    borderColor: NEON.cyanBorder,
    borderRadius: 8,
    backgroundColor: NEON.panel,
  },
  row: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  mark: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: NEON.cyanDim,
    backgroundColor: NEON.cyanSoft,
  },
  markText: { fontSize: 22 },
  copy: { flex: 1, gap: 4 },
  title: {
    fontFamily: PLAY_HUD_FONT,
    fontSize: 16,
    letterSpacing: 0.6,
    color: NEON.cyan,
  },
  face: {
    fontFamily: PLAY_BODY_FONT,
    fontSize: 15,
    lineHeight: 20,
    color: NEON.textPrimary,
  },
  moreHit: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
  more: {
    fontFamily: PLAY_HUD_FONT,
    fontSize: 13,
    letterSpacing: 0.8,
    color: NEON.cyan,
  },
  body: {
    fontFamily: PLAY_BODY_FONT,
    fontSize: 14,
    lineHeight: 20,
    color: NEON.textMuted,
  },
});

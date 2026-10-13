/**
 * "Your haul" — the end-of-run reveal (emci 2026-10-13). During a dive the finds show
 * only their category icon + rarity colour (`FindIcon mystery`); heading up opens this
 * sheet: one face-down card per find, tap a card to flip it (or Reveal all), Done closes.
 * Same pattern as loot-reveal screens in extraction / roguelite games. Paint only — the
 * haul is already banked; nothing here changes the save.
 */
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming, runOnJS } from 'react-native-reanimated';

import { FindIcon } from '@/play/dive-hud';
import { FIND_CATEGORY_LABEL, findCategory } from '@/play/dive-loot';
import { GLOW_COLOR, findGlow } from '@/play/dive-fx-model';
import { shownFindName } from '@/play/dive-street-names';
import { PIXEL } from '@/play/pixel-theme';
import { STREET, STREET_FONT, StreetFrame, streetButtonPiece, streetButtonText } from '@/play/street-ui';
import { tapHaptic } from '@/play/street-feel';

const RARITY_LABEL: Record<string, string> = { common: 'Common', rare: 'Rare', epic: 'Epic', legendary: 'Legendary' };

function RevealCard({ id, open, onFlip, still }: { id: string; open: boolean; onFlip: () => void; still: boolean }) {
  const glow = findGlow(id);
  const color = GLOW_COLOR[glow];
  const flip = useSharedValue(1);
  const [face, setFace] = useState(open);
  useEffect(() => {
    if (open === face) return;
    if (still) {
      setFace(open);
      return;
    }
    // Squash to the edge, swap the face, open back up.
    flip.value = withSequence(
      withTiming(0, { duration: 130 }, (done) => {
        if (done) runOnJS(setFace)(open);
      }),
      withTiming(1, { duration: 170 }),
    );
  }, [open, face, still, flip]);
  const style = useAnimatedStyle(() => ({ transform: [{ scaleX: Math.max(0.02, flip.value) }] }));
  return (
    <Pressable
      onPress={open ? undefined : onFlip}
      accessibilityRole="button"
      accessibilityLabel={
        open
          ? `${shownFindName(id)}, ${RARITY_LABEL[glow] ?? glow}`
          : `${FIND_CATEGORY_LABEL[findCategory(id)]}, ${RARITY_LABEL[glow] ?? glow}. Tap to reveal.`
      }
      style={styles.cardHit}>
      <Animated.View style={[styles.card, { borderColor: color }, face && { backgroundColor: '#2A2440' }, style]}>
        {face ? (
          <>
            <FindIcon id={id} size={56} bare />
            <Text style={styles.name} numberOfLines={2} maxFontSizeMultiplier={1.2}>
              {shownFindName(id)}
            </Text>
            <Text style={[styles.rarity, { color }]} maxFontSizeMultiplier={1.1}>
              {(RARITY_LABEL[glow] ?? glow).toUpperCase()}
            </Text>
          </>
        ) : (
          <>
            <View style={styles.dim}>
              <FindIcon id={id} size={44} bare mystery />
            </View>
            <Text style={styles.category} maxFontSizeMultiplier={1.1}>
              {FIND_CATEGORY_LABEL[findCategory(id)]}
            </Text>
            <Text style={styles.mark}>?</Text>
          </>
        )}
      </Animated.View>
    </Pressable>
  );
}

function SheetButton({ label, primary, onPress }: { label: string; primary: boolean; onPress: () => void }) {
  const variant = primary ? 'primary' : 'secondary';
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={styles.btnHit}>
      {({ pressed }) => (
        <StreetFrame piece={streetButtonPiece(variant, pressed)} style={styles.btn}>
          <Text style={[styles.btnText, { color: streetButtonText(variant) }]} maxFontSizeMultiplier={1.2}>
            {label}
          </Text>
        </StreetFrame>
      )}
    </Pressable>
  );
}

export function HaulReveal({ ids, still, onDone }: { ids: readonly string[]; still: boolean; onDone: () => void }) {
  const [open, setOpen] = useState<boolean[]>(() => ids.map(() => false));
  const allOpen = open.every(Boolean);
  const flip = (i: number) => {
    tapHaptic();
    setOpen((o) => o.map((v, j) => (j === i ? true : v)));
  };
  return (
    <View style={styles.backdrop} accessibilityViewIsModal>
      <View style={styles.sheet}>
        <Text style={styles.title} maxFontSizeMultiplier={1.2} accessibilityRole="header">
          Back up! Your haul
        </Text>
        <Text style={styles.hint} maxFontSizeMultiplier={1.2}>
          {allOpen ? `${ids.length} ${ids.length === 1 ? 'find' : 'finds'} in the bag` : 'Tap a card to reveal'}
        </Text>
        <ScrollView style={styles.gridScroll} contentContainerStyle={styles.grid}>
          {ids.map((id, i) => (
            <RevealCard key={`${id}-${i}`} id={id} open={open[i] ?? false} onFlip={() => flip(i)} still={still} />
          ))}
        </ScrollView>
        <SheetButton
          label={allOpen ? 'Done' : 'Reveal all'}
          primary
          onPress={() => {
            tapHaptic();
            if (allOpen) onDone();
            else setOpen(ids.map(() => true));
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8, 9, 20, 0.82)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    zIndex: 50,
  },
  sheet: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#14152A',
    borderWidth: 2,
    borderColor: '#46465A',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 14,
    alignItems: 'center',
    gap: 10,
  },
  title: { fontFamily: STREET_FONT.bold, fontSize: 22, color: STREET.paper },
  hint: { fontFamily: STREET_FONT.regular, fontSize: 13, color: STREET.muted },
  // Scrolls on small phones with a big haul (3+ rows).
  gridScroll: { maxHeight: 420, alignSelf: 'stretch' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10, paddingVertical: 4 },
  cardHit: { width: 108, height: 132 },
  card: {
    flex: 1,
    borderWidth: 3,
    borderRadius: 10,
    backgroundColor: '#2E3040',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    gap: 4,
  },
  dim: { opacity: 0.6 },
  category: { fontFamily: STREET_FONT.bold, fontSize: 12, color: STREET.paper },
  mark: { fontFamily: STREET_FONT.bold, fontSize: 26, lineHeight: 28, color: PIXEL.amber },
  name: { fontFamily: STREET_FONT.bold, fontSize: 12, lineHeight: 14, color: STREET.paper, textAlign: 'center' },
  rarity: { fontFamily: STREET_FONT.bold, fontSize: 10 },
  btnHit: { width: 220, height: 48, marginTop: 4 },
  btn: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontFamily: STREET_FONT.bold, fontSize: 15 },
});

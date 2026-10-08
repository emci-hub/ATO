/**
 * Museum of legends — the cards (2026-10-08).
 *
 *   LegendLabel      — a museum label in today's three (no AI, nothing spent)
 *   LegendStoryCard  — the full card: hand-written label + facts with sources,
 *                      then the "you" part (AI badge only when the model wrote it)
 *   LegendShareSheet — preview, then share the 9:16 image (label + essence only,
 *                      never the story) — the same on-screen Modal capture as
 *                      share-card.tsx, so the card is visible when captured
 *
 * Pure views: no fetches and no model calls here. "Meet them" is a callback
 * the screen owns (`check:no-auto-ai` lists this file).
 */
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRef, useState, type ComponentProps } from 'react';
import { ActivityIndicator, Linking, Modal, Pressable, StyleSheet, View } from 'react-native';

import { AiBadge } from '@/components/ai-badge';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { AXIS_POLE_NAME } from '@/lib/axis-poles';
import type { LegendOffer, LegendSlot } from '@/lib/legend-figures/pick';
import { shownFacts, shownMoments, type LegendStory } from '@/lib/legend-figures/story';
import { HALL_LABEL, type LegendFigure, type LegendHall } from '@/lib/legend-figures/types';
import { SHARE_FAILED_COPY, SHARE_UNAVAILABLE_COPY, shareViewAsImage } from '@/lib/share';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

export const HALL_ICON: Record<LegendHall, IconName> = {
  history: 'book-open-variant',
  science: 'flask-outline',
  art: 'palette-outline',
  explorers: 'compass-outline',
  sport: 'run-fast',
  myth: 'castle',
  ghosts: 'ghost-outline',
};

/** One fixed colour per hall (mid-tones that read on light and dark surfaces). */
export const HALL_COLOR: Record<LegendHall, string> = {
  history: '#BA7517',
  science: '#378ADD',
  art: '#7F77DD',
  explorers: '#1D9E75',
  sport: '#D85A30',
  myth: '#D4537E',
  ghosts: '#888780',
};

export const SLOT_LABEL: Record<LegendSlot, string> = {
  close: 'Close match',
  surprise: 'A surprise',
  other_side: 'Your other side',
  on_this_day: 'On this day',
};

export const STORY_NOT_HISTORY = 'Story, not history';

function Chip({ label, color }: { label: string; color?: string }) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.chip,
        color ? { backgroundColor: `${color}22`, borderColor: `${color}55` } : { backgroundColor: theme.backgroundSelected, borderColor: theme.border },
      ]}>
      <ThemedText type="small" style={color ? { color } : undefined} themeColor={color ? undefined : 'textSecondary'}>
        {label}
      </ThemedText>
    </View>
  );
}

function HallBadge({ hall, size = 48 }: { hall: LegendHall; size?: number }) {
  const color = HALL_COLOR[hall];
  return (
    <View style={[styles.badge, { width: size, height: size, borderRadius: size / 2, backgroundColor: `${color}22` }]}>
      <MaterialCommunityIcons name={HALL_ICON[hall]} size={Math.round(size * 0.5)} color={color} />
    </View>
  );
}

function LabelHead({ legend }: { legend: LegendFigure }) {
  return (
    <>
      <View style={styles.chips}>
        <Chip label={HALL_LABEL[legend.hall]} color={HALL_COLOR[legend.hall]} />
        {legend.kind === 'story' ? <Chip label={STORY_NOT_HISTORY} /> : null}
        <Chip label={`${legend.place} · ${legend.era}`} />
      </View>
      <View style={styles.nameRow}>
        <HallBadge hall={legend.hall} />
        <View style={styles.flex}>
          <ThemedText type="subheading">{legend.name}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {legend.essence}
          </ThemedText>
        </View>
      </View>
    </>
  );
}

/** A label in today's three. */
export function LegendLabel({
  legend,
  offer,
  teaser,
  state,
  onMeet,
}: {
  legend: LegendFigure;
  offer: LegendOffer;
  teaser: string;
  /** ready = "Meet them" live; loading = this one is being written; done = a pick was made today. */
  state: 'ready' | 'loading' | 'done';
  onMeet: () => void;
}) {
  const theme = useTheme();
  const slot = offer.hidden ? 'Hidden legend' : SLOT_LABEL[offer.slot];
  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }, state === 'done' && styles.dim]}>
      <ThemedText type="smallBold" style={{ color: HALL_COLOR[legend.hall] }}>
        {slot}
      </ThemedText>
      <LabelHead legend={legend} />
      <ThemedText type="small" style={styles.teaser}>
        {teaser}
      </ThemedText>
      {state === 'done' ? null : (
        <Pressable
          onPress={onMeet}
          disabled={state === 'loading'}
          accessibilityRole="button"
          accessibilityLabel={`Meet ${legend.name}`}
          style={({ pressed }) => [styles.button, { backgroundColor: theme.accentFill }, pressed && styles.pressed]}>
          {state === 'loading' ? (
            <ActivityIndicator color={theme.onAccent} />
          ) : (
            <ThemedText type="smallBold" style={{ color: theme.onAccent }}>
              Meet them
            </ThemedText>
          )}
        </Pressable>
      )}
    </View>
  );
}

export function circleLine(names: readonly string[], legendName: string): string | null {
  if (names.length === 0) return null;
  if (names.length === 1) return `You and ${names[0]} both met ${legendName}.`;
  if (names.length === 2) return `You, ${names[0]} and ${names[1]} have all met ${legendName}.`;
  return `You, ${names[0]}, ${names[1]} and ${names.length - 2} more from your Circle have met ${legendName}.`;
}

/** The full card. */
export function LegendStoryCard({
  legend,
  story,
  friends,
  aiOff,
  onShare,
}: {
  legend: LegendFigure;
  story: LegendStory;
  friends: readonly string[];
  /** AI was off for this card, so the "you" part is the museum's own words. */
  aiOff: boolean;
  onShare: () => void;
}) {
  const theme = useTheme();
  const moments = shownMoments(legend);
  const facts = shownFacts(legend);
  const circle = circleLine(friends, legend.name);
  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      <LabelHead legend={legend} />

      <Section title="Who they were">{legend.whoTheyWere}</Section>
      <Section title={legend.kind === 'story' ? 'Known for, in the story' : 'Famous for'}>{legend.famousFor}</Section>

      <View style={[styles.rule, { borderColor: theme.border }]} />
      <View style={styles.sectionHead}>
        <ThemedText type="small" themeColor="textSecondary">
          Where you match
        </ThemedText>
        {story.source === 'ai' ? <AiBadge /> : null}
      </View>
      {story.whereYouMatch.map((row) => (
        <View key={row.axis} style={styles.matchRow}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
            Your {AXIS_POLE_NAME[row.axis][row.lean]} side
          </ThemedText>
          <ThemedText type="small" style={styles.matchThem}>
            {row.them}
          </ThemedText>
        </View>
      ))}

      <ThemedText type="small" themeColor="textSecondary" style={styles.sectionTitle}>
        The moment it mattered
      </ThemedText>
      {story.howTheTraitWon.map((row, index) => {
        const moment = moments.find((m) => m.id === row.momentId);
        if (!moment) return null;
        return (
          <View key={`${row.momentId}-${index}`} style={styles.momentBlock}>
            <View style={[styles.moment, { backgroundColor: theme.backgroundSelected }]}>
              <ThemedText type="small">{moment.text}</ThemedText>
            </View>
            <ThemedText type="small" themeColor="textSecondary">
              {row.line}
            </ThemedText>
          </View>
        );
      })}

      <Section title="What it means for you">{story.whatItMeansForYou}</Section>
      {aiOff ? (
        <ThemedText type="small" themeColor="textSecondary">
          AI is off, so this card uses the museum’s own words.
        </ThemedText>
      ) : null}

      {circle ? (
        <View style={styles.circleRow}>
          <MaterialCommunityIcons name="account-group-outline" size={16} color={theme.textSecondary} />
          <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
            {circle}
          </ThemedText>
        </View>
      ) : null}

      <View style={[styles.rule, { borderColor: theme.border }]} />
      <ThemedText type="small" themeColor="textSecondary">
        {legend.kind === 'story' ? 'The story as told' : 'Facts'} · tap one for its source
      </ThemedText>
      {facts.map((fact) => (
        <Pressable
          key={fact.id}
          onPress={() => void Linking.openURL(fact.source.url)}
          accessibilityRole="link"
          accessibilityLabel={`${fact.text} Open the source`}
          style={({ pressed }) => [styles.factRow, pressed && styles.pressed]}>
          <MaterialCommunityIcons name="book-outline" size={14} color={theme.accent} style={styles.factIcon} />
          <ThemedText type="small" style={styles.flex}>
            {fact.text}
          </ThemedText>
        </Pressable>
      ))}

      <Pressable
        onPress={onShare}
        accessibilityRole="button"
        accessibilityLabel={`Share ${legend.name}`}
        style={({ pressed }) => [styles.secondary, { borderColor: theme.controlBorder ?? theme.border }, pressed && styles.pressed]}>
        <MaterialCommunityIcons name="share-variant-outline" size={16} color={theme.text} />
        <ThemedText type="smallBold">Share this legend</ThemedText>
      </Pressable>
    </View>
  );
}

function Section({ title, children }: { title: string; children: string }) {
  return (
    <View style={styles.section}>
      <ThemedText type="small" themeColor="textSecondary">
        {title}
      </ThemedText>
      <ThemedText>{children}</ThemedText>
    </View>
  );
}

/** Preview first, then share (a visible card in a Modal, as share-card.tsx does). */
export function LegendShareSheet({
  legend,
  visible,
  onClose,
}: {
  legend: LegendFigure;
  visible: boolean;
  onClose: () => void;
}) {
  const cardRef = useRef<View>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const color = HALL_COLOR[legend.hall];

  async function share() {
    if (busy) return;
    setBusy(true);
    setNote(null);
    const outcome = await shareViewAsImage(cardRef);
    if (outcome === 'unavailable') setNote(SHARE_UNAVAILABLE_COPY);
    if (outcome === 'failed') setNote(SHARE_FAILED_COPY);
    setBusy(false);
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View ref={cardRef} collapsable={false} style={styles.share}>
          <View style={[styles.shareChip, { borderColor: color }]}>
            <ThemedText type="small" style={{ color }}>
              {HALL_LABEL[legend.hall]}
            </ThemedText>
          </View>
          <HallBadge hall={legend.hall} size={96} />
          <ThemedText type="subtitle" style={styles.shareName}>
            {legend.name}
          </ThemedText>
          <ThemedText style={styles.shareEssence}>{legend.essence}</ThemedText>
          <ThemedText type="small" style={styles.shareMeta}>
            {legend.kind === 'story' ? `${STORY_NOT_HISTORY} · ${legend.place}` : `${legend.place} · ${legend.era}`}
          </ThemedText>
          <ThemedText type="smallBold" style={styles.shareFoot}>
            A legend from my museum on ATO
          </ThemedText>
        </View>
        {note ? <ThemedText style={styles.shareNote}>{note}</ThemedText> : null}
        <View style={styles.shareActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Share this image"
            disabled={busy}
            onPress={() => void share()}
            style={({ pressed }) => [styles.sharePrimary, (pressed || busy) && styles.pressed]}>
            <ThemedText type="smallBold" style={styles.sharePrimaryText}>
              {busy ? 'Preparing…' : 'Share'}
            </ThemedText>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={onClose}
            style={({ pressed }) => [styles.shareSecondary, pressed && styles.pressed]}>
            <ThemedText type="smallBold" style={styles.sharePrimaryText}>
              Close
            </ThemedText>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  dim: { opacity: 0.55 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  badge: { alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  teaser: { fontStyle: 'italic' },
  button: {
    minHeight: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.one,
  },
  secondary: {
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.one,
  },
  pressed: { opacity: 0.7 },
  section: { gap: 2 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { marginTop: Spacing.one },
  rule: { borderTopWidth: StyleSheet.hairlineWidth, marginVertical: Spacing.one },
  matchRow: { flexDirection: 'row', gap: Spacing.two, alignItems: 'flex-start' },
  matchThem: { flex: 1, textAlign: 'right' },
  momentBlock: { gap: 4 },
  moment: { borderRadius: 10, padding: Spacing.two },
  circleRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  factRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', paddingVertical: 2 },
  factIcon: { marginTop: 3 },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 16,
  },
  share: {
    width: 300,
    aspectRatio: 9 / 16,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#14121F',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
    gap: 16,
  },
  shareNote: { color: '#FFFFFF', textAlign: 'center' },
  shareActions: { flexDirection: 'row', gap: 12 },
  sharePrimary: { backgroundColor: '#5B4BD6', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  shareSecondary: { borderColor: '#FFFFFF', borderWidth: 1, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  sharePrimaryText: { color: '#FFFFFF' },
  shareChip: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 4 },
  shareName: { color: '#FFFFFF', textAlign: 'center' },
  shareEssence: { color: '#E6E3F2', textAlign: 'center', fontStyle: 'italic' },
  shareMeta: { color: '#B8B4C9', textAlign: 'center' },
  shareFoot: { color: '#FFFFFF', marginTop: 24 },
});

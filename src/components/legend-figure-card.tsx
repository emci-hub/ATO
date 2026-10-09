/**
 * Museum of legends — the cards (2026-10-08).
 *
 *   LegendFrame      — one "???" frame in a hall: no clue, no name (no AI, nothing
 *                      spent until it is revealed)
 *   LegendStoryCard  — the full card: hand-written label + facts with sources,
 *                      then the "you" part (AI badge only when the model wrote it)
 *   LegendShareSheet — preview, then share the 9:16 image (label + essence only,
 *                      never the story) — the same on-screen Modal capture as
 *                      share-card.tsx, so the card is visible when captured
 *
 * Pure views: no fetches and no model calls here. "Reveal" is a callback the
 * screen owns (`check:no-auto-ai` lists this file).
 */
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRef, useState, type ComponentProps } from 'react';
import { ActivityIndicator, Linking, Modal, Pressable, StyleSheet, View } from 'react-native';

import { AiBadge } from '@/components/ai-badge';
import { LibraryCardFooter } from '@/components/library-card-footer';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { AXIS_POLE_NAME } from '@/lib/axis-poles';
import { shownFacts, shownMoments, titleCase, type LegendStory } from '@/lib/legend-figures/story';
import {
  AI_LEGEND_PLACEHOLDER,
  REAL_ANIMAL,
  STORY_NOT_HISTORY,
  frameA11yLabel,
  legendTitle,
} from '@/lib/legend-figures/labels';
import { HALL_LABEL, type LegendFact, type LegendFigure, type LegendHall } from '@/lib/legend-figures/types';
import { SHARE_FAILED_COPY, SHARE_UNAVAILABLE_COPY, shareViewAsImage } from '@/lib/share';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

export const HALL_ICON: Record<LegendHall, IconName> = {
  science: 'flask-outline',
  art: 'palette-outline',
  music: 'music-note',
  words: 'book-open-page-variant',
  screen: 'drama-masks',
  explorers: 'compass-outline',
  sport: 'run-fast',
  healers: 'medical-bag',
  changemakers: 'hand-heart',
  myth: 'castle',
  ghosts: 'ghost-outline',
  animals: 'paw',
};

/** One fixed colour per hall (mid-tones that read on light and dark surfaces). */
export const HALL_COLOR: Record<LegendHall, string> = {
  science: '#378ADD',
  art: '#7F77DD',
  music: '#C2549B',
  words: '#BA7517',
  screen: '#D4537E',
  explorers: '#1D9E75',
  sport: '#D85A30',
  healers: '#2E9E9E',
  changemakers: '#C9A227',
  myth: '#9A6FD0',
  ghosts: '#888780',
  animals: '#7A9A3A',
};

export { AI_LEGEND_PLACEHOLDER, REAL_ANIMAL, STORY_NOT_HISTORY, frameA11yLabel, legendTitle };

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
        {legend.kind === 'animal' ? <Chip label={REAL_ANIMAL} /> : null}
        <Chip label={`${legend.place} · ${legend.era}`} />
      </View>
      <View style={styles.nameRow}>
        <HallBadge hall={legend.hall} />
        <View style={styles.flex}>
          <ThemedText type="subheading">{legendTitle(legend)}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {legend.essence}
          </ThemedText>
        </View>
      </View>
    </>
  );
}

/** One "???" frame in a hall. No name, no clue: the legend shows on reveal. */
export function LegendFrame({
  hall,
  index,
  total,
  chapter,
  state,
  onReveal,
}: {
  hall: LegendHall;
  index: number;
  total: number;
  /** The frame hides a new chapter of a legend already met. */
  chapter: boolean;
  /** ready = tap to reveal; loading = this one is being written; spent = no
   * reveals left today. */
  state: 'ready' | 'loading' | 'spent';
  onReveal: () => void;
}) {
  const color = HALL_COLOR[hall];
  const disabled = state !== 'ready';
  return (
    <Pressable
      onPress={onReveal}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={frameA11yLabel(index, total, chapter)}
      accessibilityState={{ disabled, busy: state === 'loading' }}
      style={({ pressed }) => [
        styles.frame,
        { borderColor: color, backgroundColor: `${color}12` },
        state === 'spent' && styles.dim,
        pressed && styles.pressed,
      ]}>
      {state === 'loading' ? (
        <ActivityIndicator color={color} />
      ) : (
        <ThemedText type="subtitle" style={{ color }}>
          ???
        </ThemedText>
      )}
      <ThemedText type="small" themeColor="textSecondary" style={styles.frameCaption}>
        {chapter ? 'A new chapter' : 'A hidden legend'}
      </ThemedText>
    </Pressable>
  );
}

/** The disabled "find a new legend with AI" placeholder. Pre-launch builds
 * only, always last in a hall, never calls anything. */
export function LegendAiPlaceholder() {
  const theme = useTheme();
  return (
    <View
      accessibilityRole="button"
      accessibilityLabel={`${AI_LEGEND_PLACEHOLDER}. Not available yet.`}
      accessibilityState={{ disabled: true }}
      style={[styles.secondary, styles.dim, { borderColor: theme.border, borderStyle: 'dashed' }]}>
      <MaterialCommunityIcons name="robot-outline" size={16} color={theme.textSecondary} />
      <ThemedText type="small" themeColor="textSecondary" style={styles.buttonText}>
        {AI_LEGEND_PLACEHOLDER}
      </ThemedText>
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
  notes = [],
  matchedOn = null,
  chapters = null,
  didYouKnow = null,
  nextTeaser = null,
  nextNote = '',
}: {
  legend: LegendFigure;
  story: LegendStory;
  friends: readonly string[];
  /** AI was off for this card, so the "you" part is the museum's own words. */
  aiOff: boolean;
  onShare: () => void;
  /** Shown only after a reveal: "Born on this day", "Hidden legend found",
   * "Another side of Leonardo da Vinci". */
  notes?: readonly string[];
  /** "Matched on: Adventurous · Learning · from your Curiosity category". */
  matchedOn?: string | null;
  /** More than one chapter: the tabs to switch between them. */
  chapters?: { labels: readonly string[]; selected: number; onSelect: (index: number) => void } | null;
  /** "Did you know?" (no AI): one verified fact, lifted out of the list below. */
  didYouKnow?: LegendFact | null;
  /** "Still to come" (no AI): the teaser of a story not told yet, and when it opens. */
  nextTeaser?: string | null;
  nextNote?: string;
}) {
  const theme = useTheme();
  const moments = shownMoments(legend);
  const facts = shownFacts(legend).filter((fact) => fact.id !== didYouKnow?.id);
  const color = HALL_COLOR[legend.hall];
  const circle = circleLine(friends, legend.name);
  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      {notes.map((note) => (
        <ThemedText key={note} type="smallBold" style={{ color: HALL_COLOR[legend.hall] }}>
          {note}
        </ThemedText>
      ))}
      <LabelHead legend={legend} />
      {matchedOn ? (
        <ThemedText type="small" themeColor="textSecondary">
          {matchedOn}
        </ThemedText>
      ) : null}
      {story.title ? (
        <View style={[styles.titleBox, { borderColor: color, backgroundColor: `${color}14` }]}>
          <View style={styles.sectionHead}>
            <ThemedText type="small" themeColor="textSecondary">
              Your legend title
            </ThemedText>
            {story.source === 'ai' ? <AiBadge /> : null}
          </View>
          <ThemedText type="subheading" style={{ color }}>
            {titleCase(story.title)}
          </ThemedText>
        </View>
      ) : null}
      {didYouKnow ? (
        <Pressable
          onPress={() => void Linking.openURL(didYouKnow.source.url)}
          accessibilityRole="link"
          accessibilityLabel={`Did you know? ${didYouKnow.text} Open the source`}
          style={({ pressed }) => [styles.moment, { backgroundColor: theme.backgroundSelected }, pressed && styles.pressed]}>
          <ThemedText type="smallBold" style={{ color }}>
            Did you know?
          </ThemedText>
          <ThemedText type="small">{didYouKnow.text}</ThemedText>
        </Pressable>
      ) : null}

      <Section title="Who they were">{legend.whoTheyWere}</Section>
      <Section title={legend.kind === 'story' ? 'Known for, in the story' : 'Famous for'}>{legend.famousFor}</Section>

      <View style={[styles.rule, { borderColor: theme.border }]} />
      {chapters && chapters.labels.length > 1 ? (
        <View style={styles.chips}>
          {chapters.labels.map((label, index) => (
            <Pressable
              key={label}
              onPress={() => chapters.onSelect(index)}
              accessibilityRole="tab"
              accessibilityState={{ selected: index === chapters.selected }}
              style={({ pressed }) => [
                styles.chip,
                index === chapters.selected
                  ? { backgroundColor: `${HALL_COLOR[legend.hall]}22`, borderColor: HALL_COLOR[legend.hall] }
                  : { backgroundColor: theme.backgroundSelected, borderColor: theme.border },
                pressed && styles.pressed,
              ]}>
              <ThemedText type="small">{label}</ThemedText>
            </Pressable>
          ))}
        </View>
      ) : null}
      <ThemedText type="small" themeColor="textSecondary">
        Where you match
      </ThemedText>
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

      <View style={[styles.sectionHead, styles.sectionTitle]}>
        <ThemedText type="small" themeColor="textSecondary">
          The moment it mattered
        </ThemedText>
        {story.source === 'ai' ? <AiBadge /> : null}
      </View>
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

      {story.metScene ? (
        <Section title={`If you’d met ${legend.name}`} ai={story.source === 'ai'}>
          {story.metScene}
        </Section>
      ) : null}
      {story.differ ? (
        <Section
          title={`Where you differ · your ${AXIS_POLE_NAME[story.differ.axis][story.differ.lean]} side`}
          ai={story.source === 'ai'}>
          {story.differ.line}
        </Section>
      ) : null}
      <Section title="What it means for you" ai={story.source === 'ai'}>
        {story.whatItMeansForYou}
      </Section>
      {story.joke ? (
        <Section title="The funny part" ai={story.source === 'ai'}>
          {story.joke}
        </Section>
      ) : null}
      {aiOff ? (
        <ThemedText type="small" themeColor="textSecondary">
          AI is off, so this card uses the museum’s own words.
        </ThemedText>
      ) : null}
      {story.source === 'ai' ? <LibraryCardFooter libraryId={story.libraryId} others={story.others} /> : null}

      {nextTeaser ? (
        <View style={[styles.moment, { backgroundColor: theme.backgroundSelected }]}>
          <ThemedText type="smallBold" style={{ color }}>
            Still to come
          </ThemedText>
          <ThemedText type="small" style={styles.italic}>
            {nextTeaser}
          </ThemedText>
          {nextNote ? (
            <ThemedText type="small" themeColor="textSecondary">
              {nextNote}
            </ThemedText>
          ) : null}
        </View>
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
        accessibilityLabel={`Share ${legendTitle(legend)}`}
        style={({ pressed }) => [styles.secondary, { borderColor: theme.controlBorder ?? theme.border }, pressed && styles.pressed]}>
        <MaterialCommunityIcons name="share-variant-outline" size={16} color={theme.text} />
        <ThemedText type="smallBold" style={styles.buttonText}>
          Share this legend
        </ThemedText>
      </Pressable>
    </View>
  );
}

function Section({ title, children, ai = false }: { title: string; children: string; ai?: boolean }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
          {title}
        </ThemedText>
        {ai ? <AiBadge /> : null}
      </View>
      <ThemedText>{children}</ThemedText>
    </View>
  );
}

/** Preview first, then share (a visible card in a Modal, as share-card.tsx does). */
export function LegendShareSheet({
  legend,
  title = null,
  visible,
  onClose,
}: {
  legend: LegendFigure;
  /** The reader's AI legend title, when the story has one ("The Patient Rebuilder"). */
  title?: string | null;
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
          <ThemedText type="subtitle" style={styles.shareName} numberOfLines={3} adjustsFontSizeToFit>
            {legendTitle(legend)}
          </ThemedText>
          <ThemedText style={styles.shareEssence} numberOfLines={4} adjustsFontSizeToFit>
            {legend.essence}
          </ThemedText>
          {title ? (
            <ThemedText type="smallBold" style={[styles.shareTitle, { color }]} numberOfLines={2} adjustsFontSizeToFit>
              My legend title: {titleCase(title)}
            </ThemedText>
          ) : null}
          <ThemedText type="small" style={styles.shareMeta} numberOfLines={3} adjustsFontSizeToFit>
            {legend.kind === 'story'
              ? `${STORY_NOT_HISTORY} · ${legend.place}`
              : legend.kind === 'animal'
                ? `${REAL_ANIMAL} · ${legend.place} · ${legend.era}`
                : `${legend.place} · ${legend.era}`}
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
  // A long chip ("Akan folktales, West Africa · Told since…") wraps inside
  // the card instead of running off its edge.
  chip: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2, maxWidth: '100%' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  badge: { alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  frame: {
    flex: 1,
    minHeight: 120,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.two,
    gap: 4,
  },
  frameCaption: { textAlign: 'center' },
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
  /** Button labels wrap (large iOS text) instead of running past the edge. */
  buttonText: { flexShrink: 1, textAlign: 'center' },
  section: { gap: 2 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { marginTop: Spacing.one },
  rule: { borderTopWidth: StyleSheet.hairlineWidth, marginVertical: Spacing.one },
  matchRow: { flexDirection: 'row', gap: Spacing.two, alignItems: 'flex-start' },
  matchThem: { flex: 1, textAlign: 'right' },
  momentBlock: { gap: 4 },
  moment: { borderRadius: 10, padding: Spacing.two, gap: 2 },
  titleBox: { borderWidth: 1, borderRadius: 12, padding: Spacing.two, gap: 2 },
  italic: { fontStyle: 'italic' },
  shareTitle: { textAlign: 'center' },
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

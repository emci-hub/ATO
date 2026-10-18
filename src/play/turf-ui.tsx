/**
 * Turf War UI kit (step T2, 2026-10-16) — presentational pieces on the sheet-kit language
 * (border 2, radius 6 / 4, spacing 4 / 8 / 12 / 16, taps ≥ 44, type 18 / 16 / 14 / 12).
 * No state, no store, no game rules: `defend-screen.tsx` hands in strings, numbers and callbacks.
 *
 *   TurfButton      icon · label · state (ready / cooling sweep / not affordable / used), ≥ 44 pt
 *   TurfCard        the card surface (sheetCard) every Turf float card uses
 *   TurfResultCard  won / lost: title, lines, ONE primary button low on the card, quiet secondary buttons
 *   TurfPips        tower level pips (HTML side — the board draws its own SVG pips)
 *   TurfWaveChip / TurfCapsPill / TurfPauseButton   the top bar pieces (T2b), 44 pt targets on sheet-kit tokens
 *   TurfWavePeekCard   the next-wave preview card (creep swatches + counts) that hangs under the wave chip
 */
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ComponentProps, ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { SHEET, sheetCard, sheetCardOn, sheetText } from '@/play/sheet-kit';
import { ClipImage, drawableFrame } from '@/play/sheet-sprite';
import type { ClipDrawable } from '@/play/skin';
import type { PeekFigure } from '@/play/turf-wave-peek';
import { WAVE_PEEK } from '@/play/turf-layout';
import { STREET, STREET_FONT } from '@/play/street-ui';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

/** Red used for a cost the player cannot pay. */
export const TURF_COST_RED = STREET.red;

export type TurfButtonState = 'ready' | 'cooling' | 'unaffordable' | 'used' | 'selected';

export function TurfButton({
  label,
  icon,
  detail,
  state = 'ready',
  progress,
  primary,
  onPress,
  accessibilityLabel,
  style,
}: {
  label: string;
  icon?: IconName;
  /** Second line: a cost ("40 scrap") or a timer ("9s"). Red when the state is `unaffordable`. */
  detail?: string;
  state?: TurfButtonState;
  /** 0–1 share of the cooldown still to go; draws the sweep while `cooling`. */
  progress?: number;
  primary?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const disabled = state === 'cooling' || state === 'unaffordable' || state === 'used';
  const dim = state === 'unaffordable' || state === 'used';
  const fill = primary ? STREET.mustard : STREET.asphalt;
  const textColor = primary ? STREET.ink : STREET.paper;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? (detail ? `${label}, ${detail}` : label)}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: fill },
        state === 'selected' && styles.buttonOn,
        dim && styles.dim,
        pressed && !disabled && styles.pressed,
        style,
      ]}>
      {state === 'cooling' && progress != null ? (
        <View
          pointerEvents="none"
          style={[styles.sweep, { width: `${Math.round(Math.max(0, Math.min(1, progress)) * 100)}%` }]}
        />
      ) : null}
      <View style={styles.buttonRow}>
        {icon ? <MaterialCommunityIcons name={icon} size={20} color={dim ? STREET.muted : textColor} /> : null}
        <View style={styles.buttonText}>
          <Text style={[styles.buttonLabel, { color: dim ? STREET.muted : textColor }]} numberOfLines={1} maxFontSizeMultiplier={1.2}>
            {label}
          </Text>
          {detail ? (
            <Text
              style={[sheetText.caption, styles.buttonDetail, { color: state === 'unaffordable' ? TURF_COST_RED : dim ? STREET.muted : textColor }]}
              numberOfLines={1}
              maxFontSizeMultiplier={1.2}>
              {detail}
            </Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

/** The card surface for every Turf float card (build card, results). */
export function TurfCard({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[sheetCard, styles.card, style]}>{children}</View>;
}

/** Level pips: `level` filled dots out of `max`. */
export function TurfPips({ level, max }: { level: number; max: number }) {
  return (
    <View style={styles.pips} accessibilityLabel={`Level ${level} of ${max}`}>
      {Array.from({ length: max }, (_, i) => (
        <View key={i} style={[styles.pip, i < level && styles.pipOn]} />
      ))}
    </View>
  );
}

export type TurfResultAction = { label: string; onPress: () => void; accessibilityLabel?: string };

/** Won / lost card: one primary button low on the card, the rest quiet. Copy comes in as strings. */
export function TurfResultCard({
  title,
  lines,
  badge,
  primary,
  actions = [],
}: {
  title: string;
  lines: string[];
  /** A small tag under the lines (the Trial catch-up ×2.5 EXP). */
  badge?: string;
  primary: TurfResultAction;
  actions?: TurfResultAction[];
}) {
  return (
    <TurfCard style={styles.result}>
      <Text style={sheetText.heading} maxFontSizeMultiplier={1.2}>
        {title}
      </Text>
      {lines.map((line, i) => (
        <Text key={i} style={sheetText.caption} maxFontSizeMultiplier={1.2}>
          {line}
        </Text>
      ))}
      {badge ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      ) : null}
      {actions.map((action) => (
        <TurfButton key={action.label} label={action.label} onPress={action.onPress} accessibilityLabel={action.accessibilityLabel} />
      ))}
      <TurfButton
        label={primary.label}
        primary
        onPress={primary.onPress}
        accessibilityLabel={primary.accessibilityLabel}
        style={styles.primary}
      />
    </TurfCard>
  );
}

/** The wave chip: a sheet chip (asphalt, 2 pt edge, 4 radius) with a chevron; the edge goes mustard while the preview is open. */
export function TurfWaveChip({
  label,
  open,
  width,
  height,
  disabled,
  onPress,
}: {
  label: string;
  open: boolean;
  /** No preview to show (a replay run): the chip is plain info. */
  disabled?: boolean;
  /** The chip's visual box (the boss bar uses the same one); the tap target is `SHEET.tap` high around it. */
  width: number;
  height: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole={disabled ? 'text' : 'button'}
      accessibilityState={disabled ? undefined : { expanded: open }}
      accessibilityLabel={disabled ? label : `${label}, ${open ? 'hide' : 'show'} next wave`}
      style={({ pressed }) => [styles.chipTap, { width }, pressed && styles.pressed]}>
      <View style={[styles.chip, { width, height }, open && styles.chipOpen]}>
        <Text style={styles.chipText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} maxFontSizeMultiplier={1.2}>
          {label}
        </Text>
        <View style={[styles.chevron, open && styles.chevronOpen]} />
      </View>
    </Pressable>
  );
}

/** Run caps counter: a coin dot and the number, in a fixed-height pill. */
export function TurfCapsPill({ scrap }: { scrap: number }) {
  return (
    <View style={styles.caps} accessible accessibilityLabel={`${scrap} run caps`}>
      <View style={styles.coin} />
      <Text style={styles.capsText} numberOfLines={1} maxFontSizeMultiplier={1.2}>
        {scrap} caps
      </Text>
    </View>
  );
}

/** Pause / resume: 44 pt square on the kit chip surface, hit slop 6 on every side → 56 pt target. */
export function TurfPauseButton({ paused, onPress }: { paused: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={paused ? 'Resume wave' : 'Pause wave'}
      hitSlop={6}
      style={({ pressed }) => [styles.pause, pressed && styles.pressed]}>
      {paused ? (
        <Text style={styles.resume}>▶</Text>
      ) : (
        <View style={styles.pauseBars}>
          <View style={styles.pauseBar} />
          <View style={styles.pauseBar} />
        </View>
      )}
    </Pressable>
  );
}

export type TurfWavePeekRowView = {
  key: string;
  count: number;
  name: string;
  color: string;
  shape: 'dot' | 'slim' | 'block' | 'gem';
  boss?: boolean;
  /** The role's own board sprite (south) + where its figure sits in the frame; drawn as a head-and-shoulders icon.
   * Unpacked art keeps the swatch. */
  art?: ClipDrawable;
  figure?: PeekFigure;
};

/** Card icon edge (pt) and the share of the figure's height that is head + shoulders. */
const PEEK_ICON = 18;
const PEEK_BUST_SHARE = 0.5;
/** T15: the chips are fixed 24 pt boxes sized for the 12 pt role words, so their text ignores Larger Text (the card's accessibilityLabel still reads it all). */
const PEEK_CHIP_FONT_MAX = 1;

/** Head-and-shoulders of a creep's board sprite (the top half of its figure, centred) with a role-colour underline. */
function PeekCreepIcon({ art, figure, color }: { art: ClipDrawable; figure: PeekFigure; color: string }) {
  const box = PEEK_ICON / (figure.h * PEEK_BUST_SHARE);
  return (
    <View style={[styles.peekIcon, { borderBottomColor: color }]}>
      <View style={{ position: 'absolute', width: box, height: box, left: PEEK_ICON / 2 - figure.cx * box, top: -figure.top * box }}>
        <ClipImage drawable={art} />
      </View>
    </View>
  );
}

/**
 * Next-wave preview (FloatLayer card): title + stage tag, then one chip per creep role (creep icon, or a swatch · count × · name).
 * Tapping the card closes it. Copy comes in as strings (role names are the director's own words).
 */
export function TurfWavePeekCard({
  title,
  tag,
  rows,
  width,
  top,
  left,
  onClose,
}: {
  title: string;
  tag?: string;
  rows: TurfWavePeekRowView[];
  width: number;
  top: number;
  left: number;
  onClose: () => void;
}) {
  return (
    <Pressable
      onPress={onClose}
      accessibilityRole="button"
      accessibilityLabel={`${title}: ${rows.map((r) => `${r.count} ${r.name}`).join(', ')}. Tap to close.`}
      style={[sheetCard, sheetCardOn, styles.peek, { position: 'absolute', top, left, width, height: WAVE_PEEK.height }]}>
      <View style={styles.peekHead}>
        <Text style={[styles.peekTitle]} numberOfLines={1} maxFontSizeMultiplier={1.2}>
          {title}
        </Text>
        {tag ? (
          <Text style={sheetText.caption} numberOfLines={1} maxFontSizeMultiplier={1.2}>
            {tag}
          </Text>
        ) : null}
      </View>
      <View style={styles.peekRow}>
        {rows.map((row) => (
          <View key={row.key} style={[styles.peekChip, row.boss && styles.peekChipBoss]}>
            {row.art && row.figure && drawableFrame(row.art) ? (
              <PeekCreepIcon art={row.art} figure={row.figure} color={row.color} />
            ) : (
              <View
                style={[
                  styles.swatch,
                  { backgroundColor: row.color },
                  row.shape === 'dot' && styles.swatchDot,
                  row.shape === 'slim' && styles.swatchSlim,
                  row.shape === 'gem' && styles.swatchGem,
                ]}
              />
            )}
            <Text style={styles.peekCount} maxFontSizeMultiplier={PEEK_CHIP_FONT_MAX}>
              {row.count}×
            </Text>
            <Text style={[styles.peekName, row.boss && styles.peekNameBoss]} numberOfLines={1} maxFontSizeMultiplier={PEEK_CHIP_FONT_MAX}>
              {row.name}
            </Text>
          </View>
        ))}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chipTap: { height: SHEET.tap, justifyContent: 'center' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: SHEET.gap,
    backgroundColor: STREET.asphalt,
    borderWidth: SHEET.border,
    borderColor: SHEET.edge,
    borderRadius: SHEET.radiusSmall,
  },
  chipOpen: { borderColor: STREET.mustard },
  chipText: { flexShrink: 1, fontFamily: STREET_FONT.bold, fontSize: 13, color: STREET.paper, textTransform: 'uppercase' },
  chevron: {
    width: 8,
    height: 8,
    marginTop: -3,
    borderRightWidth: 2,
    borderBottomWidth: 2,
    borderColor: STREET.muted,
    transform: [{ rotate: '45deg' }],
  },
  chevronOpen: { borderColor: STREET.mustard, marginTop: 3, transform: [{ rotate: '225deg' }] },
  caps: {
    marginLeft: 'auto',
    height: SHEET.tap,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: SHEET.pad,
    backgroundColor: STREET.asphalt,
    borderWidth: SHEET.border,
    borderColor: SHEET.edge,
    borderRadius: SHEET.radiusSmall,
  },
  coin: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: SHEET.edge, backgroundColor: STREET.mustard },
  capsText: { fontFamily: STREET_FONT.bold, fontSize: 15, color: STREET.mustard },
  pause: {
    width: SHEET.tap,
    height: SHEET.tap,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: STREET.asphalt,
    borderWidth: SHEET.border,
    borderColor: SHEET.edge,
    borderRadius: SHEET.radiusSmall,
  },
  pauseBars: { flexDirection: 'row', gap: 4 },
  pauseBar: { width: 5, height: 16, backgroundColor: STREET.paper },
  resume: { fontFamily: STREET_FONT.bold, fontSize: 20, color: STREET.mustard },
  peek: { paddingHorizontal: SHEET.pad, paddingVertical: 6, justifyContent: 'space-between' },
  peekHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SHEET.gap },
  peekTitle: {
    flexShrink: 1,
    fontFamily: STREET_FONT.bold,
    fontSize: SHEET.type.caption,
    lineHeight: SHEET.type.captionLh,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: STREET.paper,
  },
  // T13: tight spacing so the fullest real card (3 roles) keeps whole role words on the 375 pt phone; pinned by check:turf-war-layout.
  peekRow: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  peekChip: {
    height: 24,
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 4,
    backgroundColor: STREET.asphalt,
    borderWidth: SHEET.border,
    borderColor: SHEET.edge,
    borderRadius: SHEET.radiusSmall,
  },
  peekChipBoss: { borderColor: STREET.red },
  peekIcon: { width: PEEK_ICON, height: PEEK_ICON + 2, overflow: 'hidden', borderBottomWidth: 2 },
  swatch: { width: 12, height: 12, borderRadius: 2 },
  swatchDot: { borderRadius: 6 },
  swatchSlim: { width: 8, height: 12, borderRadius: 4 },
  swatchGem: { width: 10, height: 10, borderRadius: 1, transform: [{ rotate: '45deg' }] },
  peekCount: { fontFamily: STREET_FONT.bold, fontSize: SHEET.type.caption, color: STREET.mustard },
  peekName: { flexShrink: 1, fontFamily: STREET_FONT.bold, fontSize: SHEET.type.caption, color: STREET.paper },
  peekNameBoss: { color: '#FFD6FB' },
  button: {
    minHeight: SHEET.tap + 4,
    borderRadius: SHEET.radiusSmall,
    borderWidth: SHEET.border,
    borderColor: SHEET.edge,
    paddingHorizontal: SHEET.gap,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  buttonOn: { borderColor: STREET.mustard },
  dim: { opacity: 0.6 },
  pressed: { opacity: 0.85 },
  buttonRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  buttonText: { flexShrink: 1, alignItems: 'center' },
  buttonLabel: {
    fontFamily: STREET_FONT.bold,
    fontSize: SHEET.type.body,
    lineHeight: SHEET.type.bodyLh,
    textTransform: 'uppercase',
  },
  buttonDetail: { textAlign: 'center' },
  sweep: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: 'rgba(224,165,38,0.28)' },
  card: { padding: SHEET.pad, gap: SHEET.gap },
  result: { alignItems: 'stretch' },
  primary: { marginTop: SHEET.gap },
  pips: { flexDirection: 'row', gap: 4, alignItems: 'center' },
  pip: {
    width: 10,
    height: 10,
    borderRadius: 2,
    borderWidth: 2,
    borderColor: SHEET.edge,
    backgroundColor: STREET.asphalt,
  },
  pipOn: { backgroundColor: STREET.mustard },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: SHEET.radiusSmall,
    borderWidth: SHEET.border,
    borderColor: SHEET.edge,
    backgroundColor: STREET.asphalt,
    paddingHorizontal: SHEET.gap,
    paddingVertical: 4,
  },
  badgeText: { fontFamily: STREET_FONT.bold, fontSize: SHEET.type.caption, color: STREET.mustard },
});

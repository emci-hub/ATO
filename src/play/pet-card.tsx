/**
 * Pet card (2026-09-30) — a holo-style card per pet (Pokémon holo / Genshin /
 * Hearthstone golden), drawn with react-native-svg + Reanimated, no art files.
 *
 * Frame by GRADE: Common a plain grey frame; Rare blue with a soft glow; Epic
 * purple with glow + drifting sparkles; Legendary gold with a holo shine
 * sweeping across. Shiny adds a rainbow foil edge and a shine on top; 5★ adds
 * an inner gold frame with corner gems. Silhouette = a missing Collection slot
 * (black sprite, "???", its grade frame dimmed).
 *
 * Perf: only a card with `animate` moves (the reveal, the opened card); grids
 * pass `animate={false}` so a full Collection is static.
 */
import { useEffect, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { Fonts } from '@/constants/theme';
import { useFxQuality } from '@/play/fx-quality';
import { NEON } from '@/play/neon-viper';
import {
  CARE_BAND_LABEL,
  EGG_EMOJI,
  EGG_LABEL,
  GRADE_COLOR,
  GRADE_LABEL,
  GRADE_STARS,
  STAR_MAX,
  gradeTag,
  gradedName,
  type CareBand,
  type EggType,
  type Grade,
} from '@/play/pet-eggs';

export type PetCardInfo = {
  name: string;
  grade: Grade | null;
  shiny: boolean;
  /** Collection stars (copies, max 5). */
  stars: number;
  egg: EggType | null;
  /** Forms reached (badges) — or the live pet's one form. */
  forms: readonly string[];
  band: CareBand | null;
  days: number | null;
  dye: boolean;
  shinyCount?: number;
  /** v24 — the hero, when the pet has its own name. */
  hero?: string | null;
  /** v24 — milestone ribbons. */
  ribbons?: readonly ('collector' | 'legend')[];
  /** v26 — your mini-game rank titles (the live pet's card). */
  ranks?: { catch: string; train: string } | null;
};

const RAINBOW = ['#FF5F6D', '#FFC371', '#F9F871', '#7CFFB2', '#5CC8FF', '#B78CFF', '#FF5FD2'];

function Sweep({ width, height, color, duration, opacity }: { width: number; height: number; color: string; duration: number; opacity: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withRepeat(withDelay(600, withTiming(1, { duration, easing: Easing.inOut(Easing.quad) })), -1);
    return () => cancelAnimation(t);
  }, [t, duration]);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: -width + t.value * width * 2.2 }, { rotate: '20deg' }],
  }));
  return (
    <Animated.View pointerEvents="none" style={[styles.sweep, { height: height * 1.6, top: -height * 0.3, width: width * 0.35 }, style]}>
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id={`sweep-${color}`} x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={color} stopOpacity={0} />
            <Stop offset="0.5" stopColor={color} stopOpacity={opacity} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#sweep-${color})`} />
      </Svg>
    </Animated.View>
  );
}

function Sparkle({ x, y, delay, color }: { x: number; y: number; delay: number; color: string }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(delay, withRepeat(withTiming(1, { duration: 2600, easing: Easing.linear }), -1));
    return () => cancelAnimation(t);
  }, [t, delay]);
  const style = useAnimatedStyle(() => ({
    opacity: Math.sin(t.value * Math.PI),
    transform: [{ translateY: -t.value * 24 }],
  }));
  return (
    <Animated.Text pointerEvents="none" style={[styles.sparkle, { left: x, top: y, color }, style]}>
      ✦
    </Animated.Text>
  );
}

export function PetCard({
  info,
  sprite,
  width = 200,
  animate = true,
  silhouette = false,
}: {
  info: PetCardInfo;
  /** The sprite element (animated or still), drawn in the art window. */
  sprite: ReactNode;
  width?: number;
  animate?: boolean;
  silhouette?: boolean;
}) {
  const height = Math.round(width * 1.4);
  // Effects Low (Settings): the card stays still.
  const fxFull = useFxQuality() === 'full';
  animate = animate && fxFull;
  const grade = info.grade ?? 'common';
  const color = GRADE_COLOR[grade];
  const small = width < 120;
  const border = grade === 'legendary' ? 3 : grade === 'common' ? 1.5 : 2.5;
  const five = info.stars >= STAR_MAX && !silhouette;
  // Never by colour alone: stars AND the word.
  const gradeStars = small ? '★'.repeat(GRADE_STARS[grade]) : gradeTag(grade);
  const glow = !silhouette && (grade === 'rare' || grade === 'epic' || grade === 'legendary');
  return (
    <View
      style={[
        { width, height, borderRadius: small ? 8 : 14 },
        glow && { shadowColor: color, shadowOpacity: 0.8, shadowRadius: small ? 4 : 10, shadowOffset: { width: 0, height: 0 }, elevation: 6 },
        silhouette && styles.dim,
      ]}>
    <View
      style={[styles.card, { width, height, borderRadius: small ? 8 : 14 }]}
      accessible
      accessibilityLabel={
        silhouette
          ? `${GRADE_LABEL[grade]} card, not found yet`
          : `${gradedName(info.grade, info.name)}, ${GRADE_LABEL[grade]}${info.shiny ? ', shiny' : ''}, ${info.stars} of 5 stars`
      }>
      {/* Frame: grade colour; shiny = rainbow foil. */}
      <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <LinearGradient id="cardBg" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#101A30" />
            <Stop offset="1" stopColor="#05070D" />
          </LinearGradient>
          <LinearGradient id="foil" x1="0" y1="0" x2="1" y2="1">
            {RAINBOW.map((c, i) => (
              <Stop key={c} offset={String(i / (RAINBOW.length - 1))} stopColor={c} />
            ))}
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={width} height={height} rx={small ? 8 : 14} fill="url(#cardBg)" />
        <Rect
          x={border / 2}
          y={border / 2}
          width={width - border}
          height={height - border}
          rx={small ? 8 : 14}
          fill="none"
          stroke={info.shiny && !silhouette ? 'url(#foil)' : color}
          strokeWidth={info.shiny && !silhouette ? border + 1 : border}
        />
        {five ? (
          <Rect
            x={border + 4}
            y={border + 4}
            width={width - 2 * (border + 4)}
            height={height - 2 * (border + 4)}
            rx={small ? 6 : 10}
            fill="none"
            stroke="#FFE9A8"
            strokeWidth={1}
            strokeDasharray="6 3"
          />
        ) : null}
      </Svg>
      {five ? (
        <>
          <Text style={[styles.gem, { left: 4, top: 2 }]}>◆</Text>
          <Text style={[styles.gem, { right: 4, top: 2 }]}>◆</Text>
          <Text style={[styles.gem, { left: 4, bottom: 2 }]}>◆</Text>
          <Text style={[styles.gem, { right: 4, bottom: 2 }]}>◆</Text>
        </>
      ) : null}

      <View style={[styles.header, small && styles.headerSmall]}>
        <Text style={[styles.gradeStars, { color, fontSize: small ? 9 : 13 }]}>{gradeStars}</Text>
        {info.shiny && !silhouette ? <Text style={{ fontSize: small ? 9 : 13 }}>✨</Text> : null}
      </View>

      <View style={styles.art}>{sprite}</View>

      <Text style={[styles.name, small && styles.nameSmall]} numberOfLines={1}>
        {silhouette ? '???' : gradedName(info.grade, info.name)}
      </Text>
      {small ? (
        <Text style={[styles.smallGrade, { color }]} numberOfLines={1}>
          {GRADE_LABEL[grade]}
        </Text>
      ) : null}
      {!small && !silhouette && info.hero ? <Text style={styles.meta}>{info.hero}</Text> : null}
      {!small && !silhouette && info.ranks ? (
        <Text style={styles.meta} numberOfLines={1}>
          🍎 {info.ranks.catch} · 🎯 {info.ranks.train}
        </Text>
      ) : null}
      {!small && !silhouette && info.ribbons && info.ribbons.length > 0 ? (
        <Text style={styles.meta}>
          {info.ribbons.map((r) => (r === 'collector' ? '🎖 Collector' : '🏅 Legend')).join(' · ')}
        </Text>
      ) : null}
      {!small ? (
        <>
          <Text style={[styles.meta, { color }]}>
            {GRADE_LABEL[grade]} · {'★'.repeat(Math.max(0, info.stars))}
            {'☆'.repeat(Math.max(0, STAR_MAX - info.stars))}
          </Text>
          {!silhouette ? (
            <Text style={styles.meta} numberOfLines={2}>
              {info.egg ? `${EGG_EMOJI[info.egg]} ${EGG_LABEL[info.egg]} egg` : ''}
              {info.band ? ` · Care ${CARE_BAND_LABEL[info.band]}` : ''}
              {info.days != null ? ` · ${info.days}d` : ''}
              {info.dye ? ' · 🎨 dye' : ''}
              {info.shinyCount ? ` · ✨×${info.shinyCount}` : ''}
            </Text>
          ) : null}
          {info.forms.length > 0 && !silhouette ? (
            <View style={styles.forms}>
              {info.forms.map((f) => (
                <Text key={f} style={styles.formBadge}>
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </Text>
              ))}
            </View>
          ) : null}
        </>
      ) : null}

      {/* Moving shine: Legendary holo sweep, shiny foil shine, Epic sparkles. */}
      {animate && !silhouette && grade === 'legendary' ? (
        <Sweep width={width} height={height} color="#FFF3C4" duration={2200} opacity={0.45} />
      ) : null}
      {animate && !silhouette && info.shiny ? (
        <Sweep width={width} height={height} color="#FFFFFF" duration={3000} opacity={0.3} />
      ) : null}
      {animate && !silhouette && grade === 'epic'
        ? [0.2, 0.5, 0.78].map((x, i) => (
            <Sparkle key={x} x={x * width} y={height * (0.35 + (i % 2) * 0.2)} delay={i * 700} color={color} />
          ))
        : null}
    </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { overflow: 'hidden', alignItems: 'center', backgroundColor: '#05070D' },
  dim: { opacity: 0.55 },
  header: { flexDirection: 'row', alignSelf: 'stretch', justifyContent: 'space-between', paddingHorizontal: 12, paddingTop: 10 },
  headerSmall: { paddingHorizontal: 6, paddingTop: 5 },
  gradeStars: { fontFamily: Fonts.monoBold, letterSpacing: 1 },
  art: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  name: {
    fontFamily: Fonts.displayBold,
    fontSize: 15,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: NEON.textPrimary,
    paddingHorizontal: 8,
  },
  nameSmall: { fontSize: 8, letterSpacing: 0.2 },
  smallGrade: { fontFamily: Fonts.monoBold, fontSize: 7, paddingBottom: 4 },
  meta: { fontFamily: Fonts.mono, fontSize: 10, color: NEON.textMuted, textAlign: 'center', paddingHorizontal: 8, marginTop: 2 },
  forms: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 4, marginTop: 4, marginBottom: 10, paddingHorizontal: 8 },
  formBadge: {
    fontFamily: Fonts.mono,
    fontSize: 9,
    color: NEON.cyan,
    borderWidth: 1,
    borderColor: NEON.cyanDim,
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  gem: { position: 'absolute', color: '#FFE9A8', fontSize: 10 },
  sweep: { position: 'absolute', left: 0 },
  sparkle: { position: 'absolute', fontSize: 12 },
});

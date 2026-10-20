import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { HERO_ART } from '@/components/profile-card';
import { PRE_LAUNCH_DEV } from '@/lib/dev-mode';
import { characterFromTracks } from '@/lib/profile-character';
import { PROFILE_CARD_COPY_REVIEWED } from '@/lib/profile-history';
import type { TraitTrack } from '@/lib/trait-stability';
import { PixelFrame } from '@/play/pixel-ui';
import { PIXEL, PIXEL_FONT, pixelRenderStyle } from '@/play/pixel-theme';
import { usePlayReduceMotion } from '@/play/play-motion';

const HERO_SIZE = 112;

/**
 * "This is you so far" (master-plan step 1): the character after the first read.
 * Name and hero from the answers, two accents from the two strongest leans, the
 * 16 stats at honest confidence (a trait with under 3 answers stays empty), and
 * what the type could become if a near-the-line trait tips. In-app only; any
 * share surface uses `characterPublicLine`. No AI.
 */
export function ProfileCharacter({ tracks }: { tracks: readonly TraitTrack[] }) {
  const reduceMotion = usePlayReduceMotion();
  const c = characterFromTracks(tracks);
  return (
    <PixelFrame enter={!reduceMotion} border={c.tint.primary} align="stretch" style={styles.frame}>
      <Text style={styles.kicker}>THIS IS YOU SO FAR</Text>
      <View style={styles.head}>
        <View style={styles.headText}>
          <Text style={styles.name} numberOfLines={3}>
            {c.name}
          </Text>
          <Text style={styles.meta}>
            {c.settledCount} OF 16 TRAITS SETTLED
          </Text>
        </View>
        <View style={styles.heroWrap}>
          <Image
            source={HERO_ART[c.hero]}
            contentFit="contain"
            transition={0}
            style={{ width: HERO_SIZE, height: HERO_SIZE, ...pixelRenderStyle }}
            accessibilityLabel={`${c.hero.replace(/_/g, ' ')} sprite`}
          />
          <View style={[styles.pedestal, { backgroundColor: c.tint.secondary }]} />
        </View>
      </View>
      <View style={styles.stats}>
        {c.stats.map((s) => (
          <View key={s.axis} style={styles.stat} accessible accessibilityLabel={`${s.label}: ${s.line}, ${s.confidenceLabel}`}>
            <View style={styles.statRow}>
              <Text style={styles.statLabel} numberOfLines={1}>
                {s.label}
              </Text>
              <View style={styles.track}>
                {s.value != null ? <View style={[styles.fill, { width: `${Math.round(s.value * 100)}%` }]} /> : null}
              </View>
            </View>
            <Text style={styles.conf} numberOfLines={1}>
              {s.value != null ? `${s.line} · ${s.confidenceLabel}` : s.confidenceLabel}
            </Text>
          </View>
        ))}
      </View>
      {c.strength ? (
        <View style={styles.lines}>
          <Text style={styles.line}>
            <Text style={styles.lineKey}>STRENGTH </Text>
            {c.strength}
          </Text>
          {c.weakness ? (
            <Text style={styles.line}>
              <Text style={styles.lineKey}>WEAKNESS </Text>
              {c.weakness}
            </Text>
          ) : null}
          {c.step ? (
            <Text style={styles.line}>
              <Text style={styles.lineKey}>TRY </Text>
              {c.step}
            </Text>
          ) : null}
        </View>
      ) : null}
      <Text style={styles.line}>
        <Text style={styles.lineKey}>COULD GROW INTO </Text>
        {c.evolveLine}
      </Text>
      {!PROFILE_CARD_COPY_REVIEWED && PRE_LAUNCH_DEV ? <Text style={styles.draft}>Draft copy — waiting on emci review.</Text> : null}
    </PixelFrame>
  );
}

const styles = StyleSheet.create({
  frame: { gap: 10 },
  kicker: { fontFamily: PIXEL_FONT.label, fontSize: 10, color: PIXEL.amber, letterSpacing: 1 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headText: { flex: 1, gap: 4 },
  name: { fontFamily: PIXEL_FONT.label, fontSize: 16, color: PIXEL.text },
  meta: { fontFamily: PIXEL_FONT.label, fontSize: 10, color: PIXEL.cyanHi, letterSpacing: 1 },
  heroWrap: { alignItems: 'center' },
  pedestal: { width: 72, height: 4, marginTop: 2 },
  stats: { gap: 4 },
  stat: { gap: 2 },
  statRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statLabel: { width: 110, fontFamily: PIXEL_FONT.label, fontSize: 9, color: PIXEL.body },
  track: { flex: 1, height: 6, backgroundColor: PIXEL.slot },
  fill: { height: 6, backgroundColor: PIXEL.cyan },
  conf: { marginLeft: 116, fontFamily: PIXEL_FONT.label, fontSize: 9, color: PIXEL.muted },
  lines: { gap: 4 },
  line: { fontFamily: PIXEL_FONT.body, fontSize: 13, color: PIXEL.body },
  lineKey: { fontFamily: PIXEL_FONT.label, fontSize: 10, color: PIXEL.amber },
  draft: { fontFamily: PIXEL_FONT.label, fontSize: 9, color: PIXEL.muted },
});

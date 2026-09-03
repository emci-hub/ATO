import { forwardRef } from 'react';
import { StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { ThemedText } from '@/components/themed-text';
import { accentFromShowUp } from '@/lib/color';
import { publicLink } from '@/lib/share-codec';

/**
 * The Stories-size poster (9:16). Shared as an image with the caption
 * "What's your ATO?" and the /@handle QR. Rendered at display size and
 * captured at 1080x1920 via react-native-view-shot (see lib/share.ts).
 * Fixed light palette on purpose — this is a shareable artifact, not a
 * themed screen. Ink / Paper / Steel / Bloom live here only; app chrome
 * stays on the five appearance modes. Takes only the fields a poster needs,
 * so the public /@handle page can reuse it too. The live pixel is the nav
 * companion, not this card.
 */

export interface PosterPerson {
  name: string;
  handle: string;
  show_up: string | null;
  /** Kept so public_profile / You-tab callers can pass the row as-is. */
  recipe: unknown;
}

const INK = '#1C1917';
const PAPER = '#FAF6EF';
const STEEL = '#57534E';
const BLOOM = '#E11D48';
const QR_PAPER = '#FFFFFF';

export const SharePoster = forwardRef<View, { me: PosterPerson; width?: number }>(function SharePoster(
  { me, width = 320 },
  ref,
) {
  const accent = accentFromShowUp(me.show_up);
  const qrSize = Math.round(width * 0.5);

  return (
    <View ref={ref} collapsable={false} style={[styles.poster, { width }]}>
      {/* Soft accent wash behind the QR — a modern background, not flat paper. */}
      <View
        pointerEvents="none"
        style={[
          styles.bloom,
          {
            backgroundColor: `${accent.light}16`,
            width: width * 0.82,
            height: width * 0.82,
            top: -width * 0.2,
            right: -width * 0.2,
          },
        ]}
      />
      <View style={[styles.bloomRule, { backgroundColor: accent.light }]} />

      <View style={styles.body}>
        <View style={styles.identity}>
          <ThemedText style={styles.name}>{me.name}</ThemedText>
          <ThemedText style={[styles.handle, { color: STEEL }]}>@{me.handle}</ThemedText>
        </View>

        <View style={styles.qrCard}>
          <QRCode value={publicLink(me.handle)} size={qrSize} color={INK} backgroundColor={QR_PAPER} quietZone={8} />
        </View>
      </View>

      <ThemedText style={styles.caption}>
        What&apos;s your <ThemedText style={styles.captionAto}>ATO</ThemedText>?
      </ThemedText>
    </View>
  );
});

const styles = StyleSheet.create({
  poster: {
    aspectRatio: 9 / 16,
    backgroundColor: PAPER,
    borderRadius: 28,
    paddingTop: 40,
    paddingBottom: 32,
    paddingHorizontal: 28,
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(87, 83, 78, 0.18)',
    overflow: 'hidden',
  },
  bloom: {
    position: 'absolute',
    borderRadius: 9999,
  },
  bloomRule: {
    position: 'absolute',
    top: 0,
    left: 28,
    right: 28,
    height: 3,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
  },
  body: {
    flexGrow: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 28,
  },
  identity: {
    alignItems: 'center',
    gap: 10,
    width: '100%',
  },
  name: {
    color: INK,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.4,
    textAlign: 'center',
    lineHeight: 34,
  },
  handle: {
    fontSize: 16,
    fontFamily: 'monospace',
    letterSpacing: 0.2,
  },
  qrCard: {
    backgroundColor: QR_PAPER,
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(28, 25, 23, 0.08)',
    shadowColor: 'rgba(28, 25, 23, 0.18)',
    shadowOpacity: 1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  caption: {
    color: INK,
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  captionAto: {
    color: BLOOM,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
});

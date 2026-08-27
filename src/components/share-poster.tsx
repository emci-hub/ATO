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
  show_up: string;
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
  const qrSize = Math.round(width * 0.52);

  return (
    <View ref={ref} collapsable={false} style={[styles.poster, { width }]}>
      <View style={styles.bloomRule} />

      <View style={styles.body}>
        <View style={styles.identity}>
          <ThemedText style={styles.name}>{me.name}</ThemedText>
          <ThemedText style={[styles.handle, { color: accent.light }]}>@{me.handle}</ThemedText>
          {me.show_up ? (
            <View style={styles.visibilityPill}>
              <ThemedText numberOfLines={2} style={styles.visibility}>
                {me.show_up}
              </ThemedText>
            </View>
          ) : null}
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
  bloomRule: {
    position: 'absolute',
    top: 0,
    left: 28,
    right: 28,
    height: 3,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
    backgroundColor: BLOOM,
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
  visibilityPill: {
    marginTop: 4,
    maxWidth: '100%',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(87, 83, 78, 0.28)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: 'rgba(87, 83, 78, 0.06)',
  },
  visibility: {
    color: STEEL,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
    textAlign: 'center',
    lineHeight: 16,
  },
  qrCard: {
    backgroundColor: QR_PAPER,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(87, 83, 78, 0.16)',
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

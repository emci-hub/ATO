import { forwardRef } from 'react';
import { StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { ThemedText } from '@/components/themed-text';
import { PixelFace } from '@/components/pixel-face';
import { accentFromShowUp } from '@/lib/color';
import { normalizeRecipe } from '@/lib/recipe';
import { publicLink } from '@/lib/share-codec';

/**
 * The Stories-size poster (9:16). Shared as an image with the caption
 * "What's your ATO?" and the /@handle QR. Rendered at display size and
 * captured at 1080x1920 via react-native-view-shot (see lib/share.ts).
 * Fixed light palette on purpose — this is a shareable artifact, not a
 * themed screen. Takes only the fields a poster needs, so the public
 * /@handle page can reuse it too.
 */

export interface PosterPerson {
  name: string;
  handle: string;
  show_up: string;
  recipe: unknown;
}

const INK = '#1C1917';
const MUTED = '#78716C';
const PAPER = '#FAF6EF';
const LINE = '#E7E0D4';

export const SharePoster = forwardRef<View, { me: PosterPerson; width?: number }>(function SharePoster(
  { me, width = 320 },
  ref,
) {
  const recipe = normalizeRecipe(me.recipe);
  const accent = accentFromShowUp(me.show_up);

  return (
    <View ref={ref} collapsable={false} style={[styles.poster, { width }]}>
      <View style={styles.faceRow}>
        <PixelFace recipe={recipe} size={200} showUp={me.show_up} />
      </View>

      <View style={styles.identity}>
        <ThemedText style={[styles.name, { color: INK }]}>{me.name}</ThemedText>
        <ThemedText style={[styles.handle, { color: accent.light }]}>@{me.handle}</ThemedText>
        <ThemedText numberOfLines={3} style={[styles.showUp, { color: MUTED }]}>
          {me.show_up}
        </ThemedText>
      </View>

      <View style={styles.qrWrap}>
        <View style={styles.qrCard}>
          <QRCode value={publicLink(me.handle)} size={150} color={INK} backgroundColor="transparent" quietZone={8} />
        </View>
      </View>

      <ThemedText style={[styles.caption, { color: INK }]}>
        What&apos;s your <ThemedText style={[styles.caption, styles.captionAto, { color: accent.light }]}>ATO</ThemedText>?
      </ThemedText>
    </View>
  );
});

const styles = StyleSheet.create({
  poster: {
    aspectRatio: 9 / 16,
    backgroundColor: PAPER,
    borderRadius: 28,
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: LINE,
  },
  faceRow: {
    alignItems: 'center',
  },
  identity: {
    alignItems: 'center',
    gap: 6,
  },
  name: {
    fontSize: 26,
    fontWeight: '700',
  },
  handle: {
    fontSize: 18,
    fontFamily: 'monospace',
  },
  showUp: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 8,
  },
  qrWrap: {
    alignItems: 'center',
  },
  qrCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 14,
  },
  caption: {
    fontSize: 15,
    fontWeight: '600',
  },
  captionAto: {
    fontWeight: '800',
  },
});

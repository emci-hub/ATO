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
 * Fixed palette on purpose — this is a shareable artifact, not a themed
 * screen. The "soft dark field" treatment is cyberpunk-minimal without
 * neon-on-black: a muted charcoal ground, a warm light scan plate, and the
 * QR itself kept dark-on-light at M error correction so scannability is
 * unchanged from a plain ink-on-white code. App chrome stays on the five
 * appearance modes. Takes only the fields a poster needs, so the public
 * /@handle page can reuse it too. The live pixel is the nav companion,
 * not this card.
 */

export interface PosterPerson {
  name: string;
  handle: string;
  show_up: string | null;
  /** Kept so public_profile / You-tab callers can pass the row as-is. */
  recipe: unknown;
}

const FIELD = '#1A1B20'; // poster ground — soft charcoal, not pure black
const FROST = '#F5F1E9'; // primary text on the field
const MIST = '#A6A3AF'; // secondary text on the field
const CAPTION = '#C9C5BC'; // caption base on the field
const PLATE = '#F6F2EA'; // scan plate — warm paper
const QR_INK = '#191A1E'; // QR modules — near-black on the light plate
const PLATE_HAIR = 'rgba(25, 26, 30, 0.12)'; // hairline on the plate
const FIELD_HAIR = 'rgba(255, 255, 255, 0.10)'; // poster hairline on the field
const PLATE_SHADOW = 'rgba(0, 0, 0, 0.42)';
const MICROCOPY = 'rgba(25, 26, 30, 0.55)'; // microcopy ink on the plate

export const SharePoster = forwardRef<View, { me: PosterPerson; width?: number }>(function SharePoster(
  { me, width = 320 },
  ref,
) {
  const accent = accentFromShowUp(me.show_up);
  const qrSize = Math.round(width * 0.5);
  const scanTag = `ASTR//${me.handle.replace(/^@/, '').toUpperCase()}`;

  return (
    <View ref={ref} collapsable={false} style={[styles.poster, { width }]}>
      {/* Soft accent bloom behind the scan plate — a quiet color field, not a glow. */}
      <View
        pointerEvents="none"
        style={[
          styles.bloom,
          {
            backgroundColor: `${accent.light}26`,
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
          <ThemedText style={[styles.handle, { color: MIST }]}>@{me.handle}</ThemedText>
        </View>

        {/* Light scan plate: QR dark-on-light, hairline frame, corner ticks. */}
        <View style={styles.qrCard}>
          <View pointerEvents="none" style={[styles.tickTL, { borderColor: accent.light }]} />
          <View pointerEvents="none" style={[styles.tickBR, { borderColor: accent.light }]} />
          <QRCode
            value={publicLink(me.handle)}
            size={qrSize}
            color={QR_INK}
            backgroundColor={PLATE}
            quietZone={8}
            ecl="M"
          />
          <View style={[styles.scanRow, { width: qrSize }]}>
            <ThemedText style={[styles.scanLabel, { color: MICROCOPY }]}>SCAN · ADD</ThemedText>
            <ThemedText
              numberOfLines={1}
              ellipsizeMode="tail"
              style={[styles.scanTag, { color: accent.light }]}>
              {scanTag}
            </ThemedText>
          </View>
        </View>
      </View>

      <ThemedText style={styles.caption}>
        What&apos;s your <ThemedText style={[styles.captionAto, { color: accent.light }]}>ATO</ThemedText>?
      </ThemedText>
    </View>
  );
});

const styles = StyleSheet.create({
  poster: {
    aspectRatio: 9 / 16,
    backgroundColor: FIELD,
    borderRadius: 28,
    paddingTop: 40,
    paddingBottom: 32,
    paddingHorizontal: 28,
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: FIELD_HAIR,
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
    color: FROST,
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
    position: 'relative',
    alignItems: 'center',
    backgroundColor: PLATE,
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: PLATE_HAIR,
    shadowColor: PLATE_SHADOW,
    shadowOpacity: 1,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  tickTL: {
    position: 'absolute',
    top: 9,
    left: 9,
    width: 15,
    height: 15,
    borderTopWidth: 2.5,
    borderLeftWidth: 2.5,
    borderTopLeftRadius: 4,
  },
  tickBR: {
    position: 'absolute',
    bottom: 9,
    right: 9,
    width: 15,
    height: 15,
    borderBottomWidth: 2.5,
    borderRightWidth: 2.5,
    borderBottomRightRadius: 4,
  },
  scanRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingHorizontal: 2,
  },
  scanLabel: {
    fontSize: 9,
    fontFamily: 'monospace',
    fontWeight: '700',
    lineHeight: 11,
    letterSpacing: 1.6,
  },
  scanTag: {
    fontSize: 9,
    fontFamily: 'monospace',
    fontWeight: '700',
    lineHeight: 11,
    letterSpacing: 1.6,
  },
  caption: {
    color: CAPTION,
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  captionAto: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
});

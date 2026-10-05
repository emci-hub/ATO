import { forwardRef, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { ThemedText } from '@/components/themed-text';
import { TraitShape } from '@/components/trait-shape';
import { accentFromShowUp } from '@/lib/color';
import { SHARE_FAILED_COPY, SHARE_UNAVAILABLE_COPY, shareViewAsImage } from '@/lib/share';
import { publicLink } from '@/lib/share-codec';
import type { ShapePoint } from '@/lib/trait-shape';

/**
 * The image a person sends to a friend: either their identity (archetype name
 * + three trait phrases) or today's line. Stories size (9:16), fixed palette —
 * the same "shareable artifact, not a themed screen" rule as SharePoster, whose
 * colors these are.
 *
 * WHAT IS NEVER ON IT: a score, a number, an axis name, or anything the AI
 * wrote. Name, handle, the words above, and the QR to the public page.
 */
export interface SharePerson {
  name: string;
  handle: string;
  show_up: string | null;
}

export type ShareCardContent =
  | {
      kind: 'identity';
      title: string;
      traits: readonly string[];
      /** "Your shape" (polish pass): drawn without names or numbers. */
      shape?: readonly ShapePoint[];
    }
  | { kind: 'line'; text: string };

const FIELD = '#1A1B20';
const FROST = '#F5F1E9';
const MIST = '#A6A3AF';
const CAPTION = '#C9C5BC';
const PLATE = '#F6F2EA';
const QR_INK = '#191A1E';
const FIELD_HAIR = 'rgba(255, 255, 255, 0.10)';

export const ShareCard = forwardRef<View, { me: SharePerson; content: ShareCardContent; width?: number }>(
  function ShareCard({ me, content, width = 300 }, ref) {
    const accent = accentFromShowUp(me.show_up);
    const qrSize = Math.round(width * 0.3);

    return (
      <View ref={ref} collapsable={false} style={[styles.card, { width }]}>
        <View style={[styles.rule, { backgroundColor: accent.light }]} />

        <View style={styles.identity}>
          <ThemedText style={styles.name}>{me.name}</ThemedText>
          <ThemedText style={styles.handle}>@{me.handle}</ThemedText>
        </View>

        <View style={styles.body}>
          {content.kind === 'identity' ? (
            <>
              {content.shape ? (
                <View style={styles.shape}>
                  <TraitShape
                    points={content.shape}
                    size={Math.round(width * 0.34)}
                    animate={false}
                    palette={{ line: accent.light, grid: FIELD_HAIR, label: MIST }}
                  />
                </View>
              ) : null}
              <ThemedText style={[styles.kicker, { color: accent.light }]}>MY ATO</ThemedText>
              {/* Three-word names can run long: two lines, shrunk to fit, so the
                  QR below never moves. */}
              <ThemedText style={styles.title} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.6}>
                {content.title}
              </ThemedText>
              {/* With the shape on the card the three lines would push the QR off
                  a 9:16 image, so the shape stands in for them. */}
              <View style={styles.traits}>
                {(content.shape ? [] : content.traits).map((trait) => (
                  <ThemedText key={trait} style={styles.trait}>
                    {trait}
                  </ThemedText>
                ))}
              </View>
            </>
          ) : (
            <>
              <ThemedText style={[styles.kicker, { color: accent.light }]}>TODAY</ThemedText>
              <ThemedText style={styles.line}>{content.text}</ThemedText>
            </>
          )}
        </View>

        <View style={styles.footer}>
          <View style={styles.qrPlate}>
            <QRCode
              value={publicLink(me.handle)}
              size={qrSize}
              color={QR_INK}
              backgroundColor={PLATE}
              quietZone={6}
              ecl="M"
            />
          </View>
          <ThemedText style={styles.caption}>
            What&apos;s your <ThemedText style={[styles.captionAto, { color: accent.light }]}>ATO</ThemedText>?
          </ThemedText>
        </View>
      </View>
    );
  },
);

/**
 * Preview first, then share. The card has to be on screen to be captured, and
 * seeing exactly what is about to leave the phone is the point.
 */
export function ShareCardSheet({
  visible,
  onClose,
  me,
  content,
}: {
  visible: boolean;
  onClose: () => void;
  me: SharePerson;
  content: ShareCardContent;
}) {
  const cardRef = useRef<View>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

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
        <ShareCard ref={cardRef} me={me} content={content} />
        {note ? <ThemedText style={styles.note}>{note}</ThemedText> : null}
        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Share this image"
            disabled={busy}
            onPress={() => {
              void share();
            }}
            style={({ pressed }) => [styles.primary, (pressed || busy) && styles.pressed]}>
            <ThemedText style={styles.primaryText}>{busy ? 'Preparing…' : 'Share'}</ThemedText>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={onClose}
            style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}>
            <ThemedText style={styles.secondaryText}>Close</ThemedText>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  shape: {
    alignItems: 'center',
    paddingBottom: 8,
  },
  card: {
    aspectRatio: 9 / 16,
    backgroundColor: FIELD,
    borderRadius: 24,
    paddingTop: 32,
    paddingBottom: 24,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: FIELD_HAIR,
    overflow: 'hidden',
  },
  rule: {
    position: 'absolute',
    top: 0,
    left: 24,
    right: 24,
    height: 3,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
  },
  identity: {
    gap: 4,
  },
  name: {
    color: FROST,
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 26,
  },
  handle: {
    color: MIST,
    fontSize: 13,
    fontFamily: 'monospace',
  },
  body: {
    gap: 12,
  },
  kicker: {
    fontSize: 11,
    fontFamily: 'monospace',
    fontWeight: '700',
    letterSpacing: 1.6,
  },
  title: {
    color: FROST,
    fontSize: 30,
    fontWeight: '800',
    lineHeight: 36,
    letterSpacing: -0.4,
  },
  traits: {
    gap: 6,
  },
  trait: {
    color: CAPTION,
    fontSize: 15,
    lineHeight: 21,
  },
  line: {
    color: FROST,
    fontSize: 24,
    fontWeight: '600',
    lineHeight: 33,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  qrPlate: {
    backgroundColor: PLATE,
    borderRadius: 12,
    padding: 6,
  },
  caption: {
    color: CAPTION,
    fontSize: 14,
    fontWeight: '600',
  },
  captionAto: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 24,
  },
  note: {
    color: FROST,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  primary: {
    backgroundColor: FROST,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 28,
  },
  primaryText: {
    color: QR_INK,
    fontWeight: '700',
  },
  secondary: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: FIELD_HAIR,
    paddingVertical: 12,
    paddingHorizontal: 28,
  },
  secondaryText: {
    color: FROST,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.7,
  },
});

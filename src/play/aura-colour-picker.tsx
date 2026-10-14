/**
 * Aura colour picker (save v34). Two categories: Single colour (free) and Two
 * colours (a main colour + a different second colour for the small pieces; 150
 * tokens once per colour, 110 with a Tide Pass). `Match sword` follows the
 * equipped sword. The swatches are the real ramps the art is painted with.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Fonts } from '@/constants/theme';
import {
  auraColourways,
  auraMixPrice,
  auraRamps,
  auraSingleColourways,
  auraTintFor,
  auraTintLabel,
  auraTintParts,
  type AuraColourId,
  type AuraColourway,
  type AuraStyle,
  type AuraTint,
} from '@/play/auras';
import { NeonChip } from '@/play/neon-ui';
import { NEON } from '@/play/neon-viper';

function Swatch({
  style,
  tint,
  sword,
  on,
  label,
  onPress,
}: {
  style: AuraStyle;
  tint: AuraTint;
  sword: string | null;
  on: boolean;
  label: string;
  onPress: () => void;
}) {
  const ramps = auraRamps(style, tint, sword);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: on }}
      onPress={onPress}
      style={[styles.swatch, on && styles.swatchOn]}>
      <View style={[styles.half, { backgroundColor: ramps.main[2] }]} />
      <View style={[styles.half, { backgroundColor: ramps.second[2] }]} />
    </Pressable>
  );
}

export function AuraColourPicker({
  style,
  name,
  tint,
  sword,
  mixes,
  free,
  pass,
  onPick,
}: {
  style: AuraStyle;
  name: string;
  tint: AuraTint;
  /** Equipped sword element, or null. */
  sword: string | null;
  /** Two-colour sets this save owns. */
  mixes: readonly AuraColourId[];
  free: boolean;
  pass: boolean;
  onPick: (tint: AuraTint) => void;
}) {
  const parts = auraTintParts(tint);
  const two = parts.two;
  const list: readonly AuraColourway[] = two ? auraColourways() : auraSingleColourways();
  const owned = (id: AuraColourId) => free || mixes.includes(id);
  const price = auraMixPrice(pass);
  let lastGroup = '';
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <NeonChip label="Match sword" selected={parts.colour === 'sword'} onPress={() => onPick('sword')} />
        <NeonChip
          label="Single colour"
          selected={parts.colour !== 'sword' && !two}
          onPress={() => onPick(parts.colour === 'sword' || parts.colour === 'natural' ? 'ember' : auraTintFor(parts.colour, false))}
        />
        <NeonChip
          label="Two colours"
          selected={two}
          onPress={() => onPick(auraTintFor(parts.colour === 'sword' ? 'natural' : parts.colour, true))}
        />
      </View>
      {parts.colour === 'sword' ? null : (
        <View style={styles.row}>
          {list.map((item) => {
            const next = auraTintFor(item.id, two);
            const header = item.group !== lastGroup ? item.group : null;
            lastGroup = item.group;
            const label = `${name} ${auraTintLabel(next)}${two && !owned(item.id) ? `, ${price} tokens` : ''}`;
            return (
              <View key={item.id} style={styles.cell}>
                {header ? <Text style={styles.group}>{header}</Text> : <Text style={styles.group}> </Text>}
                <Swatch
                  style={style}
                  tint={next}
                  sword={sword}
                  on={parts.colour === item.id}
                  label={label}
                  onPress={() => onPick(next)}
                />
              </View>
            );
          })}
        </View>
      )}
      <Text style={styles.note}>
        {parts.colour === 'sword'
          ? 'Follows your equipped sword.'
          : two
            ? `${auraTintLabel(tint)}: a main colour and a different second colour.${
                !owned(parts.colour as AuraColourId) ? ` ${price} tokens once.` : ''
              }`
            : `${auraTintLabel(tint)}: one colour for the whole aura. Free.`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cell: { alignItems: 'flex-start', gap: 2 },
  group: { fontFamily: Fonts.mono, fontSize: 10, color: NEON.textMuted, minHeight: 12 },
  swatch: {
    width: 30,
    height: 30,
    borderRadius: 6,
    overflow: 'hidden',
    flexDirection: 'row',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  swatchOn: { borderColor: '#FFFFFF' },
  half: { flex: 1 },
  note: { fontFamily: Fonts.mono, fontSize: 11, lineHeight: 16, color: NEON.textMuted },
});

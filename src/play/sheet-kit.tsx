/**
 * Sheet kit (step 0l, 2026-10-16) — ONE border, corner, spacing, shadow and type language for the Play sheets.
 *
 *   border   2 pt, near-black edge (`SHEET.edge`); the open / selected card swaps it to mustard
 *   corner   6 pt on cards, 4 pt on chips and small controls
 *   spacing  4 / 8 / 12 / 16 only (`SHEET.gap`, `SHEET.pad`)
 *   shadow   one hard 2 pt drop under the card + a 1 pt inner highlight (no blur anywhere)
 *   type     title 22 (PixelLabel, pinned) · heading 18 · section 16 · body 14/20 · caption 12/18 (nothing smaller)
 *
 * Every box that holds text has a width and `numberOfLines` or can wrap: nothing runs out of its border.
 * `SheetSection` is the collapsed-by-default accordion the Info sheet is built from.
 */
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ComponentProps, ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type TextStyle, type ViewStyle } from 'react-native';

import { Fonts } from '@/constants/theme';
import { STREET, STREET_FONT } from '@/play/street-ui';

export const SHEET = {
  border: 2,
  edge: '#0D0D0F',
  radius: 6,
  radiusSmall: 4,
  gap: 8,
  pad: 12,
  /** Smallest tap target in a sheet. */
  tap: 44,
  type: {
    heading: 18,
    section: 16,
    body: 14,
    bodyLh: 20,
    caption: 12,
    captionLh: 18,
  },
} as const;

const SHADOW = `0 2px 0 ${SHEET.edge}, inset 0 0 0 1px rgba(242,237,228,0.12)`;
const SHADOW_ON = `0 2px 0 ${SHEET.edge}, inset 0 0 0 1px rgba(224,165,38,0.5)`;

/** The card surface every sheet block shares (Info sections, the Catch card's inner box, floating cards). */
export const sheetCard: ViewStyle = {
  borderWidth: SHEET.border,
  borderColor: SHEET.edge,
  borderRadius: SHEET.radius,
  backgroundColor: STREET.ink,
  boxShadow: SHADOW,
};
export const sheetCardOn: ViewStyle = { borderColor: STREET.mustard, boxShadow: SHADOW_ON };

/** The type scale as ready-made text styles. */
export const sheetText = StyleSheet.create({
  heading: {
    fontFamily: STREET_FONT.bold,
    fontSize: SHEET.type.heading,
    lineHeight: SHEET.type.heading + 4,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: STREET.paper,
  },
  body: { fontFamily: Fonts.mono, fontSize: SHEET.type.body, lineHeight: SHEET.type.bodyLh, color: STREET.paper },
  caption: {
    fontFamily: Fonts.mono,
    fontSize: SHEET.type.caption,
    lineHeight: SHEET.type.captionLh,
    color: STREET.muted,
  },
});

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

export function SheetSection({
  title,
  summary,
  icon,
  open,
  onToggle,
  children,
}: {
  title: string;
  summary: string;
  icon: IconName;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <View style={[sheetCard, open && sheetCardOn, styles.section]}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${open ? 'Collapse' : 'Expand'} ${title}`}
        style={({ pressed }) => [styles.head, pressed && styles.pressed]}>
        <View style={styles.icon}>
          <MaterialCommunityIcons name={icon} size={20} color={STREET.mustard} />
        </View>
        <View style={styles.headText}>
          <Text style={styles.title} numberOfLines={1} maxFontSizeMultiplier={1.2}>
            {title}
          </Text>
          <Text style={sheetText.caption} numberOfLines={1} maxFontSizeMultiplier={1.2}>
            {summary}
          </Text>
        </View>
        <MaterialCommunityIcons name={open ? 'chevron-up' : 'chevron-down'} size={22} color={STREET.muted} />
      </Pressable>
      {open ? <View style={styles.bodyWrap}>{children}</View> : null}
    </View>
  );
}

const titleStyle: TextStyle = {
  fontFamily: STREET_FONT.bold,
  fontSize: SHEET.type.section,
  lineHeight: SHEET.type.section + 4,
  letterSpacing: 0.5,
  textTransform: 'uppercase',
  color: STREET.paper,
};

const styles = StyleSheet.create({
  section: { width: '100%', overflow: 'hidden' },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 56,
    paddingHorizontal: SHEET.gap + 2,
    paddingVertical: SHEET.gap,
  },
  pressed: { backgroundColor: 'rgba(242,237,228,0.06)' },
  icon: {
    width: 32,
    height: 32,
    borderRadius: SHEET.radiusSmall,
    borderWidth: SHEET.border,
    borderColor: SHEET.edge,
    backgroundColor: STREET.asphalt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headText: { flex: 1, minWidth: 0 },
  title: titleStyle,
  bodyWrap: { paddingHorizontal: SHEET.pad, paddingBottom: SHEET.pad, gap: 10 },
});

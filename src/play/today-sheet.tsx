/**
 * The Today sheet body (Divecore finish step 4): a plain list, one sentence and one button per row, a quiet
 * footer. No timers, no animation, no colour but the kit's. It lives inside the existing PlaySheet.
 */
import { StyleSheet, View } from 'react-native';

import { PixelBody, PixelButton } from '@/play/pixel-ui';
import { STREET } from '@/play/street-ui';
import { TODAY_CAUGHT_UP, TODAY_FOOT, type TodayAction, type TodayItem } from '@/play/today';

export function TodaySheetBody({ items, onAction }: { items: readonly TodayItem[]; onAction: (action: TodayAction) => void }) {
  if (items.length === 0) {
    return (
      <View style={styles.list}>
        <PixelBody color={STREET.muted}>{TODAY_CAUGHT_UP}</PixelBody>
        <PixelBody size="sm" color={STREET.muted}>
          {TODAY_FOOT}
        </PixelBody>
      </View>
    );
  }
  return (
    <View style={styles.list}>
      {items.map((item) => (
        <View key={item.id} style={styles.row}>
          <View style={styles.text}>
            <PixelBody size="sm">{item.text}</PixelBody>
          </View>
          <PixelButton label={item.button} hug onPress={() => onAction(item.action)} accessibilityLabel={`${item.text}. ${item.button}`} />
        </View>
      ))}
      <PixelBody size="sm" color={STREET.muted}>
        {TODAY_FOOT}
      </PixelBody>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 56 },
  text: { flex: 1, minWidth: 0 },
});

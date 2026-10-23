/**
 * Turf War build card (step T2): the small card at the tapped pad that replaces the bottom panel.
 * Placement = `buildCardPlacement` (turf-layout.ts): above the pad, below it for the top 30 % of the
 * board, clamped inside the stage. Heights are fixed per mode (≤ BUILD_CARD_MAX_H), so the card never
 * depends on its content to find its spot.
 *
 * Two taps to buy: the first tap on a choice arms it (range ring via `onPreview`), the second buys.
 * Nothing here knows prices or rules — `defend-screen.tsx` hands in the choices and the callbacks.
 */
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { SHEET, sheetCard, sheetCardOn, sheetText } from '@/play/sheet-kit';
import { STREET, STREET_FONT } from '@/play/street-ui';
import { buildCardPlacement } from '@/play/turf-layout';
import { TURF_COST_RED, TurfButton, TurfPips } from '@/play/turf-ui';

export const BUILD_CARD_WIDTH = 344;
/**
 * Card heights per mode (pt), border and padding included (2 + 8 each side = 20 of chrome).
 * build 116 = 20 + head 32 + gap 4 + tiles 60 · tower 104 = 20 + 32 + 4 + button 48 · boss 120 = 20 + 44 + 4 + info 52.
 * All ≤ BUILD_CARD_MAX_H (check:turf-war-layout).
 */
export const BUILD_CARD_HEIGHT = { build: 116, tower: 104, boss: 120 } as const;

export type TurfChoice = {
  key: string;
  name: string;
  /** "40 scrap", "free", "max 6" … */
  detail: string;
  affordable: boolean;
  /** First tap: show the range ring. */
  onArm: () => void;
  /** Second tap: buy. */
  onBuy: () => void;
};

export type TurfBuildCardProps = {
  /** Stage size and its top-left in the float layer's coordinates. */
  stage: { width: number; height: number; x: number };
  /** Distance from the float layer's top to the stage top (the NoticeLane height). */
  stageTop: number;
  /** Pad centre in board units (0–100). */
  pad: { x: number; y: number };
  onClose: () => void;
  /** Called with null when an armed choice is dropped. */
  onPreviewEnd: () => void;
} & (
  | { mode: 'build'; title: string; choices: TurfChoice[] }
  | {
      mode: 'tower';
      title: string;
      level: number;
      maxLevel: number;
      /** null = fully upgraded. */
      upgradeCost: number | null;
      affordable: boolean;
      onUpgrade: () => void;
    }
  | { mode: 'boss'; title: string; info: string; onRemove: () => void }
);

export function TurfBuildCard(props: TurfBuildCardProps) {
  const { stage, stageTop, pad, onClose, onPreviewEnd } = props;
  const [armed, setArmed] = useState<string | null>(null);
  const width = Math.min(BUILD_CARD_WIDTH, stage.width - SHEET.gap * 2);
  const height = BUILD_CARD_HEIGHT[props.mode];
  const place = buildCardPlacement({ width: stage.width, height: stage.height }, pad, { width, height });

  const close = () => {
    onPreviewEnd();
    onClose();
  };

  return (
    <View
      style={[sheetCard, sheetCardOn, styles.card, { left: stage.x + place.x, top: stageTop + place.y, width, height }]}
      accessibilityViewIsModal={false}>
      <View style={[styles.head, props.mode === 'boss' && styles.headBoss]}>
        <Text style={[styles.title, props.mode === 'tower' && styles.titleFlex]} numberOfLines={1} maxFontSizeMultiplier={1.2}>
          {props.title}
        </Text>
        {props.mode === 'tower' ? <TurfPips level={props.level} max={props.maxLevel} /> : null}
        {props.mode === 'boss' ? (
          <TurfButton label="Remove" onPress={props.onRemove} style={styles.remove} accessibilityLabel="Remove bound tower" />
        ) : null}
        <Pressable
          onPress={close}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel="Close"
          style={({ pressed }) => [styles.close, pressed && styles.pressed]}>
          <MaterialCommunityIcons name="close" size={18} color={STREET.paper} />
        </Pressable>
      </View>

      {props.mode === 'build' ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tiles}>
          {props.choices.map((choice) => {
            const on = armed === choice.key;
            return (
              <Pressable
                key={choice.key}
                disabled={!choice.affordable}
                onPress={() => {
                  if (on) {
                    setArmed(null);
                    choice.onBuy();
                  } else {
                    setArmed(choice.key);
                    choice.onArm();
                  }
                }}
                accessibilityRole="button"
                accessibilityLabel={on ? `Build ${choice.name}, ${choice.detail}. Tap again to confirm` : `${choice.name}, ${choice.detail}. Tap to preview range`}
                accessibilityState={{ disabled: !choice.affordable, selected: on }}
                style={({ pressed }) => [
                  styles.tile,
                  on && styles.tileOn,
                  !choice.affordable && styles.dim,
                  pressed && choice.affordable && styles.pressed,
                ]}>
                <Text style={styles.tileName} numberOfLines={1} maxFontSizeMultiplier={1.2}>
                  {choice.name}
                </Text>
                <Text
                  style={[sheetText.caption, styles.tileDetail, !choice.affordable && { color: TURF_COST_RED }, on && { color: STREET.mustard }]}
                  numberOfLines={1}
                  maxFontSizeMultiplier={1.2}>
                  {on ? 'Tap to build' : choice.detail}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      {props.mode === 'tower' ? (
        props.upgradeCost != null ? (
          <TurfUpgrade
            cost={props.upgradeCost}
            affordable={props.affordable}
            onUpgrade={props.onUpgrade}
          />
        ) : (
          <Text style={sheetText.caption} maxFontSizeMultiplier={1.2}>
            Fully upgraded.
          </Text>
        )
      ) : null}

      {props.mode === 'boss' ? (
        <ScrollView style={styles.info} nestedScrollEnabled>
          <Text style={sheetText.caption} maxFontSizeMultiplier={1.2}>
            {props.info}
          </Text>
        </ScrollView>
      ) : null}
    </View>
  );
}

/** Upgrade button, two taps: the first arms ("Confirm"), the second buys. */
function TurfUpgrade({ cost, affordable, onUpgrade }: { cost: number; affordable: boolean; onUpgrade: () => void }) {
  const [armed, setArmed] = useState(false);
  return (
    <TurfButton
      label={armed ? 'Tap again to upgrade' : 'Upgrade'}
      icon="arrow-up-bold"
      detail={`${cost} scrap`}
      primary={affordable}
      state={affordable ? (armed ? 'selected' : 'ready') : 'unaffordable'}
      onPress={() => {
        if (armed) {
          setArmed(false);
          onUpgrade();
        } else setArmed(true);
      }}
    />
  );
}

const styles = StyleSheet.create({
  card: { position: 'absolute', padding: SHEET.gap, gap: 4, overflow: 'hidden' },
  head: { height: 32, flexDirection: 'row', alignItems: 'center', gap: SHEET.gap },
  headBoss: { height: 44 },
  title: {
    flex: 1,
    fontFamily: STREET_FONT.bold,
    fontSize: SHEET.type.section,
    lineHeight: SHEET.type.section + 4,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: STREET.paper,
  },
  titleFlex: { flex: 1 },
  close: {
    width: 32,
    height: 32,
    borderRadius: SHEET.radiusSmall,
    borderWidth: SHEET.border,
    borderColor: SHEET.edge,
    backgroundColor: STREET.asphalt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  remove: { minHeight: SHEET.tap, minWidth: 96 },
  pressed: { opacity: 0.85 },
  dim: { opacity: 0.6 },
  tiles: { gap: SHEET.gap, paddingRight: 2 },
  tile: {
    width: 100,
    height: 60,
    borderRadius: SHEET.radiusSmall,
    borderWidth: SHEET.border,
    borderColor: SHEET.edge,
    backgroundColor: STREET.asphalt,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  tileOn: { borderColor: STREET.mustard },
  tileName: {
    fontFamily: STREET_FONT.bold,
    fontSize: SHEET.type.body,
    lineHeight: SHEET.type.bodyLh,
    textTransform: 'uppercase',
    color: STREET.paper,
  },
  tileDetail: { textAlign: 'center' },
  info: { maxHeight: 52 },
});

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { SettingsFold } from '@/components/settings-fold';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { eventEnabled, nameFor } from '@/lib/almanac/calendar';
import { EVENTS, type Hemisphere } from '@/lib/almanac/events';
import { deviceRegion, hemisphereFromZone, loadLocale } from '@/lib/almanac/locale';
import {
  DEFAULT_ALMANAC_PREFS,
  loadAlmanacPrefs,
  saveAlmanacPrefs,
  setAlmanacHemisphere,
  type AlmanacPrefs,
} from '@/lib/almanac/prefs';
import { useMeContext } from '@/lib/me-context';
import { resyncPushForUser } from '@/lib/push';
import { controlBorderColor } from '@/lib/theme/chrome';

const HEMISPHERES: { value: Hemisphere; label: string }[] = [
  { value: 'north', label: 'North' },
  { value: 'south', label: 'South' },
  { value: 'tropics', label: 'Tropics' },
];

const CULTURAL = EVENTS.filter((def) => def.cultural && !def.personal);

interface SwitchRowProps {
  label: string;
  note?: string;
  value: boolean;
  onPress: () => void;
  greyed?: boolean;
  loaded: boolean;
}

function SwitchRow({ label, note, value, onPress, greyed, loaded }: SwitchRowProps) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value, disabled: !!greyed }}
      disabled={!loaded || greyed}
      onPress={onPress}
      style={({ pressed }) => [styles.row, greyed && styles.greyed, pressed && styles.pressed]}>
      <View style={styles.rowText}>
        <ThemedText type="smallBold">{label}</ThemedText>
        {note ? (
          <ThemedText type="small" themeColor="textSecondary">
            {note}
          </ThemedText>
        ) : null}
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        {loaded ? (value ? 'On' : 'Off') : '…'}
      </ThemedText>
    </Pressable>
  );
}

/**
 * Settings → "Seasonal content" (PHASE-11f). Master switch, hemisphere, one
 * switch per cultural event, and "Use my birthday" when a birthday is saved.
 * Everything is stored on the phone (`ato.almanac.prefs.v1`, hemisphere in
 * `ato.almanac.locale.v1`). Master off greys the rest out and turns off every
 * event, personal ones included; seasons and months always stay.
 */
export function SeasonalPrefsFold() {
  const theme = useTheme();
  const { me } = useMeContext();
  const zone = me?.timezone || 'UTC';
  const [prefs, setPrefs] = useState<AlmanacPrefs | null>(null);
  const [hemisphere, setHemisphere] = useState<Hemisphere>(hemisphereFromZone(zone));
  const region = deviceRegion();

  useEffect(() => {
    let live = true;
    void loadAlmanacPrefs(AsyncStorage).then((next) => live && setPrefs(next));
    void loadLocale(AsyncStorage, zone)
      .then((stored) => live && setHemisphere(stored.hemisphere))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [zone]);

  // Merge into the latest value, not the one captured at render, so two quick taps both land.
  const latest = useRef<AlmanacPrefs>(DEFAULT_ALMANAC_PREFS);
  useEffect(() => {
    if (prefs) latest.current = prefs;
  }, [prefs]);

  const update = useCallback(
    async (patch: Partial<AlmanacPrefs>) => {
      const merged = { ...latest.current, ...patch };
      latest.current = merged;
      setPrefs(await saveAlmanacPrefs(AsyncStorage, merged));
      // The next week of morning pushes is already scheduled, so rebuild it now.
      if (me) resyncPushForUser(me).catch(() => {});
    },
    [me],
  );

  const on = prefs ? prefs.seasonal : true;
  const shown = prefs ?? DEFAULT_ALMANAC_PREFS;
  const env = { tz: zone, region, hemisphere };

  const loaded = !!prefs;

  return (
    <SettingsFold title="Seasonal content">
      <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
        Holidays and moments on Home, Insights and the morning line. Seasons and months always stay.
      </ThemedText>
      <SwitchRow
        loaded={loaded}
        label="Seasonal content"
        value={on}
        onPress={() => void update({ seasonal: !on })}
      />

      <View>
        <View style={styles.row}>
          <View style={styles.rowText}>
            <ThemedText type="smallBold" accessibilityRole="header">
              Hemisphere
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Sets which season is which. Worked out from your time zone.
            </ThemedText>
          </View>
        </View>
        <View style={styles.segments}>
          {HEMISPHERES.map((option) => {
            const selected = hemisphere === option.value;
            return (
              <Pressable
                key={option.value}
                accessibilityRole="radio"
                accessibilityLabel={option.label}
                accessibilityState={{ selected }}
                onPress={() => {
                  setHemisphere(option.value);
                  void setAlmanacHemisphere(AsyncStorage, option.value, zone).then(() => {
                    if (me) resyncPushForUser(me).catch(() => {});
                  });
                }}
                style={[
                  styles.segment,
                  { borderColor: controlBorderColor(theme) },
                  selected && { backgroundColor: theme.backgroundSelected },
                ]}>
                <ThemedText type="small">{option.label}</ThemedText>
              </Pressable>
            );
          })}
        </View>

        <View style={!on ? styles.greyed : undefined}>
        {CULTURAL.filter((def) => !def.onlyRegions || (region && def.onlyRegions.includes(region))).map((def) => (
          <SwitchRow
            key={def.id}
            loaded={loaded}
            label={nameFor(def, env)}
            value={eventEnabled(def, env, { seasonal: true, cultural: shown.cultural })}
            greyed={!on}
            onPress={() => {
              const now = eventEnabled(def, env, { seasonal: true, cultural: shown.cultural });
              void update({ cultural: { ...shown.cultural, [def.id]: !now } });
            }}
          />
        ))}

        {me?.born_on ? (
          <SwitchRow
            loaded={loaded}
            label="Use my birthday"
            note="Stays on this phone. Your day gets its own line."
            value={shown.birthday}
            greyed={!on}
            onPress={() => void update({ birthday: !shown.birthday })}
          />
        ) : null}
        </View>
      </View>
    </SettingsFold>
  );
}

const styles = StyleSheet.create({
  hint: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.one,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    minHeight: 44,
  },
  rowText: {
    flex: 1,
  },
  segments: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    paddingVertical: Spacing.two,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Spacing.two,
  },
  greyed: {
    opacity: 0.45,
  },
  pressed: {
    opacity: 0.8,
  },
});

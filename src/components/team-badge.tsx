/**
 * Deep-dive team badge (emci 2026-10-09). Hidden by default: one plain team
 * icon; a tap opens the description (team name, one mini icon + line per
 * trait, team size from 5 people up, "you moved" when the group changed) and a
 * switch to show the team's mini icons on the card instead. The choice is
 * remembered per category on this phone. Only the group key goes to the
 * server, to ask the team size; nothing is shown to anyone else.
 * No team for "How You Love" (`teamForBucket` returns null).
 */
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState, type ComponentProps } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { fetchTeamSize } from '@/lib/ai-library/client';
import { TEAM_HIDDEN_ICON, teamA11y, teamForBucket, teamMovedLine } from '@/lib/ai-library/teams';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

export const TEAM_SHOW_KEY = 'ato.teamShow.v1';
export const TEAM_LABEL = 'Your team';
export const TEAM_SHOW_LABEL = 'Show my team icons';

async function loadShown(): Promise<Record<string, boolean>> {
  try {
    const raw = await AsyncStorage.getItem(TEAM_SHOW_KEY);
    const data = raw ? (JSON.parse(raw) as unknown) : null;
    return data && typeof data === 'object' ? (data as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

export function TeamBadge({
  categoryId,
  bucket,
  previousBucket,
}: {
  categoryId: string;
  bucket: string;
  /** The group the reader's last card was written for, when it differs ("you moved"). */
  previousBucket?: string | null;
}) {
  const theme = useTheme();
  const team = teamForBucket(bucket);
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(false);
  const [size, setSize] = useState<number | null>(null);

  useEffect(() => {
    let live = true;
    void loadShown().then((map) => {
      if (live) setShown(map[categoryId] === true);
    });
    return () => {
      live = false;
    };
  }, [categoryId]);

  useEffect(() => {
    setSize(null);
    if (!open || !team) return;
    let live = true;
    void fetchTeamSize(bucket).then((n) => {
      if (live) setSize(n);
    });
    return () => {
      live = false;
    };
    // The team name changes exactly when the bucket does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, bucket]);

  if (!team) return null;
  const moved = previousBucket ? teamMovedLine(teamForBucket(previousBucket), team) : null;

  const setShow = (value: boolean) => {
    setShown(value);
    void loadShown().then((map) => AsyncStorage.setItem(TEAM_SHOW_KEY, JSON.stringify({ ...map, [categoryId]: value })).catch(() => undefined));
  };

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={() => setOpen((cur) => !cur)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={shown ? `${TEAM_LABEL}: ${teamA11y(team)}` : `${TEAM_LABEL}. Tap to see it.`}
        style={({ pressed }) => [styles.row, { borderColor: theme.border }, pressed && styles.pressed]}>
        {shown ? (
          team.icons.map((icon) => (
            <MaterialCommunityIcons key={icon} name={icon as IconName} size={16} color={theme.accent} />
          ))
        ) : (
          <MaterialCommunityIcons name={TEAM_HIDDEN_ICON as IconName} size={16} color={theme.textSecondary} />
        )}
        <ThemedText type="small" themeColor="textSecondary">
          {TEAM_LABEL}
        </ThemedText>
      </Pressable>

      {open ? (
        <View style={styles.detail}>
          <ThemedText type="smallBold">{team.name}</ThemedText>
          {team.why.map((row) => (
            <View key={row.axis} style={styles.why}>
              <MaterialCommunityIcons name={row.icon as IconName} size={16} color={theme.accent} />
              <ThemedText type="small">
                {row.phrase}: {row.line}
              </ThemedText>
            </View>
          ))}
          {size != null ? (
            <ThemedText type="small" themeColor="textSecondary">
              {size}+ people have been on this team.
            </ThemedText>
          ) : null}
          {moved ? (
            <ThemedText type="small" themeColor="textSecondary">
              {moved}
            </ThemedText>
          ) : null}
          <View style={styles.why}>
            <ThemedText type="small" style={styles.flex}>
              {TEAM_SHOW_LABEL}
            </ThemedText>
            <Switch value={shown} onValueChange={setShow} accessibilityLabel={TEAM_SHOW_LABEL} />
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.one },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: Spacing.two,
    paddingVertical: 4,
    minHeight: 32,
  },
  detail: { gap: 6, paddingHorizontal: Spacing.one },
  why: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  flex: { flex: 1 },
  pressed: { opacity: 0.7 },
});

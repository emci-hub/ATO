/**
 * Turf team picker (pet team roadmap P5 → P5b): the leader + ONE helper slot, inside the Turf War Setup
 * sheet body (a scrolling PlaySheet), so no bar or the board ever changes size (fixed regions,
 * pinned by check:fixed-regions). Each pet shows the one status badge (`PetStatusBadge`, P2).
 * Rows wrap and have no fixed height, so Larger Text grows the sheet's scroll, never a region.
 * P5b: the helper follows the leader on its own — no spot to place, no Move.
 */
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { controlBorderColor } from '@/lib/theme/chrome';
import { heroName } from '@/play/heroes-data';
import { PetStatusBadge } from '@/play/pet-status-badge';
import { petStatusView } from '@/play/pet-status-view';
import { PlayFrame } from '@/play/play-frame';
import type { TurfCandidate, TurfHelperPick } from '@/play/turf-team';
import type { Grade } from '@/play/pet-eggs';

function petLabel(c: { name: string | null; heroId: string }): string {
  const hero = heroName(c.heroId);
  return c.name && c.name !== hero ? `${c.name} (${hero})` : hero;
}

export function TurfTeamCard({
  leaderHeroId,
  leaderFromPet,
  leaderGrade,
  leaderCopies,
  leaderShiny,
  candidates,
  picks,
  onPick,
}: {
  leaderHeroId: string;
  leaderFromPet: boolean;
  leaderGrade: Grade | null;
  leaderCopies: number;
  leaderShiny: boolean;
  candidates: readonly TurfCandidate[];
  picks: readonly TurfHelperPick[];
  /** Put a pet in the helper slot (uid), or empty it (null). */
  onPick: (uid: number | null) => void;
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const leaderStatus = leaderFromPet ? petStatusView({ grade: leaderGrade, copies: leaderCopies, shiny: leaderShiny }) : null;
  const border = controlBorderColor(theme);
  const pick = picks[0];
  const pet = pick ? candidates.find((c) => c.uid === pick.uid) ?? null : null;
  const status = pet ? petStatusView({ grade: pet.grade, copies: pet.copies, shiny: pet.shiny }) : null;

  return (
    <PlayFrame style={styles.card}>
      <ThemedText type="smallBold">Team</ThemedText>
      <View style={styles.row}>
        <ThemedText type="small" style={styles.grow}>
          Leader · {heroName(leaderHeroId)}
        </ThemedText>
        {leaderStatus ? <PetStatusBadge status={leaderStatus} variant="strip" /> : null}
      </View>
      <View style={styles.slot}>
        <View style={styles.row}>
          <Pressable
            onPress={() => setOpen(!open)}
            accessibilityRole="button"
            accessibilityState={{ expanded: open }}
            accessibilityLabel={pet ? `Helper: ${petLabel(pet)}. Change` : 'Helper: empty. Pick a pet'}
            style={({ pressed }) => [styles.grow, pressed && styles.pressed]}>
            <ThemedText type="small">Helper · {pet ? petLabel(pet) : 'empty — tap to pick'}</ThemedText>
          </Pressable>
          {status ? <PetStatusBadge status={status} variant="strip" /> : null}
        </View>
        {pet ? (
          <View style={styles.row}>
            <Pressable
              onPress={() => {
                onPick(null);
                setOpen(false);
              }}
              accessibilityRole="button"
              accessibilityLabel="Remove the helper"
              style={({ pressed }) => [styles.chip, { borderColor: border }, pressed && styles.pressed]}>
              <ThemedText type="smallBold">Remove</ThemedText>
            </Pressable>
          </View>
        ) : null}
        {open ? (
          <View style={styles.list}>
            {candidates.length === 0 ? (
              <ThemedText type="small" themeColor="textSecondary">
                Pets from Child stage up can help. Grow one in the Hideout.
              </ThemedText>
            ) : (
              candidates.map((c) => {
                const s = petStatusView({ grade: c.grade, copies: c.copies, shiny: c.shiny });
                const chosen = pet?.uid === c.uid;
                return (
                  <Pressable
                    key={c.uid}
                    onPress={() => {
                      onPick(c.uid);
                      setOpen(false);
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected: chosen }}
                    accessibilityLabel={`Pick ${petLabel(c)}${s ? `, ${s.label}` : ''}`}
                    style={({ pressed }) => [
                      styles.row,
                      styles.choice,
                      { borderColor: border },
                      chosen && { backgroundColor: theme.backgroundSelected },
                      pressed && styles.pressed,
                    ]}>
                    <ThemedText type="small" style={styles.grow}>
                      {petLabel(c)}
                    </ThemedText>
                    {s ? <PetStatusBadge status={s} variant="strip" /> : null}
                  </Pressable>
                );
              })
            )}
          </View>
        ) : null}
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        Your helper follows you, picks its own fights (a boss first) and casts its own skill. A boss swing
        only dazes it for a few seconds, then it gets back up.
      </ThemedText>
    </PlayFrame>
  );
}

const styles = StyleSheet.create({
  card: { gap: 8 },
  slot: { gap: 6 },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  grow: { flexGrow: 1, flexShrink: 1, minWidth: 0 },
  chip: { borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6, minHeight: 36, justifyContent: 'center' },
  list: { gap: 6 },
  choice: { borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8, minHeight: 44 },
  pressed: { opacity: 0.7 },
});

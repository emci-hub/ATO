import { StyleSheet, View } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

import { SettingsFold } from '@/components/settings-fold';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { PRE_LAUNCH_DEV } from '@/lib/dev-mode';
import { AXIS_EDITOR_COPY } from '@/lib/sage-knows';
import {
  filledAxisLabel,
  isAxisFilled,
  isProfileComplete,
  trackFor,
  type TraitTrack,
} from '@/lib/trait-stability';
import { TRAIT_AXES } from '@/lib/traits';

/** UNREVIEWED. Same lane as the other category/profile copy. */
export const PROFILE_FILL_COPY_REVIEWED = false;

export const PROFILE_FILL_LABEL = 'Full profile';
export const PROFILE_FILL_LEDE =
  'One answer is enough to fill a trait in. Filling one is not the same as settling it — settling takes a few answers that agree.';
export const PROFILE_FILL_COMPLETE_LABEL = 'Complete';
export const PROFILE_FILL_COMPLETE_LEDE =
  'Every trait has at least one answer. Questions can go anywhere from here.';

/**
 * Checklist of every axis, filled (>=1 report answer) or not. Deliberately
 * separate from the settled count in Full Profile: filled is the weaker
 * predicate, and the two are allowed to disagree. Report track only.
 */
export function ProfileFillFold({ tracks }: { tracks: readonly TraitTrack[] }) {
  const complete = isProfileComplete(tracks);
  const title = complete
    ? `${PROFILE_FILL_LABEL} · ${PROFILE_FILL_COMPLETE_LABEL}`
    : `${PROFILE_FILL_LABEL} · ${filledAxisLabel(tracks)}`;

  return (
    <SettingsFold title={title}>
      <View style={styles.body}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.lede}>
          {complete ? PROFILE_FILL_COMPLETE_LEDE : PROFILE_FILL_LEDE}
        </ThemedText>
        {/*
          No style prop between this gate and the badge text: the nearest `{`
          above the badge is what `check:copy-review-badges` reads as the render
          condition, so an inline style here would hide the PRE_LAUNCH_DEV gate
          from that check. Same prop-free shape as the other eight badge sites.
        */}
        {!PROFILE_FILL_COPY_REVIEWED && PRE_LAUNCH_DEV ? (
          <ThemedText type="code" themeColor="textSecondary">
            Draft copy — waiting on emci review.
          </ThemedText>
        ) : null}
        <View style={styles.list}>
          {TRAIT_AXES.map((axis) => (
            <ProfileFillRow
              key={axis}
              label={AXIS_EDITOR_COPY[axis].label}
              filled={isAxisFilled(trackFor(tracks, axis, 'report'))}
            />
          ))}
        </View>
      </View>
    </SettingsFold>
  );
}

function ProfileFillRow({ label, filled }: { label: string; filled: boolean }) {
  const theme = useTheme();
  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={`${label}. ${filled ? 'Filled' : 'Not answered yet'}.`}
      style={styles.row}>
      <MaterialCommunityIcons
        name={filled ? 'check-circle' : 'circle-outline'}
        size={18}
        color={filled ? theme.accentFill : theme.textSecondary}
      />
      <ThemedText
        type="small"
        themeColor={filled ? 'text' : 'textSecondary'}
        style={styles.rowLabel}>
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: Spacing.two,
  },
  lede: {
    paddingHorizontal: Spacing.three,
  },
  list: {
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.one,
    paddingBottom: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  rowLabel: {
    flex: 1,
  },
});

import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MilestoneToast } from '@/components/milestone-toast';
import { NAV_PIXEL_RIGHT, NAV_PIXEL_SLOT } from '@/components/nav-pixel';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { buddyNoteDone, useBuddy } from '@/lib/buddy/notes';
import { isCrisisActive } from '@/lib/kenney/gesture-actions';
import { useMeContext } from '@/lib/me-context';
import { useAppearance } from '@/lib/theme/context';

/**
 * The mini guy's speech bubble and his "something is waiting" dot.
 *
 * This is the pinned milestone toast the Questions screen used to have
 * (parked 2026-09-15), restored and moved to the tab shell: same
 * `MilestoneToast`, same position beside NavPixel, same fade — now fed by
 * lib/buddy/notes from anywhere in the app instead of by one screen.
 *
 * Lives outside nav-pixel.tsx on purpose: the bubble must not take touches
 * (`pointerEvents="none"`), and `check:floor` pins that NavPixel's own file
 * never contains that, so his tap can never be swallowed.
 *
 * Silent while the crisis card is up, same hard rule as his gestures.
 */
export function BuddyBubble() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { me } = useMeContext();
  const { reduceMotion } = useAppearance();
  const { showing, shownCount, waiting } = useBuddy();

  if (!me || isCrisisActive()) return null;

  const top = insets.top + Spacing.two;
  const right = Math.max(insets.right, NAV_PIXEL_RIGHT);

  return (
    <>
      {showing ? (
        <View pointerEvents="none" style={[styles.bubbleWrap, { top, right: right + NAV_PIXEL_SLOT }]}>
          <MilestoneToast
            // Keyed on the count, so a new note restarts the hold-and-fade.
            key={shownCount}
            title={showing.title}
            body={showing.body}
            reduceMotion={reduceMotion}
            onDone={buddyNoteDone}
            style={styles.bubble}
          />
        </View>
      ) : null}
      {!showing && waiting.length > 0 ? (
        <View
          pointerEvents="none"
          accessibilityLabel={`${waiting.length} new`}
          style={[
            styles.dot,
            { top: top + Spacing.one, right: right + Spacing.one, backgroundColor: theme.accent, borderColor: theme.background },
          ]}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  bubbleWrap: {
    position: 'absolute',
    alignItems: 'flex-end',
    zIndex: 90, // below NavPixel's 100, so he renders on top if they ever overlap
  },
  bubble: {
    alignSelf: 'flex-end',
    maxWidth: 240,
  },
  dot: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    zIndex: 101, // on top of him
  },
});

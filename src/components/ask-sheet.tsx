import { StyleSheet } from 'react-native';

import { RankingBody } from '@/components/ranking-card';
import { SageKnowsBody } from '@/components/sage-knows-card';
import { ScenarioBody } from '@/components/scenario-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import type { AskPick } from '@/lib/ask';
import type { Me } from '@/lib/me';
import { traitStateFromRow } from '@/lib/traits';

export type AskSheetProps = {
  pick: AskPick;
  me?: Me;
  onUpdated?: () => void;
};

const ASK_HEADER = 'One thing, then back to your day.';

/**
 * One frame for whichever ask resolveAsk picked. Mechanic names stay off this surface.
 */
export default function AskSheet({ pick, me, onUpdated }: AskSheetProps) {
  const userId = me?.id;
  const current =
    pick.kind === 'sage_knows' && me
      ? traitStateFromRow(me).values[pick.prompt.axis]
      : null;

  async function afterWrite() {
    onUpdated?.();
  }

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <ThemedText type="code" themeColor="textSecondary" style={styles.header}>
        {ASK_HEADER}
      </ThemedText>
      {pick.kind === 'sage_knows' ? (
        <SageKnowsBody
          prompt={pick.prompt}
          userId={userId}
          current={current}
          onUpdated={afterWrite}
        />
      ) : null}
      {pick.kind === 'ranking' ? (
        <RankingBody prompt={pick.prompt} userId={userId} onUpdated={afterWrite} />
      ) : null}
      {pick.kind === 'scenario' ? (
        <ScenarioBody prompt={pick.prompt} userId={userId} onUpdated={afterWrite} />
      ) : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Spacing.four,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  header: {
    textTransform: 'none',
  },
});

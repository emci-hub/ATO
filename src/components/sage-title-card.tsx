import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedPressable } from '@/components/themed-pressable';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { fallbackCategoryCopies } from '@/lib/category-bands';
import { PRE_LAUNCH_DEV } from '@/lib/dev-mode';
import { generateExploreBody } from '@/lib/explore/generate';
import { SAGE_TITLE_META } from '@/lib/ai/call-sites';
import { localYmd } from '@/lib/local-date';
import type { Me } from '@/lib/me';
import {
  TITLE_COPY_REVIEWED,
  TITLE_EMPTY,
  TITLE_PUSHBACK,
  TITLE_PUSHBACK_SAVED,
  buildTitlePrompt,
  combinedFingerprint,
  drivingAxisLines,
  parseCombinedBody,
  parseSageTitle,
  titleReady,
  type SageTitle,
} from '@/lib/sage-title';
import { claimTitleGenerate, insertTitleFlag, saveSageTitle } from '@/lib/sage-title-store';
import { isThinProfile, settledCount, stableReportAxes, type TraitTrack } from '@/lib/trait-stability';
import { containsFrameworkTerm } from '@/lib/voice/framework-fence';
import { shouldUseLocalAi } from '@/lib/ai/override';

export function SageTitleCard({
  me,
  tracks,
  tracksReady,
}: {
  me: Me;
  tracks: readonly TraitTrack[];
  tracksReady: boolean;
}) {
  const [title, setTitle] = useState<SageTitle | null>(() => parseSageTitle(me.sage_title));
  const [busy, setBusy] = useState(false);
  const [flagged, setFlagged] = useState(false);
  const [showAxes, setShowAxes] = useState(false);
  const fingerprint = combinedFingerprint(tracks);

  useEffect(() => {
    setTitle(parseSageTitle(me.sage_title));
  }, [me.sage_title]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!tracksReady) return;
      const today = localYmd(new Date(), me.timezone || 'UTC');
      const cached = parseSageTitle(me.sage_title);
      const fallbackCats = fallbackCategoryCopies(tracks);

      if (!titleReady(tracks)) {
        if (!cancelled) setTitle(null);
        return;
      }
      if (cached?.generatedOn === today) {
        if (!cancelled) setTitle(cached);
        return;
      }
      if (cached && cached.fingerprint === fingerprint) {
        if (!cancelled) setTitle(cached);
        return;
      }
      // Profile-completeness gate: a thin profile is served from local
      // compose, no model call and no quota claim — same rule Questions/
      // Story already apply, extended here since Sage Title had none
      // (titleReady above only needs 2 stable axes, well below thin-profile).
      if ((await shouldUseLocalAi()) || isThinProfile(settledCount(tracks))) {
        const local: SageTitle = {
          title: cached?.title ?? TITLE_EMPTY,
          lede: cached?.lede ?? TITLE_EMPTY,
          fingerprint,
          generatedOn: today,
          axes: stableReportAxes(tracks),
          categories: Object.keys(cached?.categories ?? {}).length > 0 ? cached!.categories : fallbackCats,
        };
        try {
          await saveSageTitle(me.id, local);
        } catch (err) {
          console.log('[sage-title] local save error:', err);
        }
        if (!cancelled) setTitle(local);
        return;
      }
      setBusy(true);
      try {
        const claim = await claimTitleGenerate();
        if (!claim.ok) {
          if (!cancelled) setTitle(cached);
          return;
        }
        const raw = await generateExploreBody(buildTitlePrompt(tracks, today), SAGE_TITLE_META);
        const parsed = raw ? parseCombinedBody(raw) : null;
        if (!parsed || containsFrameworkTerm(parsed.title) || containsFrameworkTerm(parsed.lede)) {
          if (!cancelled) setTitle(cached);
          return;
        }
        const next: SageTitle = {
          title: parsed.title,
          lede: parsed.lede,
          fingerprint,
          generatedOn: today,
          axes: stableReportAxes(tracks),
          categories: Object.keys(parsed.categories).length > 0 ? parsed.categories : fallbackCats,
        };
        await saveSageTitle(me.id, next);
        if (!cancelled) setTitle(next);
      } catch (err) {
        console.log('[sage-title] generate error:', err);
        if (!cancelled) setTitle(cached);
      } finally {
        if (!cancelled) setBusy(false);
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [me.id, me.timezone, me.sage_title, tracks, tracksReady, fingerprint]);

  async function flag() {
    if (!title || flagged) return;
    try {
      await insertTitleFlag({
        userId: me.id,
        title: title.title,
        lede: title.lede,
        axes: title.axes,
        fingerprint: title.fingerprint,
      });
      setFlagged(true);
      setShowAxes(true);
    } catch (err) {
      console.log('[sage-title] flag error:', err);
    }
  }

  const shown = title && title.title !== TITLE_EMPTY ? title : null;
  const axisLines = shown ? drivingAxisLines(shown.axes, tracks) : [];

  return (
    <View style={styles.block} testID="sage-title-card">
      <ThemedText type="smallBold">{shown ? shown.title : TITLE_EMPTY}</ThemedText>
      {shown ? (
        <ThemedText type="small" themeColor="textSecondary">
          {shown.lede}
        </ThemedText>
      ) : (
        <ThemedText type="small" themeColor="textSecondary">
          {busy ? 'Sage is naming a shape…' : TITLE_EMPTY}
        </ThemedText>
      )}
      {!TITLE_COPY_REVIEWED && PRE_LAUNCH_DEV ? (
        <ThemedText type="code" themeColor="textSecondary">
          Draft copy — waiting on emci review.
        </ThemedText>
      ) : null}
      {shown ? (
        <ThemedPressable onPress={() => void flag()} disabled={flagged} style={styles.row}>
          <ThemedText type="small" themeColor="textSecondary">
            {flagged ? TITLE_PUSHBACK_SAVED : TITLE_PUSHBACK}
          </ThemedText>
        </ThemedPressable>
      ) : null}
      {showAxes && axisLines.length > 0 ? (
        <View style={styles.axes}>
          {axisLines.map((line) => (
            <ThemedText key={line} type="small" themeColor="textSecondary">
              {line}
            </ThemedText>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: Spacing.one,
    paddingBottom: Spacing.two,
  },
  row: {
    alignSelf: 'flex-start',
    paddingVertical: Spacing.one,
  },
  axes: {
    gap: Spacing.one,
    paddingLeft: Spacing.one,
  },
});

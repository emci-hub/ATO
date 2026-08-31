import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedPressable } from '@/components/themed-pressable';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { generateExploreBody } from '@/lib/explore/generate';
import { localYmd } from '@/lib/local-date';
import type { Me } from '@/lib/me';
import {
  TITLE_COPY_REVIEWED,
  TITLE_EMPTY,
  TITLE_PUSHBACK,
  TITLE_PUSHBACK_SAVED,
  buildTitlePrompt,
  drivingAxisLines,
  parseSageTitle,
  parseTitleBody,
  titleFingerprint,
  titleReady,
  type SageTitle,
} from '@/lib/sage-title';
import { claimTitleGenerate, insertTitleFlag, saveSageTitle } from '@/lib/sage-title-store';
import { stableReportAxes, type TraitTrack } from '@/lib/trait-stability';
import { VOICE_CONFIG } from '@/lib/voice/config';
import { containsFrameworkTerm } from '@/lib/voice/framework-fence';

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
  const fingerprint = titleFingerprint(tracks);

  useEffect(() => {
    setTitle(parseSageTitle(me.sage_title));
  }, [me.sage_title]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!tracksReady) return;
      if (!titleReady(tracks)) {
        if (!cancelled) setTitle(null);
        return;
      }
      const today = localYmd(new Date(), me.timezone || 'UTC');
      const cached = parseSageTitle(me.sage_title);
      if (cached?.generatedOn === today) {
        if (!cancelled) setTitle(cached);
        return;
      }
      if (cached && cached.fingerprint === fingerprint) {
        if (!cancelled) setTitle(cached);
        return;
      }
      if (VOICE_CONFIG.provider === 'local' || !VOICE_CONFIG.geminiApiKey) {
        if (!cancelled) setTitle(cached);
        return;
      }
      setBusy(true);
      try {
        const claim = await claimTitleGenerate();
        if (!claim.ok) {
          if (!cancelled) setTitle(cached);
          return;
        }
        const raw = await generateExploreBody(buildTitlePrompt(tracks, today));
        const parsed = raw ? parseTitleBody(raw) : null;
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
      {!TITLE_COPY_REVIEWED ? (
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

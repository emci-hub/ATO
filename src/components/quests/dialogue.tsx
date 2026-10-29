import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { GradientFill, Glass } from '@/components/quests/glass';
import { useBreath } from '@/hooks/use-breath';
import { useMotionReduced } from '@/hooks/use-motion-reduced';
import { DUR, haptic } from '@/lib/motion-tokens';
import { UI_COPY } from '@/lib/quests/strings';
import type { StoryLine } from '@/lib/quests/types';
import { QT, QT_RADIUS, QT_SPACE, QT_TYPE } from '@/lib/quests/theme';
import { charsAt, lineLength, sliceSegs, speakerOf, splitKeywords, typeSchedule } from '@/lib/quests/view';

/** Time between two lines of one scene while typing. */
const LINE_GAP_MS = 220;
const TICK_MS = 40;

/** Is VoiceOver (or TalkBack) running? Then the text is shown whole and read at once. */
function useScreenReader(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isScreenReaderEnabled().then((v) => alive && setOn(v)).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('screenReaderChanged', setOn);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  return on;
}

export function LineText({ line, chars }: { line: StoryLine; chars: number | null }) {
  const segs = useMemo(() => splitKeywords(line.text, line.keywords), [line]);
  const shown = chars === null ? segs : sliceSegs(segs, chars);
  return (
    <Text style={[styles.body, line.kind === 'inner' && styles.inner, line.kind === 'dialogue' && styles.spoken]}>
      {shown.map((s, i) => (
        <Text key={i} style={s.hot ? styles.hot : undefined}>
          {s.text}
        </Text>
      ))}
    </Text>
  );
}

/**
 * The glass dialogue card: a speaker pill that cross-fades, the scene's lines
 * typing at 70 characters a second (+120 ms after . , —) with a blinking caret,
 * tap to finish. Under Reduce Motion, with a screen reader, or on a resumed
 * scene the text is there at once. `onDone` fires once when the whole scene is
 * showing.
 */
export function Dialogue({
  lines,
  instant,
  onDone,
  onTyping,
}: {
  lines: StoryLine[];
  /** A resumed or already-read scene. */
  instant: boolean;
  onDone: () => void;
  /** Tells the stage who is talking: `null` when typing has stopped. */
  onTyping: (state: { npc: boolean } | null) => void;
}) {
  const rm = useMotionReduced();
  const reader = useScreenReader();
  const skip = instant || rm || reader;

  const plan = useMemo(() => {
    let start = 0;
    return lines.map((line) => {
      const schedule = typeSchedule(line.text);
      const end = start + (schedule.length ? schedule[schedule.length - 1] : 0);
      const entry = { start, end, schedule };
      start = end + LINE_GAP_MS;
      return entry;
    });
  }, [lines]);
  const total = plan.length ? plan[plan.length - 1].end : 0;

  const [elapsed, setElapsed] = useState(skip ? total + 1 : 0);
  const [caretOn, setCaretOn] = useState(true);
  const doneRef = useRef(false);
  const done = elapsed >= total;

  // One timer for the whole scene; it stops itself when everything is showing.
  useEffect(() => {
    if (skip || done) return;
    const t0 = Date.now() - elapsed;
    const id = setInterval(() => {
      const ms = Date.now() - t0;
      setElapsed(ms);
      setCaretOn(Math.floor(ms / 500) % 2 === 0);
    }, TICK_MS);
    return () => clearInterval(id);
    // `elapsed` only seeds the start time of a re-armed timer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skip, done]);

  useEffect(() => {
    if (skip && !done) setElapsed(total + 1);
  }, [skip, done, total]);

  const currentIdx = done ? lines.length - 1 : Math.max(0, plan.findIndex((p) => elapsed < p.end + 1));
  const current = lines[Math.max(0, currentIdx)];
  const speaker = current ? speakerOf(current) : null;

  useEffect(() => {
    if (done) {
      onTyping(null);
      if (!doneRef.current) {
        doneRef.current = true;
        onDone();
      }
    } else {
      onTyping({ npc: current?.kind === 'dialogue' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, currentIdx]);

  // Leaving mid-sentence must not leave the stage thinking someone is talking.
  useEffect(() => () => onTyping(null), []); // eslint-disable-line react-hooks/exhaustive-deps

  const fullText = lines.map((l) => (speakerOf(l) ? `${speakerOf(l)}: ${l.text}` : l.text)).join(' ');

  return (
    <Animated.View entering={rm ? FadeIn.duration(300) : FadeInDown.duration(350)}>
      <Pressable
        accessible
        accessibilityRole="text"
        accessibilityLabel={fullText}
        accessibilityHint={done ? undefined : UI_COPY.tapToFinish}
        disabled={done}
        onPress={() => setElapsed(total + 1)}
      >
        <Glass style={styles.card}>
          {speaker ? (
            <Animated.View key={speaker} entering={FadeIn.duration(rm ? 200 : 180)} style={styles.nameplate}>
              <Text style={styles.nameText}>{speaker}</Text>
            </Animated.View>
          ) : null}
          <View style={styles.lines}>
            {lines.map((line, i) => {
              if (!done && i > currentIdx) return null;
              const typingThis = !done && i === currentIdx;
              const chars = typingThis ? charsAt(plan[i].schedule, elapsed - plan[i].start) : null;
              return (
                <View key={i}>
                  {i !== currentIdx && speakerOf(line) && !skip ? (
                    <Text style={styles.inlineSpeaker}>{speakerOf(line)}</Text>
                  ) : null}
                  <LineText line={line} chars={typingThis ? Math.min(chars ?? 0, lineLength(line)) : null} />
                </View>
              );
            })}
            {!done && !skip ? <Text style={[styles.caret, !caretOn && styles.caretOff]}>▌</Text> : null}
          </View>
        </Glass>
      </Pressable>
    </Animated.View>
  );
}

/** A full-width primary button with a gentle pulse (the Reduce Motion pulse is the slow BREATH). */
export function ContinueButton({ label = UI_COPY.continue, onPress, disabled = false }: { label?: string; onPress: () => void; disabled?: boolean }) {
  const { style } = useBreath(false, true);
  return (
    <Animated.View style={disabled ? undefined : style}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={() => {
          haptic.press();
          onPress();
        }}
        style={({ pressed }) => [styles.button, disabled && styles.buttonOff, pressed && styles.pressed]}
      >
        {disabled ? null : <GradientFill radius={QT_RADIUS.choice} />}
        <Text style={[styles.buttonText, disabled && styles.buttonTextOff]}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

/**
 * "You chose": the beat after a commit. It slides up with an amber ring, shows
 * what the choice led to, and holds the d20 tile and Continue passed in.
 */
export function BeatCard({ choiceLabel, result, children }: { choiceLabel: string; result: StoryLine[]; children?: ReactNode }) {
  const rm = useMotionReduced();
  return (
    <Animated.View entering={rm ? FadeIn.duration(300) : FadeInDown.duration(DUR.scene)}>
      <Glass ring style={styles.card}>
        <Text style={styles.youChose}>{UI_COPY.youChose}</Text>
        <Text style={styles.choiceLabel}>{choiceLabel}</Text>
        <View style={styles.lines}>
          {result.map((line, i) => (
            <LineText key={i} line={line} chars={null} />
          ))}
        </View>
        {children}
      </Glass>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { padding: QT_SPACE.pad + 2, gap: 10 },
  nameplate: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(34,211,238,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(34,211,238,0.35)',
    borderRadius: QT_RADIUS.pill,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  nameText: { ...QT_TYPE.label, color: QT.sky },
  lines: { gap: 8 },
  body: { ...QT_TYPE.body, color: QT.text },
  spoken: { color: QT.text },
  inner: { fontStyle: 'italic', color: QT.sub },
  hot: { color: QT.sky, fontWeight: '700' },
  inlineSpeaker: { ...QT_TYPE.label, color: QT.sub, marginBottom: 2 },
  caret: { color: QT.cyan, fontSize: 16, lineHeight: 18 },
  caretOff: { opacity: 0 },
  youChose: { ...QT_TYPE.label, color: QT.amber },
  choiceLabel: { ...QT_TYPE.h2, color: QT.text },
  button: {
    minHeight: 52,
    borderRadius: QT_RADIUS.choice,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  buttonOff: { backgroundColor: QT.track },
  pressed: { opacity: 0.85 },
  buttonText: { ...QT_TYPE.ui, color: '#041014', fontSize: 17 },
  buttonTextOff: { color: QT.sub },
});

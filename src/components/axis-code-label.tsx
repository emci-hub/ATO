import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ConceptHint } from '@/components/concept-hint';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { codeForAxis } from '@/lib/axis-codes';
import { axisConcept } from '@/lib/concept-explainers';
import type { TraitAxis } from '@/lib/traits';

/** Tap the 2-letter code to reveal the full name. ? explains the concept. */
export function AxisCodeLabel({
  axis,
  name,
}: {
  axis: TraitAxis;
  name: string;
}) {
  const [open, setOpen] = useState(false);
  const code = codeForAxis(axis);

  return (
    <ConceptHint explainer={axisConcept(axis)} label={name}>
      <Pressable
        onPress={() => setOpen((value) => !value)}
        accessibilityRole="button"
        accessibilityLabel={open ? name : code}
        accessibilityHint={open ? 'Hide the full name' : 'Show the full name'}
        style={({ pressed }) => [styles.hit, pressed && styles.pressed]}>
        <ThemedText type="smallBold">{open ? `${code} · ${name}` : code}</ThemedText>
      </Pressable>
    </ConceptHint>
  );
}

const styles = StyleSheet.create({
  hit: {
    alignSelf: 'flex-start',
    paddingVertical: Spacing.half,
  },
  pressed: {
    opacity: 0.8,
  },
});

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { View } from 'react-native';

import type { AlmanacDay } from '@/hooks/use-almanac-day';
import { lerpColor, lookOf } from '@/lib/almanac/look';

import { DecorLayer } from './decor-layer';
import { EdgeSprigs } from './edge-sprigs';

const TWEEN_MS = 300;

/** A colour that eases to its target in 300 ms (pure JS lerp, in every motion mode). */
function useTweenedColor(target: string | undefined): string | undefined {
  const [color, setColor] = useState(target);
  const current = useRef(target);
  useEffect(() => {
    if (!target) {
      current.current = undefined;
      setColor(undefined);
      return;
    }
    if (!current.current || current.current === target) {
      current.current = target;
      setColor(target);
      return;
    }
    const from = current.current;
    const start = Date.now();
    let raf = 0;
    const step = () => {
      const t = Math.min(1, (Date.now() - start) / TWEEN_MS);
      current.current = lerpColor(from, target, t);
      setColor(current.current);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return color;
}

/**
 * Home's seasonal theme (PHASE-11h): wraps the hero so its constellation takes the
 * season's tint (lerped toward the event's colour by the displayed intensity) and
 * the decor, sprigs and sticker sit over it. `children` gets the accent to hand to
 * the constellation. With no Almanac day (not loaded yet, or nothing to decorate)
 * the same wrapper renders the child untouched at its own size, so the
 * constellation never remounts when the day arrives.
 */
export function SeasonTheme({
  day,
  size,
  children,
}: {
  day: AlmanacDay | null;
  size: number;
  children: (accent: string | undefined) => ReactNode;
}) {
  const look = useMemo(() => (day ? lookOf(day.theme) : null), [day]);
  const accent = useTweenedColor(look?.accent);
  return (
    <View style={look ? { width: size, height: size } : undefined}>
      {children(look ? accent : undefined)}
      {look ? <EdgeSprigs look={look} /> : null}
      {look ? <DecorLayer look={look} size={size} /> : null}
    </View>
  );
}

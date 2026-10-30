import { useIsFocused } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

/**
 * True while the screen is focused and the app is in the foreground. Looping
 * animations run only then (ATO-BUILD §1.1 perf), so a hidden tab or a
 * backgrounded app spends nothing.
 */
export function useMotionActive(): boolean {
  const focused = useIsFocused();
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => setForeground(state === 'active'));
    return () => sub.remove();
  }, []);
  return focused && foreground;
}

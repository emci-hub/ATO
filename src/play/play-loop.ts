/**
 * Pause Hideout / Underground loops when the app is backgrounded or the
 * scene is not the focused tab. Effects stay mounted; timers and ticks stop.
 */
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

export function usePlayLoopAlive(sceneOn: boolean): boolean {
  const [appOn, setAppOn] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => setAppOn(state === 'active'));
    return () => sub.remove();
  }, []);
  return sceneOn && appOn;
}

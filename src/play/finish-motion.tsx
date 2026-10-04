/**
 * Shared foil motion (save v30). One gyro for every finish on screen.
 *
 * `useAnimatedSensor` is part of react-native-reanimated (already in the
 * native binary), not a new module and not expo-sensors. The runner mounts
 * only while a finished pet is leased (the finish picker, the pet card, the
 * room), the app is active, and motion is allowed. Unmounting the runner
 * unregisters the sensor. Reduce Motion and Low effects mount nothing, so
 * tilt and the drift both hold still. A gyro that never reports, or that
 * stays at zero, leaves the tilt at rest and the slow drift keeps going.
 */
import { useEffect, useState, useSyncExternalStore } from 'react';
import { AccessibilityInfo, AppState } from 'react-native';
import {
  Easing,
  IOSReferenceFrame,
  SensorType,
  cancelAnimation,
  makeMutable,
  useAnimatedReaction,
  useAnimatedSensor,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { finishConfig } from '@/play/finishes';
import { useFxQuality } from '@/play/fx-quality';

/** How long a dead (all-zero) gyro is tolerated before tilt gives up. */
export const SENSOR_DEAD_MS = 1500;
const TILT_ALPHA = 0.16;

export const foilDrift = makeMutable(0.35);
export const foilTiltX = makeMutable(0);
export const foilTiltY = makeMutable(0);

let leases = 0;
const listeners = new Set<() => void>();

function emitLease() {
  for (const listener of listeners) listener();
}

export function finishSensorLeased(): boolean {
  return leases > 0;
}

/** Hold the gyro while this view is mounted. Returns the release. */
export function leaseFinishSensor(): () => void {
  leases += 1;
  emitLease();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    leases = Math.max(0, leases - 1);
    emitLease();
  };
}

export function subscribeFinishLease(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function useOsReduceMotion(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    let live = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (live) setOn(value);
      })
      .catch(() => {
        // The Play override still applies.
      });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setOn);
    return () => {
      live = false;
      sub.remove();
    };
  }, []);
  return on;
}

function DriftLoop() {
  const ms = finishConfig().drift_ms;
  useEffect(() => {
    foilDrift.value = 0;
    foilDrift.value = withRepeat(withTiming(1, { duration: ms, easing: Easing.inOut(Easing.sin) }), -1, true);
    return () => {
      cancelAnimation(foilDrift);
      foilDrift.value = 0.35;
    };
  }, [ms]);
  return null;
}

function SensorRunner() {
  const sensor = useAnimatedSensor(SensorType.ROTATION, {
    interval: 50,
    adjustToInterfaceOrientation: true,
    // Arbitrary vertical frame: pitch and roll, no compass calibration panel.
    iosReferenceFrame: IOSReferenceFrame.XArbitraryZVertical,
  });
  const maxRad = (finishConfig().tilt_max_deg * Math.PI) / 180;
  const smoothX = useSharedValue(0);
  const smoothY = useSharedValue(0);
  const baseX = useSharedValue(0);
  const baseY = useSharedValue(0);
  const primed = useSharedValue(0);
  const zeroSince = useSharedValue(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (primed.value === 0) {
        foilTiltX.value = 0;
        foilTiltY.value = 0;
      }
    }, SENSOR_DEAD_MS);
    return () => clearTimeout(timer);
  }, [primed]);

  useAnimatedReaction(
    () => ({
      roll: sensor.sensor.value.roll,
      pitch: sensor.sensor.value.pitch,
      yaw: sensor.sensor.value.yaw,
    }),
    (cur) => {
      const roll = cur.roll || 0;
      const pitch = cur.pitch || 0;
      const yaw = cur.yaw || 0;
      const mag = Math.abs(roll) + Math.abs(pitch) + Math.abs(yaw);
      const now = Date.now();
      if (mag < 0.004) {
        if (zeroSince.value === 0) zeroSince.value = now;
        if (now - zeroSince.value > SENSOR_DEAD_MS) {
          smoothX.value += (0 - smoothX.value) * TILT_ALPHA;
          smoothY.value += (0 - smoothY.value) * TILT_ALPHA;
          foilTiltX.value = smoothX.value;
          foilTiltY.value = smoothY.value;
        }
        return;
      }
      zeroSince.value = 0;
      if (primed.value === 0) {
        baseX.value = roll;
        baseY.value = pitch;
        primed.value = 1;
      } else {
        baseX.value += (roll - baseX.value) * 0.004;
        baseY.value += (pitch - baseY.value) * 0.004;
      }
      const dx = Math.min(maxRad, Math.max(-maxRad, roll - baseX.value)) / maxRad;
      const dy = Math.min(maxRad, Math.max(-maxRad, pitch - baseY.value)) / maxRad;
      smoothX.value += (dx - smoothX.value) * TILT_ALPHA;
      smoothY.value += (dy - smoothY.value) * TILT_ALPHA;
      foilTiltX.value = smoothX.value;
      foilTiltY.value = smoothY.value;
    },
  );

  return null;
}

/**
 * Mount once on the pet screen. The sensor exists only while a lease is held,
 * the app is in the foreground, and neither Reduce Motion nor Low effects is on.
 */
export function FinishMotionHost({ reduceMotion }: { reduceMotion: boolean }) {
  const leased = useSyncExternalStore(subscribeFinishLease, finishSensorLeased, finishSensorLeased);
  const fxFull = useFxQuality() === 'full';
  const osReduce = useOsReduceMotion();
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => setAppActive(state === 'active'));
    return () => sub.remove();
  }, []);

  const frozen = reduceMotion || osReduce || !fxFull;
  const wantDrift = leased && appActive && !frozen;
  const wantSensor = wantDrift && finishConfig().tilt === true;

  useEffect(() => {
    if (wantDrift) return;
    cancelAnimation(foilDrift);
    foilDrift.value = 0.35;
    foilTiltX.value = 0;
    foilTiltY.value = 0;
  }, [wantDrift]);

  return (
    <>
      {wantDrift ? <DriftLoop /> : null}
      {wantSensor ? <SensorRunner /> : null}
    </>
  );
}

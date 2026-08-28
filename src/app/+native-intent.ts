import * as Notifications from 'expo-notifications';

import { pathFromNotificationData } from '@/lib/push-copy';

/**
 * Cold-start from a notification or the widget. Returns the in-app path so
 * expo-router lands on Home or the week recap, not the default tab by accident.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  try {
    const response = Notifications.getLastNotificationResponse();
    const url = pathFromNotificationData(response?.notification.request.content.data);
    if (url) return url;
  } catch {
    // Native module missing (web / Expo Go).
  }
  if (path === 'home' || path === '/home') return '/';
  if (/(?:^|\/)(?:theme|around|talk|pixel|crisis|voice|dev)-lab\/?$/.test(path)) return '/';
  return path;
}

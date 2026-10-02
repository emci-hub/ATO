/**
 * Share a rendered view as an image (the share card on Home and You).
 *
 * Both native modules are loaded inside the call, not at the top of the file:
 * if a phone is running a build that predates them, the import fails here and
 * the caller shows "can't share on this build" instead of the app crashing on
 * launch. Nothing leaves the device until the person picks a target in the
 * system share sheet.
 */
import type { RefObject } from 'react';
import type { View } from 'react-native';

export type ShareOutcome = 'shared' | 'unavailable' | 'failed';

export const SHARE_UNAVAILABLE_COPY = 'Sharing isn’t available on this build yet.';
export const SHARE_FAILED_COPY = 'Couldn’t make the image. Try again.';

/** Stories size. The card is laid out at 9:16 and captured at this resolution. */
export const SHARE_IMAGE_WIDTH = 1080;
export const SHARE_IMAGE_HEIGHT = 1920;

export async function shareViewAsImage(ref: RefObject<View | null>): Promise<ShareOutcome> {
  if (!ref.current) return 'failed';
  let captureRef: typeof import('react-native-view-shot').captureRef;
  let Sharing: typeof import('expo-sharing');
  try {
    ({ captureRef } = await import('react-native-view-shot'));
    Sharing = await import('expo-sharing');
    if (!(await Sharing.isAvailableAsync())) return 'unavailable';
  } catch (err) {
    console.log('[share] native module missing:', err);
    return 'unavailable';
  }
  try {
    const uri = await captureRef(ref, {
      format: 'png',
      quality: 1,
      result: 'tmpfile',
      width: SHARE_IMAGE_WIDTH,
      height: SHARE_IMAGE_HEIGHT,
    });
    await Sharing.shareAsync(uri, { mimeType: 'image/png', UTI: 'public.png' });
    return 'shared';
  } catch (err) {
    console.log('[share] capture or share failed:', err);
    return 'failed';
  }
}

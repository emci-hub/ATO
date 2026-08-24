import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import type { RefObject } from 'react';
import type { View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import { publicLink } from '@/lib/share-codec';

/**
 * Share: /@handle is the public link. The QR encodes it, "copy link" copies it,
 * and the native Share sheet hands off a Stories-size (9:16) image of the
 * poster with the caption "What's your ATO?".
 */

export async function copyLink(handle: string): Promise<void> {
  await Clipboard.setStringAsync(publicLink(handle));
}

export interface ShareOutcome {
  shared: boolean;
  /** Set when sharing wasn't possible and the link was copied instead. */
  fellBackToCopy?: boolean;
  error?: string;
}

/**
 * Captures the poster view at Stories size and opens the native share sheet.
 * On web, shares the link via the browser share API (or copies it when that
 * isn't available).
 */
export async function sharePoster(
  posterRef: RefObject<View | null>,
  handle: string,
): Promise<ShareOutcome> {
  const link = publicLink(handle);

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: 'ATO', text: "What's your ATO?", url: link });
      return { shared: true };
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return { shared: false };
      // fall through to capture/copy
    }
  }

  if (!posterRef.current) {
    await Clipboard.setStringAsync(link);
    return { shared: false, fellBackToCopy: true };
  }

  try {
    const uri = await captureRef(posterRef, {
      format: 'png',
      quality: 1,
      result: 'tmpfile',
      // Stories are 9:16; the poster is rendered compact and upscaled here.
      width: 1080,
      height: 1920,
    });

    if (!(await Sharing.isAvailableAsync())) {
      await Clipboard.setStringAsync(link);
      return { shared: false, fellBackToCopy: true };
    }

    await Sharing.shareAsync(uri, {
      mimeType: 'image/png',
      UTI: 'public.png',
      dialogTitle: 'Share your ATO',
    });
    return { shared: true };
  } catch (err) {
    await Clipboard.setStringAsync(link);
    return {
      shared: false,
      fellBackToCopy: true,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

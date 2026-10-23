/**
 * Where each coach tip points (Divecore Phase 4). The controls register themselves with a callback
 * ref (`tipAnchorRef('feed')`); the tip layer measures them in window coordinates. Nothing here
 * changes a layout: a ref on an existing view is all a control gives.
 */
import type { View } from 'react-native';

import type { Rect, TipAnchorId } from '@/play/ftue/coach-tips';

const nodes = new Map<TipAnchorId, View>();
const refs = new Map<TipAnchorId, (node: View | null) => void>();

/** A stable callback ref for an anchor (same function every render, so React never re-calls it). */
export function tipAnchorRef(id: TipAnchorId): (node: View | null) => void {
  let ref = refs.get(id);
  if (!ref) {
    let mine: View | null = null;
    ref = (node) => {
      if (node) {
        mine = node;
        nodes.set(id, node);
      } else {
        // Only drop our own node: a newer instance may already have registered.
        if (nodes.get(id) === mine) nodes.delete(id);
        mine = null;
      }
    };
    refs.set(id, ref);
  }
  return ref;
}

export function measureTipAnchor(id: TipAnchorId, done: (rect: Rect | null) => void): void {
  const node = nodes.get(id);
  if (!node) {
    done(null);
    return;
  }
  node.measureInWindow((x, y, width, height) => {
    done(Number.isFinite(x) && width > 0 && height > 0 ? { x, y, width, height } : null);
  });
}

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  DEFAULT_NAV_ORDER,
  loadNavOrder,
  normalizeNavOrder,
  saveNavOrder,
  type NavOrder,
} from '@/lib/nav/nav-order';

/**
 * Single source of truth for the persisted tab order + edit-mode state.
 * Mounted at the tab shell so both the bar and the edit overlay read the same
 * order, and so a committed reorder persists across restarts.
 */
interface NavContextValue {
  order: NavOrder;
  /** False until the stored order is read (bar must not render a default flash). */
  ready: boolean;
  /** True while the edit-mode overlay is open. */
  editing: boolean;
  startEditing: () => void;
  cancelEditing: () => void;
  commitOrder: (next: NavOrder) => Promise<void>;
}

const NavContext = createContext<NavContextValue>({
  order: DEFAULT_NAV_ORDER,
  ready: false,
  editing: false,
  startEditing: () => {},
  cancelEditing: () => {},
  commitOrder: async () => {},
});

export function NavOrderProvider({ children }: { children: ReactNode }) {
  const [order, setOrder] = useState<NavOrder>(DEFAULT_NAV_ORDER);
  const [ready, setReady] = useState(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadNavOrder().then((stored) => {
      if (cancelled) return;
      setOrder(stored);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const startEditing = useCallback(() => setEditing(true), []);
  const cancelEditing = useCallback(() => setEditing(false), []);

  const commitOrder = useCallback(async (next: NavOrder) => {
    const normalized = normalizeNavOrder(next);
    setOrder(normalized);
    setEditing(false);
    await saveNavOrder(normalized);
  }, []);

  const value = useMemo(
    () => ({ order, ready, editing, startEditing, cancelEditing, commitOrder }),
    [order, ready, editing, startEditing, cancelEditing, commitOrder],
  );

  return <NavContext.Provider value={value}>{children}</NavContext.Provider>;
}

export function useNavOrder(): NavContextValue {
  return useContext(NavContext);
}

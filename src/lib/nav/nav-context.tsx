import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';

import { saveNavLayout } from '@/lib/me';
import { useMeContext } from '@/lib/me-context';
import { DEFAULT_NAV_LAYOUT, type NavLayout } from '@/lib/nav/nav-order';

/**
 * Single source of truth for the per-user tab layout + edit-mode state.
 * Mounted at the tab shell so the bar and the edit overlay read the same
 * layout, and a committed layout persists to `me.nav_layout`.
 */
interface NavContextValue {
  layout: NavLayout;
  /** True while the edit-mode overlay is open. */
  editing: boolean;
  startEditing: () => void;
  cancelEditing: () => void;
  commitLayout: (next: NavLayout) => Promise<void>;
}

const NavContext = createContext<NavContextValue>({
  layout: DEFAULT_NAV_LAYOUT,
  editing: false,
  startEditing: () => {},
  cancelEditing: () => {},
  commitLayout: async () => {},
});

export function NavOrderProvider({ children }: { children: ReactNode }) {
  const { me, refresh } = useMeContext();
  const [editing, setEditing] = useState(false);

  const layout = useMemo(() => me?.nav_layout ?? DEFAULT_NAV_LAYOUT, [me]);

  const startEditing = useCallback(() => setEditing(true), []);
  const cancelEditing = useCallback(() => setEditing(false), []);

  const commitLayout = useCallback(
    async (next: NavLayout) => {
      setEditing(false);
      if (!me) return;
      await saveNavLayout(me.id, next);
      await refresh();
    },
    [me, refresh],
  );

  const value = useMemo(
    () => ({ layout, editing, startEditing, cancelEditing, commitLayout }),
    [layout, editing, startEditing, cancelEditing, commitLayout],
  );

  return <NavContext.Provider value={value}>{children}</NavContext.Provider>;
}

export function useNavOrder(): NavContextValue {
  return useContext(NavContext);
}

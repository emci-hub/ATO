import { createContext, ReactNode, useContext } from 'react';

import { useCircle } from '@/hooks/use-circle';
import { useSession } from '@/hooks/use-session';
import type { Connection } from '@/lib/circle';

/**
 * Single source of truth for the user's circle. The tab bar (to decide whether
 * the Circle tab exists) and the Circle screen (to render peers) both read from
 * here, so there is exactly ONE realtime subscription per user — mounting both
 * components no longer opens two channels with the same topic.
 */
interface CircleContextValue {
  connections: Connection[];
  hasCircle: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
  /** Removes the connection to a peer (both directions) and refreshes. */
  unfriend: (peerId: string) => Promise<void>;
}

const CircleContext = createContext<CircleContextValue>({
  connections: [],
  hasCircle: false,
  loading: false,
  refresh: async () => {},
  unfriend: async () => {},
});

export function CircleProvider({ children }: { children: ReactNode }) {
  const { session } = useSession();
  const circle = useCircle(session?.user.id);

  return <CircleContext.Provider value={circle}>{children}</CircleContext.Provider>;
}

export function useCircleContext(): CircleContextValue {
  return useContext(CircleContext);
}

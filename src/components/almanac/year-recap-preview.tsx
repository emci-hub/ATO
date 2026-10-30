import { useEffect, useState } from 'react';

import { YearRecap } from '@/components/almanac/year-recap';
import { ThemedText } from '@/components/themed-text';
import { useSession } from '@/hooks/use-session';
import { useAlmanacDay } from '@/hooks/use-almanac-day';
import { useMeContext } from '@/lib/me-context';
import type { TraitTrack } from '@/lib/trait-stability';
import { fetchTraitTracks } from '@/lib/trait-tracks-store';

/**
 * Dev Hub only (rendered inside dev-lab's `tools` branch): "Your year in you" on a
 * December date so the date gate is bypassed. Read-only: it reads this account's
 * tracks, picks cards on the phone, and writes nothing.
 */
export function YearRecapPreview() {
  const { session } = useSession();
  const { me } = useMeContext();
  const userId = session?.user.id;
  const [tracks, setTracks] = useState<TraitTrack[]>([]);
  useEffect(() => {
    if (!userId) return;
    let live = true;
    void fetchTraitTracks(userId)
      .then((rows) => live && setTracks(rows))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [userId]);
  const year = new Date().getFullYear();
  const day = useAlmanacDay({ userId, me, ymd: `${year}-12-10`, tracks, dataDays: 30 });
  if (!me || !day) return <ThemedText themeColor="textSecondary">Loading the preview…</ThemedText>;
  return <YearRecap day={day} me={me} preview />;
}

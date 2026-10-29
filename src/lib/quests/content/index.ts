import { LANTERN } from '@/lib/quests/content/lantern';
import { SAMPLE_LANTERN } from '@/lib/quests/content/sample-lantern';
import type { QuestCampaign } from '@/lib/quests/types';

/**
 * Every campaign the validator runs on. The sample stays as the fixture source
 * (broken fixtures, save and apply checks); `isSample` keeps it off players' screens.
 * Content ids must match ^[a-z0-9][a-z0-9_-]{0,63}$ or the server refuses the run.
 */
export const QUEST_CAMPAIGNS: readonly QuestCampaign[] = [LANTERN, SAMPLE_LANTERN];

export const campaignById = (id: string): QuestCampaign | undefined => QUEST_CAMPAIGNS.find((c) => c.id === id);

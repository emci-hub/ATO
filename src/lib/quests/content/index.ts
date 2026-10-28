import { SAMPLE_LANTERN } from '@/lib/quests/content/sample-lantern';
import type { QuestCampaign } from '@/lib/quests/types';

/** Every campaign the validator runs on. PHASE-18 adds `lantern`; samples never ship to players. */
export const QUEST_CAMPAIGNS: readonly QuestCampaign[] = [SAMPLE_LANTERN];

export const campaignById = (id: string): QuestCampaign | undefined => QUEST_CAMPAIGNS.find((c) => c.id === id);

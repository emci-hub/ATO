import { GOING_UNDER_18_MESSAGE } from '@/lib/around/ages';
import { supabase } from '@/lib/supabase';

export type NightFace = {
  id: string;
  name: string;
  handle: string;
  show_up: string;
  recipe: unknown;
};

export type NightSnapshot = {
  going: boolean;
  /** Hues with ≥3 people going. No counts. */
  colors: number[];
  faces: NightFace[];
};

export async function fetchNight(showId: string): Promise<NightSnapshot> {
  const { data, error } = await supabase.rpc('night_snapshot', { p_show_id: showId });
  if (error) throw error;
  const row = data as NightSnapshot | null;
  return {
    going: !!row?.going,
    colors: Array.isArray(row?.colors) ? row.colors.map((h) => Number(h)).filter((h) => Number.isFinite(h)) : [],
    faces: Array.isArray(row?.faces) ? row.faces : [],
  };
}

export async function setGoing(showId: string, ages: string | null, going: boolean): Promise<NightSnapshot> {
  const { data, error } = await supabase.rpc('set_going', {
    p_show_id: showId,
    p_going: going,
    p_ages: ages,
  });
  if (error) {
    const code = (error as { code?: string }).code;
    const message = error.message ?? '';
    if (code === 'P0008' || message.includes('going_under_18')) {
      throw new Error(GOING_UNDER_18_MESSAGE);
    }
    throw error;
  }
  const row = data as NightSnapshot | null;
  return {
    going: !!row?.going,
    colors: Array.isArray(row?.colors) ? row.colors.map((h) => Number(h)).filter((h) => Number.isFinite(h)) : [],
    faces: Array.isArray(row?.faces) ? row.faces : [],
  };
}

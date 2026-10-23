/**
 * Offline draft prompt for Story Library entries. The caller passes the
 * text of docs/voice-guide.md. The model sees the guide and the slot, never
 * a person's answers, name, or id. People still approve. A draft that fails
 * `reviewLibraryVoice` does not enter the approval queue.
 */
export function buildStoryLibraryDraftPrompt(voiceGuide: string): string {
  const guide = voiceGuide.trim();
  if (!guide.includes('Player-facing voice') || !guide.includes('Flip test')) {
    throw new Error('draft prompt requires the voice guide');
  }
  return `${guide}

You draft Story Library entries for ATO. You do not write a card about a real person. You do not see anyone's answers, name, or id.

Follow the voice guide above. Keep adult humor if the sample has it. Do not add a moral. No slang: these lines also render on Legends.

Return JSON only. Each entry is one finished line, not a verb plus an aside. The only tokens are {Subj}, {subj}, {Name}, {legend}, {deed}, and {answer}. {deed} is a short sourced clause about what that real person did. Include a flip: the opposite pole's reaction, not shown to the player. Give the line a priority and the conditions that make it eligible (trait, pole, confidence, a specific answer, a legend, recency). A broad fallback stays in the bank.

A bad line, which you must not imitate: "The untried option gets the first look." Another bad line, which uses a private symbol instead of a scene: "You opened a new ticket when the specials board still had a blank line." A better one: "You had the listing open when the group chat was still stuck on the safe plan."

If you cannot write the whole line, return {"entries":[]} and a one-line reason. Do not force a word in.`;
}

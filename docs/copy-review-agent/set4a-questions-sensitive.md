# Set 4a: sensitive-trait questions (copy review)

Scope: the 22 non-intake questions (04 to 25) for attachment_anxiety, attachment_avoidance, conflict_assertiveness and conflict_cooperativeness. 88 items. Format checked: each item is a short scene plus 2 or 3 written answers scored 0.2 / 0.5 / 0.8 (not agree/disagree), so "scale fit" here means the answers form a clean low / middle / high ladder for the trait. Nothing in `src/` was edited.

## Summary

1. **Counts:** 61 OK, 25 FIX, 2 REMOVE. The bank is mostly in good shape: short, concrete, modern scenes, and no clinical or diagnosis words.
2. **Main pattern (11 of the 25 fixes):** two answers mean nearly the same thing, or the middle answer measures a different trait, so the low / middle / high ladder blurs (AA 17, 19, 21; AV 06, 21; CA 05, 24; CC 08, 23).
3. **Sensitivity:** a few answers score a sensible or safe choice as the "distant" end: refusing location sharing (AV 09), waiting until morning to answer a struggling friend (AV 19), saying sorry only to end a fight (CC 17). Also "spiral" and "situationship" (AA 10) are pop-psych and slang words. Alcohol shows up for a 16+ audience (AV 24).
4. **Small mechanics:** lowercase speech inside quotes (AA 11, 19; CA 23), "comment the facts" (CA 13), and one idiom that reads the opposite way ("let them have it", CA 07). All 400 bank strings, including the approved intake items, use straight apostrophes ('). That needs one global decision rather than 88 item fixes, so no item below is flagged only for it.
5. **Near-duplicates (kept, noted):** AA 06 / 23 / 05 all cover being left out of plans; AV 11 echoes intake AV 02 ("how are you, really?"); CA 06 / 22 both cover borrowing something and returning it worse; CA 25 echoes intake CA 02 (food order wrong). They are spread across different settings, so none needs removing. **Meaning risk:** every replacement keeps the trait and its direction. Items where the wording shift could move what an item measures are marked "(shift risk)". Because answers point at ids, an item marked REMOVE is retired (taken out of rotation), never deleted or reused.

## Flagged items (FIX / REMOVE only)

| id | original | verdict | replacement | reason |
|---|---|---|---|---|
| attachment_anxiety_06 | "You see friends hanging out in a story. You were not invited." | FIX | "Friends post a story hanging out. You weren't invited." | "in a story" is unclear; "were not" is stiff. |
| attachment_anxiety_10 | "Your situationship posts a story but hasn't replied to you." / 0.8 "I spiral a little" | FIX | "Someone you're casually seeing posts a story but hasn't replied to you." / 0.8 "I overthink it a little" | "situationship" is slang that will date. "spiral" is pop-psych and mental-health adjacent. |
| attachment_anxiety_11 | 'Your sister answers your call with "can I call you back?"' | FIX | 'Your sister answers your call with "Can I call you back?"' | Capitalise the quoted speech. |
| attachment_anxiety_12 | "Your family group chat goes on without you replying for a week." | FIX | "You haven't replied in the family group chat for a week." | The original is clumsy and hard to read on first pass. Same scene. |
| attachment_anxiety_13 | "In bed, you replay a conversation from earlier today." / 0.2 "I'm asleep already" | FIX | "In bed, a conversation from earlier today pops into your head." (answers unchanged) | The prompt says you already replay it, which contradicts the low answer. |
| attachment_anxiety_17 | 0.5 "I mention it lightly" / 0.2 "They will pay when they can" | FIX | 0.5 "It crosses my mind now and then" / 0.2 "They'll pay when they can" | The middle answer measures speaking up (assertiveness), not worry. Also add a contraction. |
| attachment_anxiety_19 | 'Your best friend says "we need to talk later."' / 0.5 "I wonder, but I wait" / 0.2 "Could be anything, I wait" | FIX | '…says "We need to talk later."' / 0.2 "Could be anything, I don't dwell on it" | Capitalise the quote. The 0.5 and 0.2 answers are nearly identical. |
| attachment_anxiety_21 | 0.5 "Fine, as long as they text" / 0.8 "I feel a little left out" | FIX | 0.5 "A small pang, then fine" / 0.8 "I feel left out and want updates" | The ladder is upside down: needing texts all night reads as more anxious than "a little left out". (shift risk: low) |
| attachment_anxiety_22 | "A meeting invite from HR appears for tomorrow, no agenda." | REMOVE | (retire the id) | This measures general work worry (closer to steadiness), not worry about a relationship. It also near-duplicates AA 04 (the boss's "ok"). |
| attachment_avoidance_06 | 0.5 "I share a little more" / 0.2 "Fair, I open up more" | FIX | 0.5 "I share a bit, slowly" / 0.2 "Fair, I ask what they want to know" | The two answers are near-duplicates, so the middle step disappears. |
| attachment_avoidance_09 | "Your partner wants to share locations on your phones." | REMOVE | (retire the id) | Saying no scores as "distant", but turning down location tracking is a normal privacy and safety choice, especially for 16 to 20 year olds. A partner pushing for tracking can be a controlling sign, so the app should not imply that refusing is the cold answer. |
| attachment_avoidance_17 | 0.2 "Thank you, I accept" | FIX | 0.2 "I say thanks and let them" | Stiff and formal, not how people text. |
| attachment_avoidance_18 | 0.2 "Yes please" | FIX | 0.2 "Yes, please" | Punctuation. |
| attachment_avoidance_19 | "A friend going through a hard time texts you at midnight." / 0.8 "I reply in the morning" | FIX | 'A friend texts at midnight: "you up? long day."' (answers unchanged) | As written, the distant answer reads like leaving a friend alone in a crisis. That is guilt-framing, and the app no longer has a crisis path. A non-urgent late text still measures closeness. (shift risk: low) |
| attachment_avoidance_21 | 0.2 "I tell them me too" | FIX | 0.2 "I'm glad, and I tell them how I feel" | The original assumes the reader feels the same back. Being open about feelings is the trait. Reciprocating is not. |
| attachment_avoidance_23 | 0.8 "I suggest a hotel" | FIX | 0.8 "I say a week is too long" | A hotel is unrealistic for young adults and reads colder than intended. |
| attachment_avoidance_24 | "A coworker asks to grab a drink and get to know you." / 0.5 "Maybe a coffee" | FIX | "A coworker asks to hang out after work and get to know you." / 0.5 "Maybe a quick coffee" | Alcohol does not fit a 16+ audience. Same meaning. |
| conflict_assertiveness_05 | 0.5 "I message them privately" / 0.8 "I call it out in the group chat" | FIX | 0.5 "I drop a hint in the group chat" / 0.8 "I tell them straight to do their part" | The original makes "most direct" mean publicly calling someone out. A private message is already direct. (shift risk: moderate; the high answer moves from public to direct) |
| conflict_assertiveness_07 | 0.2 "I let them have it" | FIX | 0.2 "I let them tell it their way" | "Let them have it" commonly means "scold them hard", the opposite of the 0.2 meaning. |
| conflict_assertiveness_10 | "A relative gives unasked-for opinions about your life at dinner." | FIX | "At dinner, a relative shares opinions about your life you didn't ask for." | "unasked-for" is clunky. |
| conflict_assertiveness_13 | 0.8 "I comment the facts" / 0.5 "I share a correction to my story" | FIX | 0.8 "I comment with the facts" / 0.5 "I post a correction on my story" | Grammar. |
| conflict_assertiveness_23 | 0.8 'I say "let me finish"' | FIX | 0.8 'I say, "Let me finish."' | Capitalise and punctuate the quote. |
| conflict_assertiveness_24 | 0.5 'I send a "hey, not cool"' / 0.8 "I tell them that wasn't okay" | FIX | 0.5 "I hint that it bugged me" | The 0.5 and 0.8 answers say the same thing, equally directly. |
| conflict_cooperativeness_06 | 0.8 "I look for a spot that fits all" | FIX | 0.8 "I look for a spot that works for everyone" | Reads unnaturally. |
| conflict_cooperativeness_08 | 0.2 "I stay in, they go out" | FIX | 0.2 "I make the case for staying in" | Each doing their own thing is already a compromise, so it does not work as the low end ("what I need"). (shift risk: low) |
| conflict_cooperativeness_17 | 0.8 "I say sorry first to end it" | FIX | 0.8 "I say sorry for my part first" | The original rewards saying sorry just to make it stop. Reaching out first is the trait. |
| conflict_cooperativeness_23 | 0.5 "Whoever grabbed first" / 0.2 "I got it first" / 0.8 "We split it or I let it go" | FIX | 0.2 "I keep it, I saw it first" / 0.5 "Whoever got there first" / 0.8 "I ask if we can split it" | 0.5 and 0.2 are near-duplicates. 0.8 asks two things at once (split it, or let it go). |

## Spot-check: 8 items judged OK

- **attachment_anxiety_08**: "Your partner is out with friends and hasn't texted all night." / "I text to check in, twice". A concrete, gently teasing answer and a clean ladder.
- **attachment_anxiety_24**: "Your phone has been quiet all evening." / "I check if it's on silent". The moment voice at its best.
- **attachment_avoidance_10**: "Your partner leaves a toothbrush at your place." / "Fine, one toothbrush". Light and kind to both ends.
- **attachment_avoidance_13**: "A rough day, and you get home to an empty room." / "Alone is how I recover" (high). The high end is framed as a real way to cope, not a flaw.
- **conflict_assertiveness_16**: "Your landlord ignores your texts about a broken heater." Formal email / firmer text / space heater make a clear three-step ladder.
- **conflict_assertiveness_20**: "The group chat keeps picking the place you like least." Go along / suggest / veto. Clean, with no blame.
- **conflict_cooperativeness_14**: "Your gaming squad argues about which game to play tonight." Modern setting, and the middle answer (majority vote) sits squarely in the middle.
- **conflict_cooperativeness_25**: "The group chat argues about the date for a reunion." / "I make a poll in the chat". Natural, recognizable, kind to both ends.

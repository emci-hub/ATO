# Set 8 — Legends museum copy and fact review (2026-10-19)

Scope: all 120 entries in `src/lib/legend-figures/roster/*.ts` (mirrored in `docs/legend-figures-review.md`). Read-only review; no source edited. Fact checks are from the reviewer's own knowledge, not a fresh web pass.

## Summary

- **Verdicts:** 73 OK · 47 FIX · 0 REMOVE. No living people are on the roster (latest death is 2005), and nobody needs removing.
- **Facts:** 6 WRONG or overclaimed. Ashe's "every surface" (all three of his Slam titles were on grass), Gagarin "Russia" (it was the USSR), Tesla's birthplace (the Austrian Empire, not yet Austria-Hungary), Gutenberg "invented movable type" (true only for Europe), Murasaki's era/died mismatch, and the garbled Leprechaun tale. 8 more are UNSURE. Everything else checks out. Curly apostrophes are clean throughout.
- **Riskiest pattern 1:** attachment and locus-of-control tags put on real people as if they were diagnoses, often using the idea wrongly. Rescue and courage get read as "attachment anxiety" (Tubman, Sojourner Truth, Nightingale). Building something gets read as "low locus of control" (Braille, Korematsu, Cervantes). Suggested rule: no `attachment_*` tag on a real person.
- **Riskiest pattern 2:** "low" tags blamed on the person for things that were really caused by racism, sexism or the customs of the time. Examples: Henson's missing credit, Anning's exclusion, Austen's anonymity, Murasaki's unknown name.
- **Riskiest pattern 3:** closeness to mental health. Rachmaninoff ("heavily depressed", four low tags) and Beethoven. There are also a few overclaims: Lamarr leading to Wi-Fi, Apgar for "every newborn", Blackwell as "first woman doctor".

## FIX / UNSURE items

| Legend | Field | Original | Verdict | Replacement | Reason |
|---|---|---|---|---|---|
| Ibn al-Haytham | moment m2 | During that time he wrote his Book of Optics. | FIX (UNSURE) | As the story goes, he wrote much of his Book of Optics during that time. | Historians dispute when the Optics was written; m1 already hedges, m2 doesn't. |
| Srinivasa Ramanujan | tag conscientiousness low | skipped the usual steps | FIX | tag openness high is enough; drop, or: conscientiousness low, “results first, proofs later” / “He often wrote down results without the formal proofs.” | As written it reads as lazy; he worked obsessively. |
| Johannes Gutenberg | fact f1 | He invented the movable-type printing press. | FIX (WRONG/overclaim) | He introduced movable-type printing to Europe. | Movable type existed earlier in China and Korea. |
| Johannes Gutenberg | tag competence low | a failed business first | FIX | Drop the tag (growth_mindset high already covers the flop). | Calls a master craftsman incompetent because of one venture that failed for outside reasons (the pilgrimage was postponed). |
| Nikola Tesla | place | Austro-Hungarian Empire and the United States | FIX (WRONG) | Austrian Empire (now Croatia) and the United States | Austria-Hungary formed in 1867; he was born in 1856. |
| Nikola Tesla | tag attachment_avoidance high | kept people at a distance | FIX | Drop it (relatedness low already says it). | Attachment label on a real person, based only on hotel living. |
| Mary Anning | tag conflict_assertiveness low | let the fossils speak / “She often did not receive full credit for her work.” | FIX | Drop it. | The lack of credit came from sexism, not her trait. Her letters show she resented it openly. |
| Mary Anning | tag openness low | stayed by her home coast | FIX | Drop it. | Unfair for a self-taught pioneer of a new science. |
| Frida Kahlo | tag agreeableness low | painted herself honestly | FIX | Drop it. | Honesty is not low agreeableness, and the "why" doesn't support it. |
| Georgia O’Keeffe | tag growth_mindset low | settled in New Mexico | FIX | Drop it. | Living in one place is not a fixed mindset, and her style changed for 70 years. |
| Tove Jansson | tags attachment_avoidance high, growth_mindset low | kept a private island life / the same island each summer | FIX | Drop both. | She had a lifelong partner (named in m2), and she worked in many forms. Both readings are stretches. |
| Amelia Earhart | essence | Flew the Atlantic alone because nobody said she couldn’t. | FIX | Crossed the Atlantic as a passenger, then flew it alone. | Made-up motive. |
| Amelia Earhart | tag attachment_avoidance high | needed her own space | FIX | Drop it (autonomy high “kept her own controls” covers it). | Reads her marriage through an attachment label. |
| Tenzing Norgay | tags conflict_assertiveness low, autonomy low | did the work, quietly / worked within the team plan | FIX | Replace with: conscientiousness high, “twenty years of climbing” / “He joined Everest expeditions for nearly two decades before the summit.” | Shrinks a Sherpa to a porter on "other people's expeditions". The colonial framing is a sensitivity risk. |
| Matthew Henson | angle a1 teaser | an explorer who reached the pole first, and waited for credit | FIX | an explorer who said he reached the pole first, and waited decades for credit | Whether anyone reached the pole in 1909 is disputed; m1 already hedges. |
| Matthew Henson | tag conflict_assertiveness low | did the work, quietly / “He got little credit for decades.” | FIX | Drop it. | The missing credit came from racism, not his trait. He wrote a 1912 memoir that claimed his role. |
| Matthew Henson | moment m2 | known as the expedition’s “first man” | UNSURE | …served as navigator and craftsman. (cut the quote) | Can't confirm the source phrasing; the check only verifies "navigator and craftsman". |
| Yuri Gagarin | place | Russia | FIX (WRONG) | Soviet Union (now Russia) | He flew for the USSR. |
| Harriet Tubman | tag attachment_anxiety high | went back for everyone | FIX | Drop it. | Treats heroic rescue as anxious attachment, which is wrong and unkind. |
| Rosa Parks | angle a4 | What does it take to stand firm when you’re tired? | FIX | What does it take to stand firm on an ordinary evening? / Holding your ground doesn’t need a speech, just steadiness. | Feeds the "she was just tired" myth, which Parks herself rejected. |
| Rosa Parks | tag conflict_assertiveness low | brave without a speech | FIX | Drop it (steadiness high covers the quiet). | Refusing segregation is assertive; she was also a long-time NAACP activist. |
| Rosa Parks | fact f3 | From 1954 she worked as a seamstress. | UNSURE | She worked as a seamstress in Montgomery. | Can't confirm the start year. |
| Sojourner Truth | tag attachment_anxiety high | fought to get her son back | FIX | Drop it (attachment_avoidance low already says the same). | Calls a mother's legal fight for her enslaved child "anxious". |
| Chiune Sugihara | tag conflict_assertiveness low | quiet, steady courage | FIX | conflict_assertiveness high, “went against orders” / “He kept issuing visas after his government said no.” | He defied orders; "low" misreads it. |
| Louis Braille | tag locus_of_control low | took what happened and built | FIX | Drop it. | Low locus of control means feeling powerless, which contradicts the "why". |
| Ida B. Wells | tag locus_of_control `them` | built the NAACP | FIX | helped found the NAACP | She was one of several founders. |
| Fred Korematsu | tag locus_of_control low | waited for the courts | FIX | Drop it. | He actively fought to reopen his case; "fate in others’ hands" undercuts him. |
| Florence Nightingale | tag attachment_anxiety high | checked every ward at night | FIX | Drop it. | Night rounds were duty, not attachment anxiety. |
| Alexander Fleming | tag locus_of_control low | found it by chance | FIX | Drop it. | Misuses the idea; competence high already credits him for noticing. |
| Elizabeth Blackwell | essence | …then became America’s first woman doctor. | FIX | …then became the first woman to earn a medical degree in the US. | Women practised medicine in the US before her; the degree is the true first. |
| Virginia Apgar | essence | Invented a one-minute check that every newborn still gets. | FIX | Invented a one-minute check that nearly every newborn still gets. | Overclaim (her angle a2 already says "almost"). |
| Ludwig van Beethoven | tag attachment_avoidance high | kept to himself | FIX | Drop it. | Attachment label built on his deafness. |
| Sergei Rachmaninoff | tag steadiness low (why) | The failed premiere left him heavily depressed for a time. | FIX | The failed premiere hit him hard, and for a while he couldn’t write. | Clinical wording, which goes against the entry's own vetting note ("no clinical detail"). |
| Sergei Rachmaninoff | tags attachment_anxiety high, competence low | felt every reaction / doubted his own skill | FIX | Drop both (keep steadiness low, self_efficacy low, growth_mindset high). | Four "low" tags pile onto one dark period of a real person's life. |
| Wolfgang Amadeus Mozart | tag conscientiousness low | followed his own rhythm / quarrelled with employers | FIX | Drop it (agreeableness low covers the quarrels). | He wrote 800+ works; the "why" doesn't support low conscientiousness. |
| Ella Fitzgerald | tag extraversion low (why) | She was intimidated on stage at her first Amateur Night. | FIX | She was famously shy off stage. | One night of nerves is not introversion; her shyness is well documented. |
| Frédéric Chopin | tag growth_mindset low | stayed with the piano | FIX | Drop it. | He invented a new form; focus is not a fixed mindset. |
| Jim Henson | fact f3 | He directed The Dark Crystal and Labyrinth. | FIX | He co-directed The Dark Crystal (with Frank Oz) and directed Labyrinth. | Accuracy. |
| Hedy Lamarr | essence | A movie star whose invention helped lead to Wi-Fi. | FIX | A movie star who co-invented an idea later used in wireless tech. | Overclaim; her own fact f2 is properly hedged. |
| Hedy Lamarr | tag relatedness low | tinkered on her own time | FIX | Drop it. | She invented with a partner (Antheil), as angle a3 says. |
| Audrey Hepburn | moment m2 | performing ballet to raise money for the resistance | UNSURE, keep | — | Wikipedia states it, but some biographers question it. Fine to keep as sourced. |
| Fanny Blankers-Koen | tag self_efficacy low | nearly didn’t run | FIX | Drop it (steadiness low covers the moment). | Two low tags from one wobble, for a four-gold champion. |
| Jim Thorpe | tag locus_of_control low | the officials decided | FIX | Drop it. | What officials did is not his trait. Also consider adding to m1: “and in 2022 he was named sole champion of both events.” |
| Arthur Ashe | tag competence | won on every surface / “He won singles at three different Grand Slams.” | FIX (WRONG) | won the big three / “He won singles titles at Wimbledon, the US Open and the Australian Open.” | All three of his Slam singles titles were on grass. |
| Arthur Ashe | angle a4 | three different courts / Why win on grass, hard court and more? | FIX (WRONG) | three different Slams / Why win at three different Grand Slams? | Same error. |
| Emil Zátopek | tag conscientiousness low | decided at the last minute | FIX | conscientiousness high, “trained famously hard” / “He was known for punishing interval training.” | He was one of the hardest trainers in the sport's history. |
| Ryōkan | tag self_efficacy low | refused the title of poet | FIX | Drop it. | Humility is not low self-belief. |
| Hans Christian Andersen | tag competence low | the acting plan didn’t work | FIX | Drop it. | Unkind for a master writer; growth_mindset high already tells the pivot. |
| Murasaki Shikibu | era / died | era “c. 973–c. 1014”, died: 1025 | FIX (WRONG) | era “c. 973–c. 1014 or 1025”, keep died 1025 (or set both to 1014). | The fields contradict each other. |
| Murasaki Shikibu | tag attachment_avoidance high | kept her own name private / “Even her real name is unknown.” | FIX | Drop it. | Her name is lost because Heian records didn't keep women's personal names; it wasn't her choice. |
| Jane Austen | tag self_efficacy low | published as “A Lady” | FIX | Drop it (conflict_assertiveness low already covers the anonymity). | Anonymous publishing was the convention for women writers then. |
| Miguel de Cervantes | tag locus_of_control low | took fate as it came | FIX | Drop it. | He tried to escape captivity four times, which is the opposite of passive. |
| Jules Verne | tag self_efficacy low | travelled from his desk | FIX | Drop it. | Not accurate: he sailed his own yachts and crossed the Atlantic. |
| Emily Dickinson | tag openness low | stayed close to home | FIX | Drop it. | One of the most original poets in English; staying home is not low openness. |
| Emily Dickinson | tag attachment_avoidance high | kept her poems private | FIX | Drop it. | She sent hundreds of poems to friends in letters. |
| Astrid Lindgren | fact f2 | Pippi Longstocking has been translated into at least 100 languages. | UNSURE | Her books have been translated into more than 100 languages. | Can't confirm the figure is for Pippi alone. |
| Umm Kulthum | era | 1904–1975 | UNSURE, keep | — | Her birth year is disputed (some sources say 1898); no birthday is shown, so the risk is low. |
| Elizabeth Garrett Anderson | moment m2 | …before being admitted in 1862. | UNSURE | …before the Society of Apothecaries admitted her. | Can't confirm the year (she got her licence in 1865). |
| The Banshee | fact f3 | She wears a grey cloak over a green dress. | FIX | In some tellings she wears a grey cloak over a green dress. | One regional description, stated as fixed fact. |
| The Loch Ness Monster | moment m1 | The 1934 “surgeon’s photograph” is perhaps the most famous alleged photo of the creature. | FIX | The famous 1934 “surgeon’s photograph” was revealed as a hoax sixty years later. | Leaving out the 1994 hoax confession misleads. |
| The Leprechaun | moment m1 | …a man captures his captors, who grant him three wishes for their release. | FIX (WRONG) | In an early medieval tale, a king grabs three water sprites who tried to drag him into the sea, and they grant him three wishes to let them go. | The original is garbled and doesn't make sense. |
| Togo | fact f2 | His name, Cugu, means puppy in the Northern Sami language. | UNSURE | Drop it, or: He was named after the Japanese admiral Tōgō Heihachirō. | The admiral origin is the commonly given one; can't confirm the Sami claim. |
| Greyfriars Bobby | moment m1 | He spent the rest of his life sitting on his master’s grave… | FIX | As the story goes, he spent the rest of his life by his master’s grave in Greyfriars Kirkyard. | Contradicts fact f3 ("accuracy is disputed"). |
| John Henry | tag growth_mindset low | did it the old way | FIX | Drop it. | He is a symbol of Black workers' dignity, and reading him as a "fixed mindset" misses that. |

## 8 spot-check OK legends

- **Marie Curie:** dates, polonium/radium, two Nobels, mobile X-ray units and Pierre's 1906 street accident are all correct; the tags are fair.
- **Ada Lovelace:** Note G, Bernoulli numbers, "poetical science" and "Analyst (& Metaphysician)" are correct.
- **Katsushika Hokusai:** thirty-plus names, Manga at 51 and the "nothing before seventy" quote are correct; the growth lens fits well.
- **Ernest Shackleton:** Endurance sank in 1915, Elephant Island, and the ~1,330 km lifeboat voyage (720 nautical miles) are correct.
- **Roald Amundsen:** 14 Dec 1911, Northwest Passage 1903–06, Norge 1926 and the Netsilik skills are correct.
- **Clara Schumann:** 61-year career, married in 1840, eight children, and the 100 DM note 1989–2002 are correct.
- **Satyajit Ray:** 11 prizes for Pather Panchali, 36 films, and the honorary Oscar Hepburn presented by video 24 days before he died are correct.
- **Secretariat:** first Triple Crown in 25 years, won the Belmont by 31 lengths, records in all three races still stand, and he finished fourth in his debut. All correct.

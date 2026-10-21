# Set 8 — Legends: fact check and copy fixes applied (2026-10-19)

1. All 777 source phrases in the roster were re-checked against freshly downloaded Wikipedia text (`scripts/legend-roster-verify.ts`, all found). Every claim the old review marked WRONG or UNSURE was also checked by web search against non-Wikipedia sources; 31 fact or wording items were corrected to the source, in the careful form.
2. Trait tags: 39 tags dropped and 12 rewritten because they blamed people for discrimination, read as a diagnosis, or misused a trait. To keep the `check:legend-roster` coverage gate green (every trait side on 8+ visible legends, every hall on 4+ low sides), 24 tags were added and 15 myth or animal tags were swapped to a needed side. Real people got a new tag only where a cited source documents the behaviour.
3. Checks: typecheck, lint, `check:legends`, `check:legends64` and the verify script all pass. `check:legend-roster` passes every roster, coverage and hall group. It now stops at one joke fixture that went stale with the lead's `card-joke.ts` change (see U5). `check:ai-library` fails only on the stale bundle, as expected.

Sources key: **WP** = the cited English Wikipedia page (phrase re-verified 2026-10-19). Britannica returned 403 to the fetcher, so non-Wikipedia confirmation comes from the URLs listed.

## Facts and wording

| Legend | Field | Action | Final text | Source | What it fixes |
|---|---|---|---|---|---|
| Arthur Ashe | tag competence | FIX | won the big three / He won singles titles at Wimbledon, the US Open and the Australian Open. | https://npg.si.edu/blog/1968-us-open-arthur-ashe ; WP | fact: all three Slam wins were on grass, so "every surface" was wrong |
| Arthur Ashe | angle a4 | FIX | three different Slams / Why win at three different Grand Slams? / Adapting to new places and crowds keeps you winning. | as above | fact |
| Yuri Gagarin | place | FIX | Soviet Union (now Russia) | WP (Soviet pilot and cosmonaut) | fact: he flew for the USSR |
| Nikola Tesla | place | FIX | Austrian Empire (now Croatia) and the United States | WP (born 1856 in Smiljan, Austrian Empire) | fact: Austria-Hungary was formed in 1867 |
| Johannes Gutenberg | f1 + famousFor | FIX | He introduced movable-type printing to Europe; movable type was already in use in East Asia. / Bringing movable-type printing to Europe, and the Gutenberg Bible. | WP ("Though movable type was already in use in East Asia") | fact: overclaim of "invented" |
| Murasaki Shikibu | died / vetting | FIX | era c. 973–c. 1014, died 1014; vetting notes 1025/1031 as minority views | WP; https://www.newworldencyclopedia.org/entry/Murasaki_Shikibu | fact: the era and death fields contradicted each other |
| Ibn al-Haytham | m2 | FIX | Some accounts say he wrote much of his Book of Optics during that time. | WP ("legend has it"); https://www.newworldencyclopedia.org/entry/Ibn_al-Haytham | fact: the confinement story is hearsay, now hedged like m1 |
| Ibn al-Haytham | tag relatedness why | FIX | His most famous book is said to have been written while he was kept apart. | as above | fact: same hedge |
| Hedy Lamarr | essence | FIX | A movie star who co-patented a radio idea now used in Bluetooth. | WP; https://www.americanscientist.org/node/4381 | fact: "helped lead to Wi-Fi" overclaims; operational systems were developed independently |
| Hedy Lamarr | m2 | FIX | Their patent was an early example of frequency hopping, which later became part of spread spectrum radio. | as above | fact: "became foundational" overclaims |
| Jim Henson | f3 | FIX | He co-directed The Dark Crystal with Frank Oz, and directed Labyrinth. | WP ("co-directed The Dark Crystal (1982) with Oz") | fact |
| Audrey Hepburn | m2 | FIX | As a teenager in the war, she gave silent dance performances that reportedly raised money for the Dutch resistance. | WP (2016 Airborne Museum note); https://www.pressreader.com/new-zealand/nelson-mail/20190413/281818580216316 | fact: the details are disputed, so the claim is hedged rather than dropped |
| Amelia Earhart | essence | FIX | Crossed the Atlantic as a passenger, then flew it alone. | WP | fact: the motive ("nobody said she couldn't") was made up |
| Amelia Earhart | m1 source | FIX | (text kept) check phrase is now "first successful transatlantic flight by a woman" | WP | the old phrase is gone from the current page |
| Tenzing Norgay | essence, a1 name | FIX | Climbed toward Everest for nearly twenty years before standing on top. / nearly twenty years of climbing | WP (first expedition 1935, summit 1953) | fact: 18 years, not 20 |
| Matthew Henson | a1 teaser | FIX | What does an explorer who said he reached the pole first, and waited decades for credit, have in common with you? | WP; https://unwritten-record.blogs.archives.gov/?p=32381 | fact: the 1909 claim is disputed (m1 already hedges) |
| Matthew Henson | m2 | FIX | He served as navigator and craftsman, and was known as Peary's "first man". | WP ("known as Peary's 'first man'"); https://smsc.library.csmd.edu/agents/people/433 | fact: the quote is now attributed to Peary |
| Jesse Owens | f2 | FIX | His four golds came in the 100 m, the 200 m, the long jump and the 4 × 100 m relay. | WP; https://library.osu.edu/site/jesseowens/1936-olympics/ | fact: the 100 m equalled the record rather than setting a new one |
| Jesse Owens | tag competence | FIX | four events, four golds / He won every event he entered at the 1936 Games. | as above | same |
| Jim Thorpe | m1 | FIX | His Olympic titles were taken away over amateur rules. The IOC restored them in 1982, and in 2022 named him sole champion of both events. | WP; https://www.worldathletics.org/heritage/news/jim-thorpe-sole-decathlon-pentathlon-winner-1912-olympics | fact: 1982 decision, 1983 replica medals, 2022 sole champion |
| Emil Zátopek | tag conscientiousness | FIX | high: trained famously hard / He was known for brutally tough training and helped make interval training popular. | WP | fact plus meaning: the "low, last minute" tag contradicted his record |
| Elizabeth Blackwell | essence | FIX | Admitted as a joke; became the first woman with a US medical degree. | WP; https://www.history.com/this-day-in-history/january-23/elizabeth-blackwell-becomes-first-woman-to-receive-medical-degree | fact: women practised medicine in the US before her; the degree is the true first |
| Virginia Apgar | essence | FIX | Invented a one-minute newborn check that hospitals worldwide still use. | https://profiles.nlm.nih.gov/101584647X152 | fact: "every newborn" overclaimed |
| Elizabeth Garrett Anderson | m2 | FIX | She studied privately for a certificate in anatomy and physiology, and in 1865 passed the Society of Apothecaries' exam. | WP; https://www.londonmuseum.org.uk/collections/london-stories/elizabeth-garrett-anderson/ | fact: only WP gives "admitted in 1862"; the 1865 licence is well supported |
| Mary Seacole | f2 | FIX | Her 1857 autobiography is described as the first written by a Black woman in Britain. | WP; https://londonmuseum.org.uk/collections/v/object-547704/wonderful-adventures-of-mrs-seacole-in-many-lands | careful form (some sources say "one of the earliest") |
| Rosa Parks | f3 | FIX | In 1955 she worked as a seamstress at the Montgomery Fair department store. | WP ("Montgomery Fair, where she worked as a seamstress") | fact: "from 1954" referred to a different job |
| Rosa Parks | a4 teaser | FIX | What does it take to keep your seat when everyone expects you to move? | https://www.biography.com/activists/rosa-parks-quotes ("the only tired I was, was tired of giving in") | meaning: removes the "she was just tired" myth Parks rejected |
| Astrid Lindgren | f2, a3 name | FIX | By 2012 her books had been translated into 95 languages or variants. / around the world | WP; https://www.astridlindgren.com/en/astrid-worldwide (Pippi alone: 80) | fact: "Pippi in 100+ languages" conflicts with the publisher's figure of 80 |
| Umm Kulthum | era / vetting | FIX | c. 1904–1975; vetting notes the birth year is disputed (1898 or 1904) | https://www.aljadid.com/node/2463 | careful form |
| Togo | f2 | FIX | He was named after the Japanese admiral Tōgō Heihachirō. | WP; https://www.nps.gov/people/togo.htm | fact: the admiral origin is confirmed; "Cugu" is Wikipedia-only |
| Greyfriars Bobby | m1 | FIX | As the story goes, he spent the rest of his life by his master's grave in Greyfriars Kirkyard. | WP; https://www.nbcnews.com/id/wbna44023814 | fact: the story is disputed (f3 already says so) |
| The Loch Ness Monster | m1 | FIX | The famous 1934 "surgeon's photograph" is now widely agreed to be a hoax, exposed in 1994. | WP; https://hoaxes.org/nessie.html | fact: leaving out the hoax misled |
| The Leprechaun | m1 | FIX | In the oldest known tale, sprites drag a sleeping king toward the sea; he wakes, catches three of them, and they grant him three wishes to go free. | WP (Echtra Fergus mac Léti); https://www.worldhistory.org/Leprechaun/ | fact plus unclear: the old line was garbled |
| The Banshee | f3 | FIX | In some tellings she wears a grey cloak over a green dress. | WP ("She may be dressed in…") | fact: one regional description had been stated as fixed |
| Tove Jansson | m2 | FIX | Later she and her partner spent their summers on the tiny island of Klovharu. | WP | unclear: "filmed for hours of home footage" read awkwardly |
| Sergei Rachmaninoff | tag steadiness why | FIX | The failed premiere hit him hard, and for a while he couldn't write. | WP | clinical wording ("heavily depressed") went against the entry's own vetting note |
| Ella Fitzgerald | tag extraversion | FIX | shy off stage / She was famously shy away from the microphone. | WP ("Fitzgerald was notoriously shy") | meaning: one night of nerves is not introversion |
| Ida B. Wells | tag locus them | FIX | helped found the NAACP | WP | fact: she was one of several founders |
| Srinivasa Ramanujan | tag conscientiousness | FIX | results first, proofs later / He often wrote down results without the formal proofs. | WP (Hardy asked to "see proofs of some of your assertions") | meaning: "skipped the usual steps" read as lazy. The axis is kept because his hidden-legend unlock needs it |
| Duke Kahanamoku | f2 (1914 Freshwater) | KEEP | — | https://surfresearch.com.au/1914_Duke_Notes.html (24 Dec 1914 best supported) | checked; the plaque gives 1915 but press reports support 1914 |
| Arthur Ashe f1 (two doubles), Shackleton, Amundsen, Curie, Lovelace, Hokusai, Clara Schumann, Satyajit Ray, Secretariat, Ibn Battuta, Bird, Bly, Cousteau, Bach, Owens m1/m2, Blankers-Koen, Didrikson, Rudolph, Ruth, Clemente, Sugihara, Douglass, Truth, Addams, Bethune, Braille, Korematsu, Nightingale, Fleming, Barton, Drew, Avicenna, Dix, Tagore, Bashō, Cervantes, Verne, Dickinson, Andersen, Austen (a1 "thirteen years" = 22→35, matches WP) | all date/number/"first" claims | KEEP | unchanged | WP phrase re-verified 2026-10-19 | checked; no conflict found in the web results consulted |

## Trait tags

### Removed or replaced
| Legend | Tag | Action | Why |
|---|---|---|---|
| Henson (Matthew) | conflict_assertiveness low; autonomy low "navigator on the team" | FIX (both dropped; autonomy low re-added with a neutral, sourced why below) | blamed him for credit that was withheld by others (racism) |
| Mary Anning | conflict_assertiveness low; openness low | FIX (dropped) | missing credit came from sexism; a self-taught pioneer is not "low openness" |
| Jane Austen | self_efficacy low; conflict_assertiveness low | FIX (dropped) | anonymous publishing was the convention for women writers of her day |
| Murasaki Shikibu | attachment_avoidance high | FIX (dropped) | her name is lost because Heian records didn't keep women's names; it wasn't her choice |
| Tenzing Norgay | conflict_assertiveness low; autonomy low | FIX → conscientiousness high: nearly twenty years of climbing / He joined Everest expeditions for nearly two decades before the summit. | "quiet porter on other people's expeditions" framing |
| Sergei Rachmaninoff | attachment_anxiety high; competence low | FIX (dropped) | four lows piled onto one period of his life; attachment label |
| Tesla (old attachment_avoidance "hotel living"), Tubman, Sojourner Truth, Nightingale, Beethoven, Tove Jansson, Jane Addams (attachment_anxiety low), Hepburn (attachment_anxiety low), Duke Kahanamoku (attachment_anxiety low), Emily Dickinson (old "kept her poems private") | attachment_* | FIX (dropped) | attachment label not supported by the record (rescue, duty, deafness, or thin evidence) |
| Gutenberg, Andersen | competence low | FIX (dropped) | unkind and unsupported (the venture failed for outside reasons; the acting pivot is already covered by growth high) |
| Braille, Korematsu, Fleming, Thorpe, Cervantes | locus_of_control low | FIX (dropped) | misused the idea: these are actions others took, or he fought back |
| Kahlo | agreeableness low | FIX (dropped) | honesty is not low agreeableness |
| O'Keeffe, Chopin, Tove Jansson, John Henry | growth_mindset low | FIX (dropped) | staying in one place or form is not a fixed mindset; John Henry stands for workers' dignity |
| Mozart | conscientiousness low | FIX (dropped) | 800+ works; agreeableness low already covers the quarrels |
| Ryōkan, Verne, Blankers-Koen | self_efficacy low | FIX (dropped) | humility, a false "never travelled" claim, one wobble before winning four golds |
| Emily Dickinson | openness low | FIX (dropped) | one of the most original poets in English |
| Rosa Parks | conflict_assertiveness low | FIX (dropped) | refusing segregation is assertive |
| Chiune Sugihara | conflict_assertiveness low | FIX → high: went against orders / He kept issuing visas after his government said no. | WP ("decided to ignore his orders") |
| Hedy Lamarr | relatedness low | FIX (dropped) | she invented with a partner |
| Ida B. Wells | conflict_cooperativeness low | FIX → agreeableness low: outspoken, even with allies / Some fellow activists saw her as too radical. | WP ("often viewed Wells as too radical"); same meaning, sourced |

### Kept attachment tags on real people (case by case, record supports the behaviour)
Earhart avoidance high (her "dual control" marriage terms) · Sojourner Truth avoidance low (court fight for her son) · Ida B. Wells avoidance low (kept her siblings together) · Van Gogh avoidance low (leaned on Theo) · Blankers-Koen avoidance low (the talk with her husband) · Tenzing anxiety low (roped partnership).

### Added to keep the coverage gate green. Real people only with a cited source (all WP phrases)
| Legend | Tag added | Source phrase |
|---|---|---|
| Nikola Tesla | attachment_avoidance high: a lifelong bachelor | "lifelong bachelor… chastity was very helpful to his scientific abilities" |
| Michelangelo | attachment_avoidance high: kept to himself | "Because of his reclusive nature" |
| Emily Dickinson | attachment_avoidance high: kept the world at the door | "began to talk to visitors from the other side of a door" |
| Matsuo Bashō | attachment_avoidance high: sometimes turned visitors away | "alternating between rejecting visitors to his hut and appreciating their company" |
| J. S. Bach | openness low: kept the older style | "regarded as old-fashioned compared to the emerging galant style" |
| Audrey Hepburn | self_efficacy low: unsure of herself | her own words: "underlying feelings of insecurity and inferiority" |
| Fred Astaire | self_efficacy low: worried about slipping | "insecure and believing his career was beginning to falter" |
| Hedy Lamarr | self_efficacy low: an insecure newcomer | her own words: "the insecure actress" |
| Rabindranath Tagore | self_efficacy low: unsure of his painting | "the very skill that comes to me least easily" |
| Babe Ruth | agreeableness low: clashed with officials | suspended after run-ins with an umpire and a heckler |
| Florence Nightingale | agreeableness low: stubborn and forthright | "stubborn, opinionated, and forthright" |
| Alexander Fleming | conflict_assertiveness low: modest about his part | "modest about his part in the development of penicillin" |
| Clara Barton | conflict_assertiveness low: a shy start | "To assist Barton in overcoming her shyness…" |
| Ryōkan | conflict_assertiveness low: didn't fight the thief | the thief story (m1, hedged "as the story goes") |
| Matthew Henson | autonomy low: Peary's right-hand man | "for more than 20 years, their expeditions…" |
| Fred Korematsu | extraversion low: kept quiet for decades | "remaining quiet for over thirty years" (see U3) |

Myths and animals (interpretive, from each entry's own text or WP page): Robin Hood and King Arthur get attachment_anxiety low (trusted his band / knights). Beowulf gets locus low (his "fate often spares" line, Beowulf ll. 572–3). Mulan gets growth low (asks only to ride home), replacing relatedness high. Momotarō gets conscientiousness low (lazy-boy versions, WP). Scheherazade gets conflict_assertiveness low (stories, not arguments). Nasreddin gets competence low (the fool, WP).

Flying Dutchman gets locus low (doomed to sail), replacing relatedness low. Brownie gets attachment_anxiety high (easily offended, WP), replacing extraversion low. Headless Horseman gets locus low (bound to search, WP), replacing conscientiousness high. Banshee gets locus low (warns, can't prevent), replacing steadiness low. Loch Ness gets growth low, replacing playfulness high. Yeti gets openness low, replacing autonomy high. Will-o'-the-wisp gets competence low (leads astray, WP). Tsukumogami gets attachment_anxiety high (discarded tools, WP), replacing playfulness high. Leprechaun gets growth low (only shoes), replacing playfulness high.

Hachikō gets growth low, replacing conscientiousness high. Togo gets conflict_cooperativeness low ("troublemaker", WP), replacing extraversion low, which had blamed him for being left out of the news. Owney gets attachment_anxiety low, replacing cooperativeness high. Seabiscuit gets competence low (a quarter of his first 40 races), replacing extraversion high. Clever Hans gets attachment_anxiety high (watched his trainer), replacing cooperativeness high. Greyfriars Bobby gets attachment_anxiety high, replacing steadiness high. Balto gets autonomy low (Kaasen's team, WP).

## UNRESOLVED (for emci)

- **U1 — attachment tags on real people.** Should `attachment_anxiety` / `attachment_avoidance` tags be allowed on real people at all? Today I kept 6 that the record supports and added 4 "Private" tags backed by documented reclusiveness (Tesla, Michelangelo, Dickinson, Bashō).
- **U2 — the coverage gate versus fair tags.** Removing unfair tags dropped 12 trait sides below the 8-legend minimum. I closed the gap with sourced tags on real people and interpretive tags on myths and animals. Is that acceptable, or would you rather add new legends (or change the minimum) so fewer low tags rest on interpretation?
- **U3 — Fred Korematsu "kept quiet for decades".** His silence followed an injustice done to him. Is an extraversion-low tag built on that fair, or should it be swapped? Changemakers needs a 4th low side, and no other changemaker has a documented low trait that doesn't blame them.
- **U4 — Matthew Henson "Peary's right-hand man" (autonomy low).** It describes his 20-year role, but that role was shaped by the racism of his time. Keep it, or drop it? Dropping it puts autonomy low back at 7 legends.
- **U5 — for the lead, not emci.** `scripts/legend-roster-check.ts` line ~485 asserts that a death joke ("one houseplant that died of neglect") is dropped. Under the new `card-joke.ts` humour rule it is allowed, so the pin now fails. Should the fixture become a harm-encouraging line, for example "Your drafts folder says you should just drop dead, which is a lot from a folder.", or will the lead update it with the joke-rule change?

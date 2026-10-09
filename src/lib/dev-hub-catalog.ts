/**
 * Every Dev Tools Hub tool, in one list (emci, 2026-10-07 cleanup). Pure.
 *
 * The Hub follows the patterns people already know from developer and admin
 * panels: a status strip on top (Android Developer options, Xcode's build
 * info), a search box (iOS Settings, VS Code settings), groups that are
 * folded by default, and a red Danger zone at the very bottom with typed
 * confirms for anything that cannot be undone (GitHub, Vercel and Supabase
 * project settings). Each tool shows one line; the (i) opens the details.
 *
 * Search matches name, one-liner, details and keywords. A section with no
 * match hides while searching; a section with matches opens.
 *
 * check:dev-lab-sections pins that every <HubTool id="…"> in the Hub is in
 * this list, sits in the section the list says, and that every listed tool is
 * rendered.
 */
export type HubSectionId = 'account' | 'testing' | 'content' | 'phone' | 'ai' | 'labs' | 'admin' | 'danger';

export interface HubSectionDef {
  id: HubSectionId;
  title: string;
  hint: string;
}

export const HUB_SECTIONS: readonly HubSectionDef[] = [
  { id: 'account', title: 'My account', hint: 'Read-only. Nothing here changes anything.' },
  { id: 'testing', title: 'Testing', hint: 'See the app as someone else, or jump this account to a stage.' },
  { id: 'content', title: 'Content', hint: 'Preview or re-trigger what people see.' },
  { id: 'phone', title: 'This phone', hint: 'Only this device. Nothing on the server.' },
  { id: 'ai', title: 'AI', hint: 'What the AI is costing.' },
  { id: 'labs', title: 'Labs', hint: 'Screens nothing else links to.' },
  { id: 'admin', title: 'Admin', hint: "Root only, enforced on the server. These act on other people's accounts." },
  {
    id: 'danger',
    title: 'Danger zone',
    hint: 'Wipes data on this account or this phone. Each one asks you to confirm first.',
  },
];

export interface HubToolDef {
  id: string;
  section: HubSectionId;
  name: string;
  /** One line, shown on the row. */
  summary: string;
  /** Behind the (i). */
  details: string;
  keywords: readonly string[];
}

export const HUB_TOOLS: readonly HubToolDef[] = [
  // My account (read-only)
  {
    id: 'inspector',
    section: 'account',
    name: 'Inspector',
    summary: 'All 16 traits, categories, AI gates and where questions come from.',
    details: 'A read-only picture of this account: each trait as low, mid or high, which categories are open and why, which AI surfaces would run, and the question bank progress.',
    keywords: ['traits', 'categories', 'gates', 'debug'],
  },
  {
    id: 'intake-status',
    section: 'account',
    name: 'Where I am in the intake',
    summary: 'Which set of 16 you are on, and every trait’s answer count.',
    details: 'The intake is 48 questions: 3 per trait, shown as 3 sets of 16. An account that finished the old 50 also counts as done.',
    keywords: ['48', 'set', 'answers', 'progress'],
  },
  {
    id: 'next-round',
    section: 'account',
    name: 'Next round preview',
    summary: 'Which traits the next round of 16 would ask about.',
    details: 'Read-only. Shows the plan the server would follow for the next set, without serving it.',
    keywords: ['round', 'questions', 'plan'],
  },
  {
    id: 'tokens-today',
    section: 'account',
    name: 'Tokens today',
    summary: 'Your ATO balance and today’s round payouts.',
    details: 'Rounds pay +21 at most twice a day. This shows how many of today’s two are used and the recent token history.',
    keywords: ['ato', 'balance', 'payout', '+21'],
  },
  {
    id: 'traits',
    section: 'account',
    name: 'Raw traits',
    summary: 'The stored value, sources and stability of every trait.',
    details: 'The raw numbers behind the profile for this account only. Needs the traits grant or root.',
    keywords: ['values', 'sources', 'stability'],
  },
  {
    id: 'band-stepper',
    section: 'account',
    name: 'Trait bands',
    summary: 'Step through the low, mid and high wording of each trait.',
    details: 'Read-only preview of the band copy, using a fixture, not your account.',
    keywords: ['bands', 'copy', 'low', 'high'],
  },
  // Testing
  {
    id: 'preview',
    section: 'testing',
    name: 'Preview as new user',
    summary: 'See the app as a brand-new account. Nothing is deleted; turn it off to come back.',
    details: 'Root only. While it is on, every screen reads as 0 answers and 0 tokens, and every save is refused before it leaves the phone, so you can click through freely. A red bar shows on every screen; tap it to exit. An app restart or switching accounts also ends it.',
    keywords: ['new user', 'fresh', 'onboarding', 'empty', 'simulate'],
  },
  {
    id: 'jump',
    section: 'testing',
    name: 'Jump this account',
    summary: 'Put this account at a stage: first set, set 2 done, the 48, round 1 finished.',
    details: 'Writes this account’s own traits through the server, two taps. Leaves rounds, tokens and saved text alone.',
    keywords: ['stage', 'preset', 'intake', 'seed'],
  },
  {
    id: 'bank-fill',
    section: 'testing',
    name: 'Fill question sets',
    summary: 'Answer whole sets of the fixed bank on this account.',
    details: 'Root only on the server, pre-launch only. Two taps. Useful to reach the later sets and Change answers without tapping 400 questions.',
    keywords: ['bank', 'sets', 'questions', 'fill', '400'],
  },
  // Content
  {
    id: 'daily-line',
    section: 'content',
    name: 'Daily line',
    summary: 'Today’s written line, its history and the AI lines this account has.',
    details: 'Shows what the picker chose and why. The clear button removes this account’s line history.',
    keywords: ['line', 'moment', 'streak'],
  },
  {
    id: 'mini-guy',
    section: 'content',
    name: 'Mini guy',
    summary: 'Make the mini guy say something now.',
    details: 'Queues a note so you can see the bubble on Home.',
    keywords: ['buddy', 'bubble', 'note'],
  },
  {
    id: 'milestones',
    section: 'content',
    name: 'Milestones',
    summary: 'See which celebrations fired, and forget one to see it again.',
    details: 'Forgetting a milestone takes two taps and only clears that one id.',
    keywords: ['celebration', 'streak', 'unlock'],
  },
  {
    id: 'ai-limits',
    section: 'account',
    name: 'AI limits',
    summary: 'Reset today’s AI counters for this account or any handle.',
    details: 'Clears today’s Story, Legends and deep-dive counters and the shared daily AI quota, so the AI can run again. This account, or another one by typing its handle. Root only (checked on the server). Tokens, cards and answers are untouched. Two taps.',
    keywords: ['ai', 'limits', 'quota', 'reset', 'tokens', 'story', 'deep dive', 'legends'],
  },
  {
    id: 'legend-museum',
    section: 'content',
    name: 'Legends museum',
    summary: 'Preview any legend’s card, fake a birthday, reset today’s three.',
    details: 'Shows each legend with the hand-written (no-AI) story. Can pretend today is a legend’s birthday for On this day, clear today’s three, arm the bonus set, or clear this phone’s copy of the museum. Never calls AI; server rows are untouched.',
    keywords: ['legends', 'museum', 'history', 'myth', 'figures'],
  },
  {
    id: 'crisis',
    section: 'content',
    name: 'Crisis card',
    summary: 'Preview the crisis card and test the on-phone signal.',
    details: 'The crisis card is static: never a generated number. This shows it, and tests the keyword check that raises it on Home.',
    keywords: ['safety', 'help', 'support'],
  },
  {
    id: 'fence',
    section: 'content',
    name: 'Banned words check',
    summary: 'Paste text and see which framework or jargon words it would block.',
    details: 'Runs the same fence every stored and generated line goes through. Needs the fence grant or root.',
    keywords: ['fence', 'jargon', 'framework', 'words'],
  },
  {
    id: 'draft-copy',
    section: 'content',
    name: 'Draft copy list',
    summary: 'Which copy is still waiting on review.',
    details: 'Every *_COPY_REVIEWED flag, drafts first.',
    keywords: ['review', 'flags', 'copy'],
  },
  // This phone
  {
    id: 'you-tools',
    section: 'phone',
    name: 'You tab tools',
    summary: 'Test helpers for the You tab, including the crash test.',
    details: 'Local helpers that touch only this phone.',
    keywords: ['you', 'crash', 'sentry'],
  },
  {
    id: 'push',
    section: 'phone',
    name: 'Notifications',
    summary: 'Permission state and how many reminders are scheduled.',
    details: 'Read-only, plus test pushes. Nothing on the server.',
    keywords: ['push', 'reminders', 'permission'],
  },
  {
    id: 'reload',
    section: 'phone',
    name: 'Reload',
    summary: 'Reload the app, or fetch the newest update and reload into it.',
    details: 'Uses expo-updates. Off in a local dev build.',
    keywords: ['ota', 'update', 'restart'],
  },
  {
    id: 'trace',
    section: 'phone',
    name: 'Trace',
    summary: 'Record what one screen does, step by step.',
    details: 'Short-lived trace sessions for debugging. Needs the trace grant or root.',
    keywords: ['debug', 'log', 'pipeline'],
  },
  // AI
  {
    id: 'quota',
    section: 'ai',
    name: 'AI usage',
    summary: 'Today’s AI calls and the quota left.',
    details: 'Read-only. Needs the quota grant or root.',
    keywords: ['quota', 'cost', 'calls', 'usage'],
  },
  // Labs
  {
    id: 'labs',
    section: 'labs',
    name: 'Labs',
    summary: 'Links to theme, pixel, crisis, profile card and AI labs.',
    details: 'Screens that nothing else in the app links to.',
    keywords: ['theme', 'pixel', 'cards', 'lab'],
  },
  // Admin
  {
    id: 'access-review',
    section: 'admin',
    name: 'Access requests',
    summary: 'Approve or deny people asking to join.',
    details: 'Root only on the server. Two taps.',
    keywords: ['invite', 'join', 'approve'],
  },
  {
    id: 'grants',
    section: 'admin',
    name: 'Tester grants',
    summary: 'Give a tester access to one dev tool.',
    details: 'Root only. Some tools can never be granted.',
    keywords: ['grant', 'tester', 'capability'],
  },
  {
    id: 'profiles',
    section: 'admin',
    name: 'Profiles',
    summary: 'Find an account, pause or delete it.',
    details: 'Root only on the server. Delete needs the handle typed.',
    keywords: ['pause', 'delete', 'search', 'account'],
  },
  // Danger zone
  {
    id: 'reset-account',
    section: 'danger',
    name: 'Reset account',
    summary: 'Wipe this account’s answers, tokens, unlocks, milestones and saved content.',
    details: 'Root only, checked on the server. Type RESET to confirm. Keeps the account, its handle, root, AI consent, invites, Circle and the AI usage log, so it never refills AI quota. Then clears this phone’s saved state for the account. Cannot be undone.',
    keywords: ['reset', 'wipe', 'start over', 'fresh', 'tokens', 'delete'],
  },
  {
    id: 'local-data',
    section: 'danger',
    name: 'Clear this phone’s saved state',
    summary: 'Erase what this account saved on this phone. Nothing on the server.',
    details: 'Lists and removes every account key on this device. Theme, crisis region, push settings and sign-in stay. Two taps.',
    keywords: ['phone', 'cache', 'storage', 'device'],
  },
  {
    id: 'ai-consent',
    section: 'danger',
    name: 'Reset AI consent',
    summary: 'Ask the AI consent question again on this account.',
    details: 'Sets the stored answer back to not asked. Two taps.',
    keywords: ['consent', 'ai', 'permission'],
  },
  {
    id: 'fresh-signup',
    section: 'danger',
    name: 'Delete profile, re-run sign-up',
    summary: 'The dev-test account only: delete its profile and see sign-up again.',
    details: 'Only for @atodev. Deletes the profile and everything on it but keeps the sign-in, so the app opens the Introduce yourself screen. Type the handle to confirm.',
    keywords: ['onboarding', 'signup', 'atodev', 'delete'],
  },
];

export function hubTool(id: string): HubToolDef | null {
  return HUB_TOOLS.find((tool) => tool.id === id) ?? null;
}

function norm(text: string): string {
  return text.toLowerCase().replace(/[’']/g, "'").trim();
}

/** True when the query is empty or every word of it appears somewhere on the tool. */
export function toolMatches(tool: HubToolDef, query: string): boolean {
  const words = norm(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const hay = norm([tool.name, tool.summary, tool.details, ...tool.keywords].join(' '));
  return words.every((word) => hay.includes(word));
}

export function sectionMatchCount(section: HubSectionId, query: string): number {
  return HUB_TOOLS.filter((tool) => tool.section === section && toolMatches(tool, query)).length;
}

export function sectionToolCount(section: HubSectionId): number {
  return HUB_TOOLS.filter((tool) => tool.section === section).length;
}

export function hubSection(id: HubSectionId): HubSectionDef {
  return HUB_SECTIONS.find((section) => section.id === id)!;
}

/** This phone remembers which sections are open (device-level key, kept on a reset). */
export const HUB_OPEN_SECTIONS_KEY = 'ato.devhub.open-sections.v1';

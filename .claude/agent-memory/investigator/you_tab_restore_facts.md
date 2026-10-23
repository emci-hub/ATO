---
name: you-tab-restore-facts
description: What the You tab (src/app/(tabs)/you.tsx) holds now vs pre-fcf4585, which components were deleted, which check scripts pin You
metadata:
  type: project
---

- You now: IdentityCard, AtoTokenCard, SageFactsCard, RunningUpdateLine, SettingsFold "Sage's AI", feedback link, sign out, delete, DevUnlockRow. 289 lines.
- notification-prefs-fold.tsx was DELETED in e0e7510 (recover: `git show fcf4585:src/components/notification-prefs-fold.tsx`). push-prefs.ts, resyncPushForUser still exist. Old src/lib/share.ts (sharePoster/copyLink) also deleted; new share.ts only has shareViewAsImage (lazy native imports); IdentityCard already shares via ShareCardSheet.
- SharePoster is still used by src/app/[handle].tsx. BirthdayRow, CityPicker, AppearancePicker, born-on-fields exist and typecheck.
- around-check (excluded from gate) already fails at HEAD: asserts You matches /CityPicker/. founder-access-check also pins You (excluded).
- Checks asserting You does NOT contain restored items: age-check, appearance-check, ui-bundle-check (SharePoster), badges-check (MilestoneBadges), crisis-region-check, kenney-check, dev-unlock-check.
